-- Proyek Supabase BARU (akun login GitHub), 6 Okt 2026. Jalankan SEKALI di SQL Editor proyek kosong.
-- Gabungan 001, 002, 004, 005 apa adanya; 003 dibuat bersyarat karena rls_auto_enable belum tentu ada.
-- SUDAH DITERAPKAN 6 Okt 2026 ke proyek qpqpvktvezdqzdcpueve (org "Suluh Prana Indonesia", akun GitHub suluhpranaindonesia-ops).
-- Versi yang dijalankan memasukkan kolom slot + constraint 005 langsung ke CREATE TABLE growth_plans
-- (tanpa index one_open yang lalu di-drop); hasil akhirnya sama. Jangan jalankan ulang.

-- Apply ONLY to a new, dedicated Supabase project. No legacy tables are changed.
begin;
create table public.yspi_members (
 user_id uuid primary key references auth.users(id),
 role text not null check (role in ('admin','pengurus')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.yspi_members enable row level security;
revoke all on public.yspi_members from anon, authenticated;
grant select on public.yspi_members to authenticated;
grant all on public.yspi_members to service_role;
create function public.yspi_is_member() returns boolean
language sql stable security invoker set search_path=''
as $$ select exists(select 1 from public.yspi_members where user_id=auth.uid() and active); $$;
revoke all on function public.yspi_is_member() from public, anon;
grant execute on function public.yspi_is_member() to authenticated, service_role;
create policy member_self on public.yspi_members for select to authenticated using(user_id=(select auth.uid()));

create table public.yspi_reports (
 id text primary key default gen_random_uuid()::text check(length(id)<=150),
 name text not null default '' check(length(name)<=200),
 phone text not null default '' check(length(phone)<=80),
 school text not null default '' check(length(school)<=300),
 region text not null default '' check(length(region)<=200),
 date date,
 sessions integer check(sessions between 0 and 100000),
 students integer check(students between 0 and 1000000),
 activity text not null default '' check(length(activity)<=12000),
 impact text not null default '' check(length(impact)<=12000),
 challenge text not null default '' check(length(challenge)<=12000),
 funds_received numeric check(funds_received between 0 and 1000000000000),
 funds_used numeric check(funds_used between 0 and 1000000000000),
 funds_note text not null default '' check(length(funds_note)<=12000),
 raw text not null default '' check(length(raw)<=16000),
 source text not null default 'manual' check(source in ('manual','whatsapp','test')),
 status text not null default 'review' check(status in ('review','approved')),
 issue_status text not null default 'open' check(issue_status in ('open','progress','resolved')),
 model text not null default '' check(length(model)<=100),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index yspi_reports_created on public.yspi_reports(created_at desc);
create index yspi_reports_author on public.yspi_reports(created_by);
alter table public.yspi_reports enable row level security;
revoke all on public.yspi_reports from anon, authenticated;
grant select on public.yspi_reports to authenticated;
grant insert(id,name,phone,school,region,date,sessions,students,activity,impact,challenge,funds_received,funds_used,funds_note,created_by) on public.yspi_reports to authenticated;
grant update(name,phone,school,region,date,sessions,students,activity,impact,challenge,funds_received,funds_used,funds_note,status,issue_status) on public.yspi_reports to authenticated;
grant all on public.yspi_reports to service_role;
create policy report_read on public.yspi_reports for select to authenticated using((select public.yspi_is_member()));
create policy report_insert on public.yspi_reports for insert to authenticated with check((select public.yspi_is_member()) and created_by=(select auth.uid()) and source='manual' and status='review');
create policy report_edit on public.yspi_reports for update to authenticated using((select public.yspi_is_member())) with check((select public.yspi_is_member()));
create function public.yspi_touch_report() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
revoke all on function public.yspi_touch_report() from public, anon, authenticated;
create trigger yspi_report_update before update on public.yspi_reports for each row execute function public.yspi_touch_report();

create table public.yspi_jobs (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('report','analysis')),
 text text not null check(length(text) between 3 and 12000),
 status text not null default 'pending' check(status in ('pending','processing','done','failed')),
 result jsonb,
 error text,
 lease uuid,
 lease_until timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index yspi_jobs_queue on public.yspi_jobs(status,created_at);
create index yspi_jobs_author on public.yspi_jobs(created_by);
alter table public.yspi_jobs enable row level security;
revoke all on public.yspi_jobs from anon, authenticated;
grant select on public.yspi_jobs to authenticated;
grant insert(kind,text,created_by) on public.yspi_jobs to authenticated;
grant all on public.yspi_jobs to service_role;
create policy jobs_read on public.yspi_jobs for select to authenticated using((select public.yspi_is_member()) and created_by=(select auth.uid()));
create policy jobs_create on public.yspi_jobs for insert to authenticated with check((select public.yspi_is_member()) and created_by=(select auth.uid()) and status='pending' and result is null and lease is null);

-- Atomic claims and fenced completion: only the local server key may call these.
-- An interrupted worker can be replaced after its lease expires.
create function public.yspi_claim_job() returns setof public.yspi_jobs
language sql volatile security invoker set search_path='' as $$
 update public.yspi_jobs j set status='processing', lease=gen_random_uuid(),
 lease_until=now()+interval '8 minutes'
 where j.id=(select q.id from public.yspi_jobs q
   where (q.status='pending' or (q.status='processing' and q.lease_until<now()))
   and exists(select 1 from public.yspi_members m where m.user_id=q.created_by and m.active)
   order by q.created_at for update skip locked limit 1)
 returning j.*;
$$;
revoke all on function public.yspi_claim_job() from public,anon,authenticated;
grant execute on function public.yspi_claim_job() to service_role;
create function public.yspi_finish_job(job_id uuid, job_lease uuid, job_result jsonb, job_error text)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare affected integer;
begin
 update public.yspi_jobs set status=case when job_error is null then 'done' else 'failed' end,
 result=job_result,error=left(job_error,500),lease=null,lease_until=null
 where id=job_id and lease=job_lease and status='processing' and lease_until>now();
 get diagnostics affected = row_count;
 return affected=1;
end;
$$;
revoke all on function public.yspi_finish_job(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.yspi_finish_job(uuid,uuid,jsonb,text) to service_role;

create table public.yspi_connection (
 id text primary key check(id='local'),
 model text not null,
 whatsapp text not null,
 ollama boolean not null default false,
 last_seen timestamptz not null default now()
);
alter table public.yspi_connection enable row level security;
revoke all on public.yspi_connection from anon, authenticated;
grant select on public.yspi_connection to authenticated;
grant all on public.yspi_connection to service_role;
create policy connection_read on public.yspi_connection for select to authenticated using((select public.yspi_is_member()));

create table public.yspi_media (
 id text primary key,
 report_id text not null references public.yspi_reports(id),
 name text not null check(length(name)<=200),
 type text not null,
 path text unique not null,
 created_at timestamptz not null default now()
);
create index yspi_media_report on public.yspi_media(report_id);
alter table public.yspi_media enable row level security;
revoke all on public.yspi_media from anon, authenticated;
grant select,insert on public.yspi_media to authenticated;
grant all on public.yspi_media to service_role;
create policy media_read on public.yspi_media for select to authenticated using((select public.yspi_is_member()));
create policy media_insert on public.yspi_media for insert to authenticated with check((select public.yspi_is_member()) and path=report_id||'/'||id and type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('yspi-media','yspi-media',false,15728640,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy yspi_files_read on storage.objects for select to authenticated
 using(bucket_id='yspi-media' and (select public.yspi_is_member()));
create policy yspi_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='yspi-media' and (select public.yspi_is_member()) and exists(select 1 from public.yspi_reports r where r.id=(storage.foldername(name))[1]));
commit;

-- Owner-approved emails, 2026-09-16. Only verified identities receive membership.
begin;
create schema if not exists yspi_private;
revoke all on schema yspi_private from public,anon,authenticated;
create table yspi_private.allowed_emails (
 email text primary key check(email=lower(email)),
 role text not null check(role in ('admin','pengurus'))
);
alter table yspi_private.allowed_emails enable row level security;
revoke all on yspi_private.allowed_emails from public,anon,authenticated;
insert into yspi_private.allowed_emails(email,role) values
 ('danielwilliamputratheo@gmail.com','admin'),
 ('andrian.purnama@gmail.com','pengurus'),
 ('rudyribia@gmail.com','pengurus');
create function yspi_private.sync_member() returns trigger
language plpgsql security definer set search_path='' as $$
declare allowed_role text;
begin
 select role into allowed_role from yspi_private.allowed_emails where email=lower(new.email);
 if new.email_confirmed_at is not null and allowed_role is not null then
  insert into public.yspi_members(user_id,role,active) values(new.id,allowed_role,true)
  on conflict(user_id) do update set role=excluded.role;
 else
  delete from public.yspi_members where user_id=new.id;
 end if;
 return new;
end;
$$;
revoke all on function yspi_private.sync_member() from public,anon,authenticated,service_role;
create trigger yspi_verified_member after insert or update of email,email_confirmed_at on auth.users
for each row execute function yspi_private.sync_member();
insert into public.yspi_members(user_id,role)
 select u.id,a.role from auth.users u join yspi_private.allowed_emails a on a.email=lower(u.email)
 where u.email_confirmed_at is not null
 on conflict(user_id) do update set role=excluded.role;
commit;

-- 003 (bersyarat)
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable') then
  execute 'revoke all on function public.rls_auto_enable() from public,anon,authenticated';
 end if;
end $$;

-- Additive only: legacy yspi_reports/media and the one-way Drive copy stay unchanged.
begin;
create table public.yspi_growth_plans (
 id text primary key check(length(id) between 1 and 150),
 owner_key text not null check(owner_key ~ '^[a-f0-9]{64}$'),
 teacher_label text not null check(length(teacher_label) between 1 and 200),
 target text not null check(length(target) between 5 and 1000),
 state jsonb not null check(jsonb_typeof(state)='object' and state->>'status' in ('draft','active','ready','paused','completed','cancelled') and jsonb_typeof(state->'steps')='array'),
 model text not null check(length(model)<=100),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index yspi_growth_one_open on public.yspi_growth_plans(owner_key) where state->>'status' not in ('completed','cancelled');
create index yspi_growth_updated on public.yspi_growth_plans(updated_at desc);
alter table public.yspi_growth_plans enable row level security;
revoke all on public.yspi_growth_plans from public,anon,authenticated;
grant select on public.yspi_growth_plans to authenticated;
grant all on public.yspi_growth_plans to service_role;
create policy growth_member_read on public.yspi_growth_plans for select to authenticated using((select public.yspi_is_member()));

create table public.yspi_growth_events (
 id text primary key check(length(id) between 1 and 180),
 plan_id text not null references public.yspi_growth_plans(id),
 kind text not null check(length(kind)<=40),
 payload jsonb not null,
 created_at timestamptz not null default now()
);
create index yspi_growth_events_plan on public.yspi_growth_events(plan_id,created_at desc);
alter table public.yspi_growth_events enable row level security;
revoke all on public.yspi_growth_events from public,anon,authenticated;
grant select on public.yspi_growth_events to authenticated;
grant all on public.yspi_growth_events to service_role;
create policy growth_events_read on public.yspi_growth_events for select to authenticated using((select public.yspi_is_member()));

-- Atomic optimistic update + immutable command receipt. A retry cannot advance a stage twice.
create function public.yspi_growth_save(plan jsonb, expected_version integer, event_id text, event_kind text, event_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare previous jsonb; affected integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(event_id,0));
 select payload into previous from public.yspi_growth_events where id=event_id;
 if found then return previous; end if;
 if expected_version=0 then
  insert into public.yspi_growth_plans(id,owner_key,teacher_label,target,state,model)
   values(plan->>'id',plan->>'owner_key',plan->>'teacher_label',plan->>'target',plan->'state',plan->>'model');
 else
  update public.yspi_growth_plans set state=plan->'state',version=version+1,updated_at=now()
   where id=plan->>'id' and owner_key=plan->>'owner_key' and version=expected_version;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'GROWTH_VERSION_CONFLICT'; end if;
 end if;
 insert into public.yspi_growth_events(id,plan_id,kind,payload) values(event_id,plan->>'id',event_kind,event_payload);
 return event_payload;
end;
$$;
revoke all on function public.yspi_growth_save(jsonb,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.yspi_growth_save(jsonb,integer,text,text,jsonb) to service_role;
commit;

-- Apply after 004. Three OPEN goals per WhatsApp identity. Histories remain intact.
begin;
alter table public.yspi_growth_plans add column slot smallint not null default 1 check(slot between 1 and 3);
-- PostgreSQL CHECK permits NULL; require a real status so the partial index cannot be bypassed.
alter table public.yspi_growth_plans add constraint yspi_growth_status_required
 check(coalesce(state->>'status' in ('draft','active','ready','paused','completed','cancelled'),false));
-- 004 allowed one open goal, so all existing open rows fit slot 1.
drop index public.yspi_growth_one_open;
create unique index yspi_growth_three_slots on public.yspi_growth_plans(owner_key,slot)
 where state->>'status' not in ('completed','cancelled');

create or replace function public.yspi_growth_save(plan jsonb, expected_version integer, event_id text, event_kind text, event_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare previous jsonb; affected integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(event_id,0));
 select payload into previous from public.yspi_growth_events where id=event_id;
 if found then return previous; end if;
 -- Sender lock serializes inserts/resets. CHECK + unique slot enforce the cap even outside this RPC.
 perform pg_advisory_xact_lock(hashtextextended(plan->>'owner_key',1));
 if expected_version=0 then
  insert into public.yspi_growth_plans(id,owner_key,teacher_label,target,state,model,slot)
   values(plan->>'id',plan->>'owner_key',plan->>'teacher_label',plan->>'target',plan->'state',plan->>'model',coalesce((plan->>'slot')::smallint,1));
 else
  update public.yspi_growth_plans set state=plan->'state',version=version+1,updated_at=now()
   where id=plan->>'id' and owner_key=plan->>'owner_key' and version=expected_version;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'GROWTH_VERSION_CONFLICT'; end if;
 end if;
 insert into public.yspi_growth_events(id,plan_id,kind,payload) values(event_id,plan->>'id',event_kind,event_payload);
 return event_payload;
end;
$$;
revoke all on function public.yspi_growth_save(jsonb,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.yspi_growth_save(jsonb,integer,text,text,jsonb) to service_role;
commit;
