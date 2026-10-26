import {supabaseEnvironment} from './supabase-environment';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {reportSchema} from './report';
import {missingFields} from './report-rules';
import {bacaPusatTes} from './pusat-tes';
export const supabaseEnabled=()=> supabaseEnvironment().YSPI_AUTH_MODE==='supabase';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const idSchema=z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/);
const fail=(error:unknown)=>{if(error)throw Error('STORAGE_ERROR')};
async function body(req:Request){if(Number(req.headers.get('content-length'))>100000)throw Error('INVALID');const t=await req.text();if(t.length>100000)throw Error('INVALID');return JSON.parse(t)}
export async function supabaseApi(req:Request){try{
 const e=supabaseEnvironment();
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(String(e.SUPABASE_URL))||typeof e.SUPABASE_PUBLISHABLE_KEY!=='string'||!e.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'))return json({error:'Penyambungan Supabase belum selesai.'},503);
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer ')||bearer.length>8192)return json({error:'Silakan masuk dengan akun pengurus.'},401);
 if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Asal permintaan tidak diizinkan.'},403);
 // Uses a publishable key + user JWT only. No service key bypasses RLS here.
 const db=createClient(e.SUPABASE_URL,e.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:bearer}}});
 const {data:{user},error:authError}=await db.auth.getUser(bearer.slice(7));
 if(authError||!user)return json({error:'Sesi berakhir. Silakan masuk kembali.'},401);
 const {data:member,error:memberError}=await db.from('yspi_members').select('role,active').eq('user_id',user.id).eq('active',true).maybeSingle();
 fail(memberError);if(!member)return json({error:'Akun ini belum mendapat akses pengurus.'},403);
 const [section,id]=new URL(req.url).pathname.slice(5).split('/');
 if(section==='auth'&&id==='me'&&req.method==='GET')return json({email:user.email,role:member.role});
 // Pretest/postest guru (hanya baca) dari Pusat Tes YSPI, setelah keanggotaan pengurus diperiksa di atas.
 if(section==='tes'&&req.method==='GET'){try{return json(await bacaPusatTes())}catch{return json({aktif:false,alasan:'Pusat Tes belum bisa dihubungi.'})}}
 if(section==='growth'&&req.method==='GET'){
  if(id){
   const {data,error}=await db.from('yspi_growth_events').select('id,kind,payload,created_at').eq('plan_id',idSchema.parse(id)).order('created_at',{ascending:false}).limit(100);
   fail(error);return json({events:data||[]});
  }
  const {data,error}=await db.from('yspi_growth_plans').select('id,slot,teacher_label,target,state,model,updated_at').order('updated_at',{ascending:false}).limit(1000);
  if(error?.code==='PGRST205'||error?.code==='42P01')return json({error:'Penyimpanan pencapaian belum diaktifkan. Cerita kegiatan tetap tersedia.'},503);
  fail(error);return json({plans:data||[]});
 }
 if(section==='reports'){
  if(req.method==='GET'){
   const [r,m,c]=await Promise.all([db.from('yspi_reports').select('*').order('created_at',{ascending:false}).limit(1000),db.from('yspi_media').select('id,report_id,name,type,path').limit(1000),db.from('yspi_connection').select('*').eq('id','local').maybeSingle()]);
   fail(r.error);fail(m.error);fail(c.error);
   const media=m.data||[];
   const urls=media.length?await db.storage.from('yspi-media').createSignedUrls(media.map(a=>a.path),120):null;
   fail(urls?.error);
   const signed=new Map(urls?.data?.map(u=>[u.path,u.signedUrl])||[]);
   const connection=c.data||{};
   return json({reports:(r.data||[]).map(report=>({...report,attachments:media.filter(a=>a.report_id===report.id).map(a=>({id:a.id,name:a.name,type:a.type,url:signed.get(a.path)||null}))})),connection:{...connection,online:!!c.data?.last_seen&&Date.now()-Date.parse(c.data.last_seen)<90000&&c.data.ollama}});
  }
  if(req.method==='POST'){
   const b=await body(req),{jenis,...isi}=reportSchema.parse(b);const kurang=missingFields({...isi,jenis},true);
   // jenis hanya dikirim untuk jejak, agar cerita tetap tersimpan sebelum migrasi 006 dipasang.
   const report={...isi,...(jenis==='jejak'?{jenis}:{})};if(kurang.length)return json({error:'Lengkapi kolom wajib: '+kurang.join(', ')+'.'},400);
   const rid=b.id?idSchema.parse(b.id):crypto.randomUUID();
   if(b.id){const {data,error}=await db.from('yspi_reports').update({...report,date:report.date||null}).eq('id',rid).select('id');fail(error);if(!data?.length)return json({error:'Laporan tidak ditemukan.'},404);}
   else{const {error}=await db.from('yspi_reports').insert({id:rid,...report,date:report.date||null,created_by:user.id});fail(error);}
   return json({id:rid});
  }
  if(req.method==='PATCH'){
   const p=z.object({id:idSchema,status:z.enum(['approved','review']).optional(),issue_status:z.enum(['open','progress','resolved']).optional()}).parse(await body(req));
   const {id:rid,...changes}=p;if(!Object.keys(changes).length)return json({error:'Tidak ada perubahan.'},400);
   const {data,error}=await db.from('yspi_reports').update(changes).eq('id',rid).select('id');fail(error);return data?.length?json({ok:true}):json({error:'Laporan tidak ditemukan.'},404);
  }
  // Hapus (mis. data uji sebelum dipakai guru). Hanya admin; salinan Drive tidak ikut terhapus.
  if(req.method==='DELETE'&&id){
   if(member.role!=='admin')return json({error:'Hanya admin yang dapat menghapus.'},403);
   const {data,error}=await db.rpc('yspi_delete_report',{p_id:idSchema.parse(id)});
   if(error?.code==='P0002')return json({error:'Cerita tidak ditemukan.'},404);
   if(error?.code==='42501')return json({error:'Hanya admin yang dapat menghapus.'},403);
   if(error?.code==='PGRST202')return json({error:'Fitur hapus belum diaktifkan di database (migrasi 007).'},503);
   fail(error);
   const paths=((data||[]) as unknown[]).filter((p):p is string=>typeof p==='string');
   // Data sudah terhapus; berkas storage dibersihkan sebisanya (berkas sisa tetap privat).
   if(paths.length){const {error:removeError}=await db.storage.from('yspi-media').remove(paths);if(removeError)console.error('YSPI media cleanup failed');}
   return json({ok:true});
  }
 }
 if(section==='jobs'){
  if(req.method==='POST'){
   const b=z.object({kind:z.enum(['report','analysis']),text:z.string().min(3).max(12000)}).parse(await body(req));
   if(b.kind==='report'&&!/(^|\s)#(?:cerita|laporan)(?=\s|$|[.,:;!?])/iu.test(b.text))return json({error:'Awali pesan uji dengan #cerita.'},400);
   const {data,error}=await db.from('yspi_jobs').insert({...b,created_by:user.id}).select('id,status,kind').single();fail(error);return json(data);
  }
  if(req.method==='GET'&&id){const {data,error}=await db.from('yspi_jobs').select('id,kind,status,result,error').eq('id',z.string().uuid().parse(id)).maybeSingle();fail(error);return data?json({...data,preview_only:true}):json({error:'Pekerjaan tidak ditemukan.'},404);}
 }
 if(section==='media'&&req.method==='POST'){
  if(Number(req.headers.get('content-length'))>16*1024*1024)return json({error:'Maksimum 15 MB.'},413);
  const fd=await req.formData(),file=fd.get('file'),rid=idSchema.parse(fd.get('report_id'));
  if(!(file instanceof File)||file.size>15*1024*1024||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type))return json({error:'Jenis berkas tidak didukung atau melebihi 15 MB.'},400);
  const {data:report,error:readError}=await db.from('yspi_reports').select('id').eq('id',rid).maybeSingle();fail(readError);if(!report)return json({error:'Laporan tidak ditemukan.'},404);
  const mid=crypto.randomUUID(),path=rid+'/'+mid;
  const {error:uploadError}=await db.storage.from('yspi-media').upload(path,file,{contentType:file.type,upsert:false});fail(uploadError);
  const {error}=await db.from('yspi_media').insert({id:mid,report_id:rid,name:file.name.slice(0,200),type:file.type,path});fail(error);
  return json({id:mid});
 }
 // Old bridge-token endpoints are intentionally unavailable in Supabase mode.
 return json({error:'Rute tidak ditemukan.'},404);
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError||(e as Error).message==='INVALID')return json({error:'Format data tidak valid.'},400);console.error('YSPI Supabase request failed');return json({error:'Penyimpanan belum tersedia. Silakan coba lagi.'},503)}
}
