'use client';
import {useEffect,useState} from 'react';
import {authenticatedFetch} from '@/lib/supabase-client';
import {ClipboardList,Plus,Search,ArrowUpRight,CheckCircle2,Send,RotateCcw,Archive,Target,CalendarDays,Wallet,Trash2,Pencil,LineChart} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {toast} from 'sonner';

// Program kerja guru: POAC + KPI, seperti menu Program kerja di web HT POUK.
// Disimpan di tabel yspi_programs (migrasi 008). Diisi pengurus lewat website.
type Kpi={id:string;indikator:string;satuan:string;target:number|null};
type Kemajuan={id:string;tanggal:string;kegiatan:string;realisasi:Record<string,number>;catatan:string;oleh:string;waktu:string};
type Riwayat={waktu:string;status:string;catatan:string;oleh:string};
type Program={id:string;teacher_name:string;teacher_phone:string;school:string;region:string;name:string;goal:string;audience:string;plan:string;organize:string;actuate:string;control:string;resources:string;budget:number|null;start_date:string|null;end_date:string|null;kpi:Kpi[];progress:Kemajuan[];status:string;review_note:string;history:Riwayat[];updated_at:string};
export type GuruProgram={name:string;phone:string;school:string;region:string};
const LABEL:Record<string,[string,string]>={draf:['Draf','badge'],dikirim:['Menunggu persetujuan YSPI','badge amber'],disetujui:['Disetujui','badge green'],revisi:['Perlu revisi','badge red']};
const POAC=[['plan','Plan (perencanaan)','Langkah dan jadwal kegiatan yang akan dilakukan'],['organize','Organize (pengorganisasian)','Siapa terlibat dan apa perannya'],['actuate','Actuate (pelaksanaan)','Bagaimana program dijalankan'],['control','Control (pengawasan)','Bagaimana kemajuan dipantau dan dievaluasi']] as const;
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const tgl=(s?:string|null)=>s?new Date(s+(s.length===10?'T00:00:00':'')).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';
const hariIni=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
async function api(url:string,body?:unknown,method='POST'):Promise<any>{const r=await authenticatedFetch(url,body===undefined?{cache:'no-store'}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json();if(!r.ok)throw Error(d.error||'Permintaan belum berhasil');return d;}
// Realisasi KPI = angka pada catatan kemajuan terbaru yang menyebut KPI itu (seperti web HT).
function realisasiTerakhir(p:Program,kpiId:string){const l=[...(p.progress||[])].sort((a,b)=>(b.tanggal+b.waktu).localeCompare(a.tanggal+a.waktu)).find(x=>x.realisasi?.[kpiId]!=null);return l?{nilai:l.realisasi[kpiId],tanggal:l.tanggal}:null}
const kosong=()=>({id:'',teacher_name:'',teacher_phone:'',school:'',region:'',name:'',goal:'',audience:'',plan:'',organize:'',actuate:'',control:'',resources:'',budget:'',start_date:'',end_date:''});

export function ProgramKerja({guru}:{guru:GuruProgram[]}){
 const [items,setItems]=useState<Program[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('semua');
 const [lihat,setLihat]=useState<string|null>(null),[formOpen,setFormOpen]=useState(false),[form,setForm]=useState<Record<string,string>>(kosong),[kpi,setKpi]=useState<{id?:string;indikator:string;satuan:string;target:string}[]>([]),[saving,setSaving]=useState(false);
 const [catat,setCatat]=useState<Program|null>(null),[kj,setKj]=useState<{tanggal:string;kegiatan:string;catatan:string;realisasi:Record<string,string>}>({tanggal:hariIni(),kegiatan:'',catatan:'',realisasi:{}});
 const [catatanStatus,setCatatanStatus]=useState(''),[arsipTanya,setArsipTanya]=useState(false);
 async function load(){try{const d=await api('/api/programs');setItems(d.programs);setError('')}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{load();const i=setInterval(load,30000);return()=>clearInterval(i)},[]);
 useEffect(()=>{setCatatanStatus('');setArsipTanya(false)},[lihat]);
 const dipilih=items.find(p=>p.id===lihat)||null;
 const cocok=(p:Program)=>(filter==='semua'||p.status===filter)&&[p.name,p.teacher_name,p.school,p.region,p.goal].join(' ').toLowerCase().includes(query.toLowerCase());
 const tampil=items.filter(cocok),hitung=(s:string)=>items.filter(p=>p.status===s).length;
 const namaGuru=[...new Map(guru.filter(g=>g.name).map(g=>[g.name.toLowerCase(),g])).values()];

 function bukaForm(p?:Program){
  setForm(p?{id:p.id,teacher_name:p.teacher_name,teacher_phone:p.teacher_phone,school:p.school,region:p.region,name:p.name,goal:p.goal,audience:p.audience,plan:p.plan,organize:p.organize,actuate:p.actuate,control:p.control,resources:p.resources,budget:p.budget==null?'':String(p.budget),start_date:p.start_date||'',end_date:p.end_date||''}:kosong());
  const ada=(p?.kpi||[]).map(k=>({id:k.id,indikator:k.indikator,satuan:k.satuan,target:k.target==null?'':String(k.target)}));
  setKpi([...ada,...Array(Math.max(1,3-ada.length)).fill(0).map(()=>({indikator:'',satuan:'',target:''}))]);
  setLihat(null);setFormOpen(true);
 }
 // Nama guru dari cerita: sekolah & wilayah ikut terisi bila masih kosong.
 function pilihGuru(nama:string){const g=namaGuru.find(x=>x.name.toLowerCase()===nama.trim().toLowerCase());setForm(f=>({...f,teacher_name:nama,...(g?{teacher_phone:f.teacher_phone||g.phone||'',school:f.school||g.school||'',region:f.region||g.region||''}:{})}))}
 async function simpan(e:React.FormEvent){e.preventDefault();setSaving(true);try{
  const angka=(v:string)=>v.trim()===''?null:Number(v.replace(/\./g,'').replace(',','.'));
  const {id,budget,...isi}=form;
  if(budget.trim()&&!Number.isFinite(angka(budget)))throw Error('Anggaran harus berupa angka.');
  const d=await api('/api/programs',{...isi,id:id||null,budget:angka(budget),kpi:kpi.filter(k=>k.indikator.trim()).map(k=>({id:k.id,indikator:k.indikator,satuan:k.satuan,target:angka(k.target)}))});
  setFormOpen(false);await load();setLihat(d.id);toast.success(id?'Program kerja diperbarui':'Program kerja tersimpan sebagai draf');
 }catch(e){toast.error((e as Error).message)}finally{setSaving(false)}}
 async function ubah(p:Program,changes:object,pesan:string){try{await api('/api/programs',{id:p.id,...changes},'PATCH');await load();toast.success(pesan)}catch(e){toast.error((e as Error).message)}}
 function bukaCatat(p:Program){setKj({tanggal:hariIni(),kegiatan:'',catatan:'',realisasi:{}});setCatat(p)}
 async function simpanKemajuan(e:React.FormEvent){e.preventDefault();if(!catat)return;setSaving(true);try{
  const realisasi=Object.fromEntries(Object.entries(kj.realisasi).filter(([,v])=>v.trim()!=='').map(([k,v])=>[k,Number(v.replace(',','.'))]));
  if(Object.values(realisasi).some(v=>!Number.isFinite(v)||v<0))throw Error('Realisasi KPI harus angka 0 atau lebih.');
  await api('/api/programs',{id:catat.id,progress:{tanggal:kj.tanggal,kegiatan:kj.kegiatan,catatan:kj.catatan,realisasi}},'PATCH');
  const id=catat.id;setCatat(null);await load();setLihat(id);toast.success('Kemajuan program tercatat');
 }catch(e){toast.error((e as Error).message)}finally{setSaving(false)}}

 const kpiTabel=(p:Program)=>p.kpi?.length?<table className="program-kpi"><thead><tr><th>KPI</th><th>Target</th><th>Realisasi terakhir</th><th>Capaian</th></tr></thead><tbody>{p.kpi.map(k=>{const r=realisasiTerakhir(p,k.id);const pct=r&&k.target?Math.min(100,Math.round(r.nilai/k.target*100)):null;return <tr key={k.id}><td>{k.indikator}</td><td>{k.target??'—'} {k.satuan}</td><td>{r?<>{r.nilai} {k.satuan} <small>({tgl(r.tanggal)})</small></>:<small>belum ada catatan</small>}</td><td>{pct==null?'—':<span className="program-bar"><progress value={pct} max={100} aria-label={'Capaian '+k.indikator}/>{pct}%</span>}</td></tr>})}</tbody></table>:<p className="muted">KPI belum ditetapkan.</p>;

 return <div className="program-space">
  <section className="growth-intro"><div><p className="eyebrow">PROGRAM KERJA GURU</p><h2>Rencana yang jelas, kemajuan yang terukur.</h2><p>Setiap program disusun dengan POAC (Plan, Organize, Actuate, Control) dan KPI. Program dikirim ke YSPI untuk disetujui, lalu kemajuannya dicatat per kegiatan.</p></div><ClipboardList size={42}/></section>
  <div className="stats">{[['Program aktif',items.length,'Semua program yang belum diarsipkan',ClipboardList],['Menunggu persetujuan',hitung('dikirim'),'Sudah dikirim ke YSPI',Send],['Disetujui',hitung('disetujui'),'Siap dijalankan & dipantau',CheckCircle2],['Perlu revisi',hitung('revisi'),'Dikembalikan dengan catatan',RotateCcw]].map(([label,n,note,Icon]:any,i)=><article className={'stat '+(i===1?'featured':'')} key={label}><span>{label}</span><div>{String(n).padStart(2,'0')}<Icon/></div><small>{note}</small></article>)}</div>
  <div className="toolbar"><Tabs value={filter} onValueChange={setFilter}><TabsList><TabsTrigger value="semua">Semua</TabsTrigger><TabsTrigger value="draf">Draf</TabsTrigger><TabsTrigger value="dikirim">Menunggu</TabsTrigger><TabsTrigger value="disetujui">Disetujui</TabsTrigger><TabsTrigger value="revisi">Revisi</TabsTrigger></TabsList></Tabs><div className="toolbar-right"><label className="search"><Search size={17}/><input aria-label="Cari program" placeholder="Cari program, guru, sekolah…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="primary" onClick={()=>bukaForm()}><Plus size={18}/>Program baru</button></div></div>
  {error&&<div className="error" role="alert">{error}<button onClick={load}>Coba lagi</button></div>}
  {!error&&!tampil.length&&<section className="panel"><div className="empty"><ClipboardList size={30}/><h3>{loading?'Memuat program kerja…':query||filter!=='semua'?'Tidak ada program yang cocok':'Belum ada program kerja'}</h3><p>{query||filter!=='semua'?'Coba kata pencarian atau status lain.':'Tambahkan program kerja guru beserta POAC dan KPI-nya.'}</p><button className="secondary" onClick={()=>bukaForm()}><Plus size={16}/>Program baru</button></div></section>}
  <div className="growth-plans">{tampil.map(p=>{const [label,cls]=LABEL[p.status]||[p.status,'badge'];return <article className="panel growth-plan program-card" key={p.id}>
   <header><div><small>{p.teacher_name}{p.school&&' · '+p.school}</small><h2>{p.name}</h2></div><span className={cls}>{label}</span></header>
   <div className="growth-meta"><span><CalendarDays size={16}/>{p.start_date||p.end_date?tgl(p.start_date)+' – '+tgl(p.end_date):'Periode belum diisi'}</span><span><Target size={16}/>{p.kpi?.length||0} KPI</span><span><LineChart size={16}/>{p.progress?.length||0} catatan kemajuan</span>{p.budget!=null&&<span><Wallet size={16}/>{money(p.budget)}</span>}</div>
   {p.goal&&<p className="program-goal">{p.goal}</p>}
   {kpiTabel(p)}
   {p.status==='revisi'&&p.review_note&&<div className="growth-feedback"><strong>Catatan revisi YSPI</strong><p>{p.review_note}</p></div>}
   <div className="dialog-actions program-actions"><button className="secondary" onClick={()=>bukaCatat(p)}><LineChart size={16}/>Catat kemajuan</button><button className="primary" onClick={()=>setLihat(p.id)}>Rincian <ArrowUpRight size={16}/></button></div>
  </article>})}</div>
  <p className="muted">Realisasi KPI diambil dari catatan kemajuan terbaru yang menyebut angka KPI itu. Angka yang tidak dicatat tidak diasumsikan. Program tidak pernah dihapus, hanya diarsipkan.</p>

  <Dialog open={!!dipilih} onOpenChange={v=>!v&&setLihat(null)}><DialogContent className="report-dialog sm:max-w-3xl">{dipilih&&<><DialogHeader><DialogTitle>{dipilih.name}</DialogTitle><DialogDescription>{dipilih.teacher_name}{dipilih.school&&' · '+dipilih.school}{dipilih.region&&' · '+dipilih.region}</DialogDescription></DialogHeader><div className="report-document">
   <span className={(LABEL[dipilih.status]||['','badge'])[1]}>{(LABEL[dipilih.status]||[dipilih.status])[0]}</span>
   <div className="report-meta"><span>{dipilih.start_date||dipilih.end_date?tgl(dipilih.start_date)+' – '+tgl(dipilih.end_date):'Periode belum diisi'}</span><span>Anggaran: {dipilih.budget==null?'belum disebutkan':money(dipilih.budget)}</span></div>
   {[['goal','Tujuan'],['audience','Sasaran / peserta'],...POAC.map(([k,l])=>[k,l]),['resources','Sumber daya']].map(([k,l])=><section key={k}><h3>{l}</h3><p style={{whiteSpace:'pre-line'}}>{(dipilih as any)[k]||'Belum diisi'}</p></section>)}
   <section><h3>KPI</h3>{kpiTabel(dipilih)}</section>
   <section><h3>Catatan kemajuan</h3>{dipilih.progress?.length?<ol className="program-log">{[...dipilih.progress].sort((a,b)=>(b.tanggal+b.waktu).localeCompare(a.tanggal+a.waktu)).map(l=><li key={l.id}><div><strong>{tgl(l.tanggal)}</strong> · {l.kegiatan}{Object.keys(l.realisasi||{}).length>0&&<small>{dipilih.kpi.filter(k=>l.realisasi[k.id]!=null).map(k=>k.indikator+': '+l.realisasi[k.id]+' '+k.satuan).join(' · ')}</small>}{l.catatan&&<small>{l.catatan}</small>}<small>Dicatat {l.oleh}</small></div><button className="icon-button" aria-label="Hapus catatan kemajuan ini" title="Hapus catatan ini" onClick={()=>{if(confirm('Hapus catatan kemajuan tanggal '+tgl(l.tanggal)+'?'))ubah(dipilih,{removeProgress:l.id},'Catatan kemajuan dihapus')}}><Trash2 size={16}/></button></li>)}</ol>:<p>Belum ada catatan kemajuan.</p>}</section>
   {dipilih.history?.length>0&&<details><summary>Riwayat persetujuan ({dipilih.history.length})</summary>{[...dipilih.history].reverse().map((h,i)=><p key={i}><small>{new Date(h.waktu).toLocaleString('id-ID')} · {(LABEL[h.status]||[h.status])[0]} · {h.oleh}</small>{h.catatan&&<><br/>{h.catatan}</>}</p>)}</details>}
   {(dipilih.status==='dikirim'||dipilih.status==='disetujui'||dipilih.status==='revisi')&&<label className="program-note">Catatan YSPI (wajib untuk minta revisi)<textarea rows={2} value={catatanStatus} onChange={e=>setCatatanStatus(e.target.value)} placeholder="Mis. KPI kedua perlu angka target yang jelas."/></label>}
   <div className="dialog-actions">
    <button className="secondary" onClick={()=>bukaForm(dipilih)}><Pencil size={16}/>Edit program</button>
    <button className="secondary" onClick={()=>{const p=dipilih;setLihat(null);bukaCatat(p)}}><LineChart size={16}/>Catat kemajuan</button>
    {(dipilih.status==='draf'||dipilih.status==='revisi')&&<button className="primary" onClick={()=>ubah(dipilih,{status:'dikirim',note:''},'Program dikirim ke YSPI')}><Send size={16}/>Kirim ke YSPI</button>}
    {dipilih.status!=='disetujui'&&dipilih.status!=='draf'&&<button className="primary" onClick={()=>ubah(dipilih,{status:'disetujui',note:catatanStatus},'Program disetujui')}><CheckCircle2 size={16}/>Setujui</button>}
    {dipilih.status!=='revisi'&&dipilih.status!=='draf'&&<button className="secondary" onClick={()=>{if(!catatanStatus.trim()){toast.error('Tulis catatan revisi untuk guru.');return}ubah(dipilih,{status:'revisi',note:catatanStatus},'Program dikembalikan untuk revisi')}}><RotateCcw size={16}/>Minta revisi</button>}
    {!arsipTanya&&<button className="secondary danger" onClick={()=>setArsipTanya(true)}><Archive size={16}/>Arsipkan</button>}
   </div>
   {arsipTanya&&<div className="delete-confirm" role="alert"><p><strong>Arsipkan program ini?</strong> Program hilang dari daftar tetapi tetap tersimpan di database.</p><div className="dialog-actions"><button className="secondary" onClick={()=>setArsipTanya(false)}>Batal</button><button className="primary" onClick={async()=>{await ubah(dipilih,{archived:true},'Program diarsipkan');setLihat(null)}}><Archive size={16}/>Ya, arsipkan</button></div></div>}
  </div></>}</DialogContent></Dialog>

  <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="report-dialog sm:max-w-3xl"><DialogHeader><DialogTitle>{form.id?'Edit program kerja':'Program kerja baru'}</DialogTitle><DialogDescription>Kolom bertanda * wajib diisi. Program baru tersimpan sebagai draf, lalu dikirim ke YSPI untuk disetujui.</DialogDescription></DialogHeader>
   <form onSubmit={simpan} className="report-form">
    <div className="form-grid">
     <label>Nama guru *<input required list="program-guru" value={form.teacher_name} onChange={e=>pilihGuru(e.target.value)}/><datalist id="program-guru">{namaGuru.map(g=><option key={g.name} value={g.name}>{g.school}</option>)}</datalist></label>
     <label>Sekolah<input value={form.school} onChange={e=>setForm({...form,school:e.target.value})}/></label>
     <label>Wilayah<input value={form.region} onChange={e=>setForm({...form,region:e.target.value})}/></label>
     <label>Nama program *<input required maxLength={200} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
     <label>Mulai<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label>
     <label>Selesai<input type="date" min={form.start_date||undefined} value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label>
     <label>Anggaran (Rp)<input inputMode="numeric" value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})} placeholder="Kosongkan bila belum ada"/></label>
     <label>Sasaran / peserta<input value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})} placeholder="Mis. siswa kelas 4–6"/></label>
    </div>
    <label>Tujuan program<textarea rows={2} value={form.goal} onChange={e=>setForm({...form,goal:e.target.value})}/></label>
    {POAC.map(([k,l,hint])=><label key={k}>{l}<textarea rows={2} placeholder={hint} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
    <label>Sumber daya<textarea rows={2} placeholder="Orang, bahan, tempat, alat yang dibutuhkan" value={form.resources} onChange={e=>setForm({...form,resources:e.target.value})}/></label>
    <fieldset className="program-kpi-form"><legend>KPI (indikator · target · satuan)</legend>{kpi.map((k,i)=><div key={k.id||i}><input aria-label={'Indikator KPI '+(i+1)} placeholder="Indikator, mis. siswa hadir per pertemuan" value={k.indikator} onChange={e=>setKpi(kpi.map((x,j)=>j===i?{...x,indikator:e.target.value}:x))}/><input aria-label={'Target KPI '+(i+1)} inputMode="decimal" placeholder="Target" value={k.target} onChange={e=>setKpi(kpi.map((x,j)=>j===i?{...x,target:e.target.value}:x))}/><input aria-label={'Satuan KPI '+(i+1)} placeholder="Satuan" value={k.satuan} onChange={e=>setKpi(kpi.map((x,j)=>j===i?{...x,satuan:e.target.value}:x))}/></div>)}{kpi.length<10&&<button type="button" className="text-button" onClick={()=>setKpi([...kpi,{indikator:'',satuan:'',target:''}])}><Plus size={15}/>Tambah KPI</button>}<small>Mengosongkan indikator menghapus KPI itu dari program.</small></fieldset>
    <button className="primary" disabled={saving}>{saving?'Menyimpan…':form.id?'Simpan perubahan':'Simpan sebagai draf'}</button>
   </form></DialogContent></Dialog>

  <Dialog open={!!catat} onOpenChange={v=>!v&&setCatat(null)}><DialogContent className="report-dialog sm:max-w-2xl">{catat&&<><DialogHeader><DialogTitle>Catat kemajuan program</DialogTitle><DialogDescription>{catat.name} · {catat.teacher_name}. Satu catatan untuk satu kegiatan, bertanggal.</DialogDescription></DialogHeader>
   <form onSubmit={simpanKemajuan} className="report-form">
    <label>Tanggal kegiatan *<input type="date" required value={kj.tanggal} onChange={e=>setKj({...kj,tanggal:e.target.value})}/></label>
    <label>Kegiatan yang dilakukan *<textarea rows={3} required value={kj.kegiatan} onChange={e=>setKj({...kj,kegiatan:e.target.value})}/></label>
    {catat.kpi?.length?<div className="form-grid">{catat.kpi.map(k=><label key={k.id}>{k.indikator} (target {k.target??'—'} {k.satuan})<input inputMode="decimal" placeholder="Kosongkan bila tidak diukur" value={kj.realisasi[k.id]||''} onChange={e=>setKj({...kj,realisasi:{...kj.realisasi,[k.id]:e.target.value}})}/></label>)}</div>:<p className="muted">Program ini belum punya KPI. Tambahkan lewat Edit program.</p>}
    <label>Catatan (dampak, kendala, rencana berikutnya)<textarea rows={2} value={kj.catatan} onChange={e=>setKj({...kj,catatan:e.target.value})}/></label>
    <button className="primary" disabled={saving}>{saving?'Menyimpan…':'Simpan catatan kemajuan'}</button>
   </form></>}</DialogContent></Dialog>
 </div>;
}
