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
