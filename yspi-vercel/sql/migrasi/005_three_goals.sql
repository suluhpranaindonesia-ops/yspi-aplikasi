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
