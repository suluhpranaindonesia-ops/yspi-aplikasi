-- Supabase's automatic-RLS event trigger only needs its owner to execute it.
-- Security Advisor flagged the default public grants on this new project.
revoke all on function public.rls_auto_enable() from public,anon,authenticated;
