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
