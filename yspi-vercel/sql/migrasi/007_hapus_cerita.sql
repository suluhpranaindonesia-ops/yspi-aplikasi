-- Apply after 006. Admin dapat menghapus cerita/jejak (mis. data uji) dari website.
-- Salinan di Drive tidak ikut terhapus: sinkron laporan-guru hanya menambah/memperbarui.
begin;
-- Hapus lampiran lalu cerita dalam satu transaksi; mengembalikan path berkas storage
-- agar website bisa membersihkan berkasnya. Hanya admin aktif.
create function public.yspi_delete_report(p_id text) returns setof text
language plpgsql volatile security definer set search_path='' as $$
begin
 if not exists(select 1 from public.yspi_members where user_id=auth.uid() and active and role='admin') then
  raise exception 'YSPI_NOT_ADMIN' using errcode='42501';
 end if;
 return query delete from public.yspi_media m where m.report_id=p_id returning m.path;
 delete from public.yspi_reports r where r.id=p_id;
 if not found then raise exception 'YSPI_NOT_FOUND' using errcode='P0002'; end if;
end $$;
revoke all on function public.yspi_delete_report(text) from public,anon;
grant execute on function public.yspi_delete_report(text) to authenticated;
create policy yspi_files_delete on storage.objects for delete to authenticated
 using(bucket_id='yspi-media' and exists(select 1 from public.yspi_members where user_id=(select auth.uid()) and active and role='admin'));
commit;
