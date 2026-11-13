import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
// Program kerja guru (tabel yspi_programs, migrasi 008), meniru Program kerja web HT POUK:
// POAC + KPI, persetujuan YSPI (draf → dikirim → disetujui / revisi), dan catatan kemajuan
// bertanggal yang mengisi realisasi KPI. Tidak ada hapus; program hanya diarsipkan.
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const idSchema=z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/);
const kecil=z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);
const teks=(max:number)=>z.string().trim().max(max).default('');
const tanggal=z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal(''),z.null()]).optional().transform(v=>v||null);
const angka=z.number().finite().nonnegative().nullable().optional().transform(v=>v??null);
export const STATUS_PROGRAM=['draf','dikirim','disetujui','revisi'] as const;
const programSchema=z.object({
 id:idSchema.nullable().optional(),
 teacher_name:z.string().trim().min(1).max(200),teacher_phone:teks(30),school:teks(200),region:teks(200),
 name:z.string().trim().min(1).max(200),goal:teks(4000),audience:teks(1000),
 plan:teks(4000),organize:teks(4000),actuate:teks(4000),control:teks(4000),resources:teks(2000),
 budget:angka,start_date:tanggal,end_date:tanggal,
 kpi:z.array(z.object({id:kecil.optional(),indikator:teks(300),satuan:teks(40),target:angka})).max(10).default([]),
});
const patchSchema=z.object({
 id:idSchema,
 status:z.enum(STATUS_PROGRAM).optional(),note:teks(2000),
 archived:z.boolean().optional(),
 progress:z.object({tanggal,kegiatan:z.string().trim().min(1).max(2000),realisasi:z.record(kecil,z.number().finite().nonnegative()).default({}),catatan:teks(2000)}).optional(),
 removeProgress:kecil.optional(),
});
const uid=(p:string)=>p+'-'+crypto.randomUUID().replaceAll('-','').slice(0,12);
const kini=()=>new Date().toISOString();
const fail=(error:unknown)=>{if(error)throw Error('STORAGE_ERROR')};
const belumAktif=(e:{code?:string}|null)=>e?.code==='PGRST205'||e?.code==='42P01';
const pesanBelumAktif=json({error:'Program kerja belum diaktifkan di database (migrasi 008).'},503);
async function body(req:Request){if(Number(req.headers.get('content-length'))>100000)throw Error('INVALID');const t=await req.text();if(t.length>100000)throw Error('INVALID');return JSON.parse(t)}

export async function programs(req:Request,db:SupabaseClient,userId:string,oleh:string){
 if(req.method==='GET'){
  const {data,error}=await db.from('yspi_programs').select('*').eq('archived',false).order('updated_at',{ascending:false}).limit(500);
  if(belumAktif(error))return pesanBelumAktif;
  fail(error);return json({programs:data||[]});
 }
 if(req.method==='POST'){
  const b=programSchema.parse(await body(req));
  const isi={...b,kpi:b.kpi.filter(k=>k.indikator).map(k=>({...k,id:k.id||uid('kpi')}))};
  delete (isi as {id?:unknown}).id;
  if(b.id){
   const {data,error}=await db.from('yspi_programs').update({...isi,updated_at:kini()}).eq('id',b.id).select('id');
   if(belumAktif(error))return pesanBelumAktif;
   fail(error);return data?.length?json({id:b.id}):json({error:'Program tidak ditemukan.'},404);
  }
  const id=uid('pk');
  const {error}=await db.from('yspi_programs').insert({id,...isi,status:'draf',created_by:userId});
  if(belumAktif(error))return pesanBelumAktif;
  fail(error);return json({id});
 }
 if(req.method==='PATCH'){
  const p=patchSchema.parse(await body(req));
  const {data:ada,error:readError}=await db.from('yspi_programs').select('id,kpi,progress,history,status').eq('id',p.id).maybeSingle();
  if(belumAktif(readError))return pesanBelumAktif;
  fail(readError);if(!ada)return json({error:'Program tidak ditemukan.'},404);
  const ubah:Record<string,unknown>={updated_at:kini()};
  if(p.status){
   ubah.status=p.status;ubah.review_note=p.note;
   ubah.history=[...(ada.history||[]),{waktu:kini(),status:p.status,catatan:p.note,oleh}].slice(-200);
  }
  if(p.archived!==undefined)ubah.archived=p.archived;
  if(p.progress){
   // Realisasi hanya untuk KPI yang memang ada di program ini.
   const kpiIds=new Set((ada.kpi||[]).map((k:{id:string})=>k.id));
   const realisasi=Object.fromEntries(Object.entries(p.progress.realisasi).filter(([k])=>kpiIds.has(k)));
   ubah.progress=[...(ada.progress||[]),{id:uid('kj'),...p.progress,tanggal:p.progress.tanggal||kini().slice(0,10),realisasi,oleh,waktu:kini()}].slice(-500);
  }
  if(p.removeProgress)ubah.progress=(ubah.progress as unknown[]||ada.progress||[]).filter((x:any)=>x.id!==p.removeProgress);
  if(Object.keys(ubah).length===1)return json({error:'Tidak ada perubahan.'},400);
  const {data,error}=await db.from('yspi_programs').update(ubah).eq('id',p.id).select('id');
  fail(error);return data?.length?json({ok:true}):json({error:'Program tidak ditemukan.'},404);
 }
 return json({error:'Rute tidak ditemukan.'},404);
}
