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
