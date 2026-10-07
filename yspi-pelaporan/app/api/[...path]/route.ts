import {db,bucket,authenticate,putReport,allReports} from '@/lib/server';
import {z} from 'zod';
import {supabaseEnabled,supabaseApi} from '@/lib/supabase-api';
export const dynamic='force-dynamic';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
async function body(req:Request){const text=await req.text();if(text.length>100000)throw Error('Pesan terlalu panjang');return JSON.parse(text)}
async function handle(req:Request){try{
 if(supabaseEnabled())return await supabaseApi(req);
 // Jalur lama (D1 + header identitas ChatGPT Sites) hanya aman di balik dispatcher Sites.
 // Di Cloudflare milik sendiri header oai-authenticated-* bisa dipalsukan, jadi selalu tolak.
 return json({error:'Penyambungan Supabase belum selesai.'},503);
 const parts=new URL(req.url).pathname.slice(5).split('/'),[section,id,action]=parts;
 const role=await authenticate(req,section==='bridge');
 if(section==='reports'){
  if(req.method==='GET'){const data=await allReports();const row:any=await db().prepare("SELECT value FROM settings WHERE key='connection'").first();const c=row?JSON.parse(row.value):{};return json({reports:data,connection:{...c,online:!!c.last_seen&&Date.now()-Date.parse(c.last_seen)<90000&&!!c.ollama}})}
  const b=await body(req);
  if(req.method==='POST'){if(!b.name?.trim()||!b.school?.trim())return json({error:'Nama dan sekolah wajib diisi'},400);return json({id:await putReport(b,b.id||crypto.randomUUID())})}
  if(req.method==='PATCH'){const p=z.object({id:z.string(),status:z.enum(['approved','review']).optional(),issue_status:z.enum(['open','progress','resolved']).optional()}).parse(b);const keys=['status','issue_status'].filter(k=>(p as any)[k]);if(!keys.length)return json({error:'Tidak ada perubahan'},400);await db().prepare('UPDATE reports SET '+keys.map(k=>k+'=?').join(',')+',updated_at=? WHERE id=?').bind(...keys.map(k=>(p as any)[k]),new Date().toISOString(),p.id).run();return json({ok:true})}
 }
 if(section==='jobs'){
  if(req.method==='POST'){const b=z.object({kind:z.enum(['report','analysis']),text:z.string().min(3).max(12000)}).parse(await body(req));if(b.kind==='report'&&!/(^|\s)#laporan(?=\s|$|[.,:;!?])/iu.test(b.text))return json({error:'Awali pesan uji dengan #laporan'},400);const n:any=await db().prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('pending','processing')").first();if(n.n>=100)return json({error:'Antrean penuh. Tunggu pemrosesan selesai.'},429);const jid=crypto.randomUUID();await db().prepare('INSERT INTO jobs(id,kind,payload,status,created_at) VALUES(?,?,?,?,?)').bind(jid,b.kind,JSON.stringify({text:b.text}), 'pending',new Date().toISOString()).run();return json({id:jid,status:'pending',kind:b.kind})}
  if(req.method==='GET'&&id){const j:any=await db().prepare('SELECT id,kind,status,result,error FROM jobs WHERE id=?').bind(id).first();return j?json({...j,result:j.result?JSON.parse(j.result):null}):json({error:'Pekerjaan tidak ditemukan'},404)}
 }
 if(section==='bridge'){
  if(id==='heartbeat'&&req.method==='POST'){const b=z.object({model:z.string().max(100),whatsapp:z.string().max(200),ollama:z.boolean()}).parse(await body(req));await db().prepare("INSERT INTO settings(key,value) VALUES('connection',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify({...b,last_seen:new Date().toISOString()})).run();return json({ok:true})}
  if(id==='reports'&&req.method==='POST'){const b=z.object({message_id:z.string().min(1).max(150),report:z.any(),raw:z.string().max(16000),model:z.string().max(100),source:z.enum(['whatsapp','test']).default('whatsapp')}).parse(await body(req));return json({id:await putReport(b.report,b.message_id,b.source,b.raw,b.model,true)})}
  if(id==='claim'&&req.method==='POST'){const now=Date.now(),lease=crypto.randomUUID();const j:any=await db().prepare("UPDATE jobs SET status='processing',lease=?,lease_until=? WHERE id=(SELECT id FROM jobs WHERE status='pending' OR (status='processing' AND lease_until<?) ORDER BY created_at LIMIT 1) RETURNING *").bind(lease,now+600000,now).first();if(!j)return json({job:null});return json({job:{...j,payload:JSON.parse(j.payload),reports:j.kind==='analysis'?(await allReports()).slice(0,100):undefined}})}
  if(id==='complete'&&req.method==='POST'){const b=z.object({id:z.string(),lease:z.string(),result:z.any().optional(),error:z.string().max(1000).optional()}).parse(await body(req));const j:any=await db().prepare("SELECT * FROM jobs WHERE id=? AND lease=? AND status='processing'").bind(b.id,b.lease).first();if(!j)return json({error:'Lease pekerjaan sudah berakhir'},409);if(!b.error&&j.kind==='report')await putReport(b.result.report,j.id,'test',JSON.parse(j.payload).text,b.result.model,true);await db().prepare('UPDATE jobs SET status=?,result=?,error=? WHERE id=? AND lease=?').bind(b.error?'failed':'done',JSON.stringify(b.result||null),b.error||null,b.id,b.lease).run();return json({ok:true})}
 }
 if(section==='media'){
  if(req.method==='GET'&&id){const m:any=await db().prepare('SELECT * FROM media WHERE id=?').bind(id).first();if(!m)return json({error:'Media tidak ditemukan'},404);const object=await bucket().get(m.key);if(!object)return json({error:'Berkas tidak tersedia'},404);return new Response(object.body,{headers:{'Content-Type':m.type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=60'}})}
  if(req.method==='POST'){
   if(Number(req.headers.get('content-length')||0)>16*1024*1024)return json({error:'Maksimum 15 MB'},413);
   const fd=await req.formData(),file=fd.get('file'),rid=String(fd.get('report_id')||'');
   if(!(file instanceof File)||file.size>15*1024*1024||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type))return json({error:'Jenis berkas tidak didukung atau lebih dari 15 MB'},400);
   if(!await db().prepare('SELECT id FROM reports WHERE id=?').bind(rid).first())return json({error:'Laporan tidak ditemukan'},404);
   const supplied=role==='bridge'?fd.get('media_id'):null;
   const mid=supplied?z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/).parse(supplied):crypto.randomUUID();
   const existing:any=await db().prepare('SELECT report_id FROM media WHERE id=?').bind(mid).first();
   if(existing)return existing.report_id===rid?json({id:mid}):json({error:'ID lampiran sudah digunakan'},409);
   const key='reports/'+crypto.randomUUID();
   await bucket().put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
   try{await db().prepare('INSERT INTO media(id,report_id,name,type,key,created_at) VALUES(?,?,?,?,?,?)').bind(mid,rid,file.name.slice(0,200),file.type,key,new Date().toISOString()).run()}
   catch(e){await bucket().delete(key);const duplicate:any=await db().prepare('SELECT report_id FROM media WHERE id=?').bind(mid).first();if(duplicate?.report_id!==rid)throw e}
   return json({id:mid});
  }
 }
 return json({error:'Rute tidak ditemukan'},404);
 }catch(e){const m=(e as Error).message;if(m==='UNAUTHORIZED')return json({error:'Akses memerlukan masuk ke ruang kerja atau token penghubung yang valid.'},401);if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Data tidak valid. Periksa kolom dan format pesan.'},400);console.error('YSPI API',m);return json({error:'Layanan penyimpanan belum siap. Silakan coba lagi.'},503)}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;
