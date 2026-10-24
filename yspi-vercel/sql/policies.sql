-- RLS policies — Web Pelaporan Guru / Jejak (yspi-vercel), proyek Supabase qpqpvktvezdqzdcpueve.
--
-- ⚠️ USULAN — review & bandingkan dengan policy yang SUDAH berjalan sebelum menerapkan.
--    Jalankan di Supabase → SQL Editor. Tidak ada DROP TABLE; hanya fungsi & policy.
--
-- Mengapa ini penting (temuan T1): aplikasi memakai publishable key + JWT pengguna (TANPA service
-- key), jadi siapa pun yang punya JWT login bisa memukul /rest/v1 dan /storage LANGSUNG, melewati
-- gerbang yspi_members di API Next.js. Maka RLS WAJIB membatasi ke MEMBER AKTIF — bukan sekadar
-- "authenticated". Policy berbasis auth.role()='authenticated' atau USING (true) = kebocoran.
--
-- Pelengkap WAJIB: matikan signup publik / wajibkan konfirmasi di Supabase → Authentication,
-- supaya penyerang tidak bisa mencetak JWT authenticated sesuka hati.

-- ---------- fungsi bantu (security definer: tidak terkena RLS yspi_members, anti-rekursi) ----------
create or replace function public.yspi_is_member()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.yspi_members m where m.user_id = auth.uid() and m.active);
$$;

create or replace function public.yspi_is_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.yspi_members m where m.user_id = auth.uid() and m.active and m.role = 'admin');
$$;

revoke all on function public.yspi_is_member() from public;
revoke all on function public.yspi_is_admin() from public;
grant execute on function public.yspi_is_member() to authenticated;
grant execute on function public.yspi_is_admin() to authenticated;

-- ---------- aktifkan RLS ----------
alter table public.yspi_members      enable row level security;
alter table public.yspi_reports      enable row level security;
alter table public.yspi_media        enable row level security;
alter table public.yspi_growth_plans enable row level security;
alter table public.yspi_growth_events enable row level security;
alter table public.yspi_jobs         enable row level security;
alter table public.yspi_connection   enable row level security;

-- Tidak ada akses lewat anon; penulisan "sistem" (growth, connection, hapus) lewat service key
-- yang MELEWATI RLS — jadi tak perlu policy untuk itu.
revoke all on public.yspi_members, public.yspi_reports, public.yspi_media,
  public.yspi_growth_plans, public.yspi_growth_events, public.yspi_jobs, public.yspi_connection
  from anon;

-- ---------- yspi_members: tiap orang hanya melihat baris keanggotaannya sendiri ----------
drop policy if exists yspi_members_self_read on public.yspi_members;
create policy yspi_members_self_read on public.yspi_members
  for select to authenticated using (user_id = auth.uid());

-- ---------- yspi_reports ----------
drop policy if exists yspi_reports_read   on public.yspi_reports;
drop policy if exists yspi_reports_insert on public.yspi_reports;
drop policy if exists yspi_reports_update on public.yspi_reports;
create policy yspi_reports_read   on public.yspi_reports for select to authenticated using (public.yspi_is_member());
create policy yspi_reports_insert on public.yspi_reports for insert to authenticated with check (public.yspi_is_member() and created_by = auth.uid());
create policy yspi_reports_update on public.yspi_reports for update to authenticated using (public.yspi_is_member()) with check (public.yspi_is_member());
-- DELETE sengaja tanpa policy: penghapusan hanya lewat RPC yspi_delete_report (security definer) yang
-- memeriksa admin. Pastikan fungsi RPC itu memang security definer & memeriksa public.yspi_is_admin().

-- ---------- yspi_media ----------
drop policy if exists yspi_media_read   on public.yspi_media;
drop policy if exists yspi_media_insert on public.yspi_media;
create policy yspi_media_read   on public.yspi_media for select to authenticated using (public.yspi_is_member());
create policy yspi_media_insert on public.yspi_media for insert to authenticated with check (public.yspi_is_member());

-- ---------- yspi_growth_* & yspi_connection: baca untuk member; tulis hanya service key ----------
drop policy if exists yspi_growth_plans_read  on public.yspi_growth_plans;
drop policy if exists yspi_growth_events_read on public.yspi_growth_events;
drop policy if exists yspi_connection_read    on public.yspi_connection;
create policy yspi_growth_plans_read  on public.yspi_growth_plans  for select to authenticated using (public.yspi_is_member());
create policy yspi_growth_events_read on public.yspi_growth_events for select to authenticated using (public.yspi_is_member());
create policy yspi_connection_read    on public.yspi_connection    for select to authenticated using (public.yspi_is_member());

-- ---------- yspi_jobs: member membuat & membaca pekerjaannya ----------
drop policy if exists yspi_jobs_read   on public.yspi_jobs;
drop policy if exists yspi_jobs_insert on public.yspi_jobs;
create policy yspi_jobs_read   on public.yspi_jobs for select to authenticated using (public.yspi_is_member());
create policy yspi_jobs_insert on public.yspi_jobs for insert to authenticated with check (public.yspi_is_member() and created_by = auth.uid());

-- ---------- Storage: bucket yspi-media privat, hanya member ----------
-- Pastikan bucket privat: update storage.buckets set public = false where id = 'yspi-media';
drop policy if exists yspi_media_obj_read   on storage.objects;
drop policy if exists yspi_media_obj_insert on storage.objects;
create policy yspi_media_obj_read   on storage.objects for select to authenticated using (bucket_id = 'yspi-media' and public.yspi_is_member());
create policy yspi_media_obj_insert on storage.objects for insert to authenticated with check (bucket_id = 'yspi-media' and public.yspi_is_member());

-- ---------- verifikasi cepat (jalankan sebagai pengguna non-member lewat JWT-nya) ----------
--   scripts/check-access.mjs dengan env CHECK_NONMEMBER_JWT akan menguji ini secara otomatis.
