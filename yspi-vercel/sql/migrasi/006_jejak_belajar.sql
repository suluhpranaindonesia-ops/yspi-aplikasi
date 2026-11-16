-- Apply after 005. "Jejak belajar" (#jejak): guru membagikan hasil belajar siswa di rumah.
-- Additive only: memakai tabel cerita yang sama agar foto, pemeriksaan pengurus, dan
-- salinan Drive tetap satu jalur. Baris lama otomatis berjenis 'cerita'.
begin;
alter table public.yspi_reports add column jenis text not null default 'cerita' check(jenis in ('cerita','jejak'));
create index yspi_reports_jenis on public.yspi_reports(jenis,created_at desc);
grant insert(jenis) on public.yspi_reports to authenticated;
grant update(jenis) on public.yspi_reports to authenticated;
commit;
