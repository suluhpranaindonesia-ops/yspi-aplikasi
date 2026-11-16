-- Apply after 007. Program kerja guru (POAC + KPI), seperti menu Program kerja di web HT POUK.
-- Additive only: tabel baru, tidak mengubah cerita/jejak/pencapaian.
-- Diisi pengurus lewat website (yspi-vercel). Belum ada jalur WhatsApp.
-- kpi      = [{id, indikator, satuan, target}]                      (maks. 10, dibatasi API)
-- kemajuan = [{id, tanggal, kegiatan, realisasi:{kpiId:angka}, catatan, oleh, waktu}]
-- riwayat  = [{waktu, status, catatan, oleh}]                       (persetujuan YSPI)
begin;
create table public.yspi_programs (
 id text primary key,
 teacher_name text not null check(length(teacher_name) between 1 and 200),
 teacher_phone text not null default '',
 school text not null default '',
 region text not null default '',
 name text not null check(length(name) between 1 and 200),
 goal text not null default '',
 audience text not null default '',
 plan text not null default '',
 organize text not null default '',
 actuate text not null default '',
 control text not null default '',
 resources text not null default '',
 budget numeric check(budget is null or budget >= 0),
 start_date date,
 end_date date,
 kpi jsonb not null default '[]'::jsonb check(jsonb_typeof(kpi)='array'),
 progress jsonb not null default '[]'::jsonb check(jsonb_typeof(progress)='array'),
 status text not null default 'draf' check(status in ('draf','dikirim','disetujui','revisi')),
 review_note text not null default '',
 history jsonb not null default '[]'::jsonb check(jsonb_typeof(history)='array'),
 archived boolean not null default false,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index yspi_programs_updated on public.yspi_programs(updated_at desc);
alter table public.yspi_programs enable row level security;
revoke all on public.yspi_programs from public,anon,authenticated;
-- Tidak ada DELETE: program hanya diarsipkan (archived=true).
grant select,insert,update on public.yspi_programs to authenticated;
grant all on public.yspi_programs to service_role;
create policy programs_member_read on public.yspi_programs for select to authenticated
 using((select public.yspi_is_member()));
create policy programs_member_insert on public.yspi_programs for insert to authenticated
 with check((select public.yspi_is_member()) and created_by=(select auth.uid()));
create policy programs_member_update on public.yspi_programs for update to authenticated
 using((select public.yspi_is_member())) with check((select public.yspi_is_member()));
commit;
