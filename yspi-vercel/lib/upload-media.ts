import type {SupabaseClient} from '@supabase/supabase-js';

// Upload directly to the private bucket with the user's JWT. This avoids the
// Vercel request-body limit; existing Supabase membership/storage RLS still applies.
export async function uploadMedia(client:SupabaseClient,reportId:string,file:File){
 if(!/^[a-zA-Z0-9_-]{1,150}$/.test(reportId))throw Error('ID cerita tidak valid.');
 if(!(file instanceof File)||file.size>15*1024*1024||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type))throw Error('Jenis berkas tidak didukung atau melebihi 15 MB.');
 const {data:report,error:readError}=await client.from('yspi_reports').select('id').eq('id',reportId).maybeSingle();
 if(readError||!report)throw Error('Cerita tidak ditemukan atau akses sudah berakhir.');
 const id=crypto.randomUUID(),path=reportId+'/'+id;
 const {error:uploadError}=await client.storage.from('yspi-media').upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError)throw Error('Cerita tersimpan tetapi unggahan lampiran gagal. Silakan coba lagi.');
 const {error}=await client.from('yspi_media').insert({id,report_id:reportId,name:file.name.slice(0,200),type:file.type,path});
 if(error)throw Error('Berkas terunggah tetapi pencatatan lampiran gagal. Hubungi admin sebelum mengunggah ulang.');
 return {id};
}
