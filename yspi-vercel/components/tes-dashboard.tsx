'use client';
import {useEffect,useState} from 'react';
import {authenticatedFetch} from '@/lib/supabase-client';
import {ClipboardCheck,ArrowUpRight,RefreshCw} from 'lucide-react';

// Pretest & postest guru dari Pusat Tes YSPI (hanya baca). Satu kegiatan = satu lembar; semua sesi terlihat
// dalam satu layar. Nilai dihitung dari kunci dengan rumus yang sama seperti Pusat Tes (tes-pusat/tes.mjs).
type Soal={no:number;teks:string;kunci:string};
type Sesi={urut:number;judul:string;pemateri?:string;tanggal?:string;pre?:Soal[];post?:Soal[];kemampuan?:Record<string,string>};
type Lembar={id:string;sesi:number;jenis:'pre'|'post';pesertaId:string;pengirim?:{nomor?:string;namaWa?:string};namaLembar?:string;jawaban:Record<string,string>;status:string;chat?:string};
type Analisis={untukPembina?:string;untukPeserta?:string;waktu?:string;dikirim?:string};
type Kegiatan={id:string;nama:string;skorPerBenar?:number;pic?:{nama?:string};sesi:Sesi[];lembar:Lembar[];analisis:Record<string,Analisis>};
type Data={aktif:boolean;alasan?:string;linkPusat?:string;kegiatan?:Kegiatan[]};
const DIHITUNG=['terbaca','final'];
const rata=(a:number[])=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null;
const nGain=(p:number|null,q:number|null)=>p==null||q==null||p>=100?null:Math.round((q-p)/(100-p)*100)/100;
const kat=(g:number|null)=>g==null?'':g>=0.7?'tinggi':g>=0.3?'sedang':g>0?'rendah':'tidak naik';
const tgl=(s?:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';
const nomor=(n?:string)=>{let s=String(n||'').replace(/\D/g,'');if(s.startsWith('0'))s='62'+s.slice(1);else if(s.startsWith('8'))s='62'+s;return s};
function nilai(k:Kegiatan,l:Lembar){const s=k.sesi.find(x=>x.urut===l.sesi),q=(s?.[l.jenis])||[],per=Number(k.skorPerBenar)||10;return Math.round(q.filter(x=>l.jawaban?.[x.no]===x.kunci).length*per*10)/10}
function rekap(k:Kegiatan,s:Sesi){
 const hitung=k.lembar.filter(l=>l.sesi===s.urut&&DIHITUNG.includes(l.status)),pids=[...new Set(hitung.map(l=>l.pesertaId))];
 const ambil=(p:string,j:string)=>hitung.find(l=>l.pesertaId===p&&l.jenis===j);
 const pre:number[]=[],post:number[]=[],gain:number[]=[];
 for(const p of pids){const a=ambil(p,'pre'),b=ambil(p,'post');const na=a?nilai(k,a):null,nb=b?nilai(k,b):null;if(na!=null)pre.push(na);if(nb!=null)post.push(nb);const g=nGain(na,nb);if(g!=null)gain.push(g)}
 const butir=(s.pre||[]).map((q,i)=>{const persen=(j:'pre'|'post')=>{const ls=pids.map(p=>ambil(p,j)).filter(Boolean) as Lembar[];return ls.length?Math.round(ls.filter(l=>l.jawaban?.[q.no]===s[j]?.[i]?.kunci).length/ls.length*100):null};return {no:q.no,kemampuan:s.kemampuan?.[q.no]||'',pre:persen('pre'),post:persen('post')}});
 return {nPre:pre.length,nPost:post.length,rataPre:rata(pre),rataPost:rata(post),nGain:rata(gain),perluCek:k.lembar.filter(l=>l.sesi===s.urut&&l.status==='perlu-cek').length,butir};
}
const Batang=({v}:{v:number|null})=>v==null?<span className="muted-dash">—</span>:<span className="tes-batang"><i style={{width:v+'%'}}/>{v}%</span>;
export function TesDashboard({guru}:{guru:{phone:string;name:string}[]}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[kid,setKid]=useState(''),[sesi,setSesi]=useState(0);
 async function load(){try{const r=await authenticatedFetch('/api/tes',{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error||'Data belum tersedia');setData(d);setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load();const t=setInterval(load,60000);return()=>clearInterval(t)},[]);
 const namaGuru=new Map(guru.filter(g=>g.phone).map(g=>[nomor(g.phone),g.name]));
 const nama=(l:Lembar)=>namaGuru.get(l.pengirim?.nomor||'')||l.namaLembar||l.pengirim?.namaWa||l.pengirim?.nomor||l.pesertaId;
 const intro=<section className="growth-intro"><div><p className="eyebrow">PUSAT TES YSPI</p><h2>Pretest &amp; postest guru.</h2><p>Guru mengirim lembar lewat WhatsApp (grup kegiatan atau chat pribadi ke YSPI Agent): <strong>#pretest 2</strong> lalu foto, atau foto/jawaban saja saat sesi berlangsung. Agen hanya membalas tanda terima (tanpa nilai); foto dibaca model lokal dan dinilai dari kunci. Halaman ini hanya menampilkan.</p></div><ClipboardCheck size={42}/></section>;
 if(error)return <div className="growth-space">{intro}<p className="error" role="alert">{error}</p></div>;
 if(!data)return <div className="growth-space">{intro}<section className="panel empty"><ClipboardCheck/><h3>Memuat data Pusat Tes…</h3></section></div>;
 if(!data.aktif)return <div className="growth-space">{intro}<section className="panel empty"><ClipboardCheck/><h3>Pusat Tes belum tersambung</h3><p>{data.alasan}</p></section></div>;
 const ks=data.kegiatan||[];
 if(!ks.length)return <div className="growth-space">{intro}<section className="panel empty"><ClipboardCheck/><h3>Belum ada kegiatan guru</h3><p>Kegiatan program Guru dibuat di web Pusat Tes.</p>{data.linkPusat&&<a className="secondary" href={data.linkPusat} target="_blank" rel="noreferrer">Buka Pusat Tes <ArrowUpRight size={16}/></a>}</section></div>;
 const k=ks.find(x=>x.id===kid)||ks[0],rs=k.sesi.map(s=>({s,r:rekap(k,s)}));
 const pilih=rs.find(x=>x.s.urut===sesi)||rs.find(x=>x.r.nPre||x.r.nPost)||rs[0],an=k.analisis?.[k.id+'-s'+pilih.s.urut];
 const pids=[...new Set(k.lembar.map(l=>l.pesertaId))];
 const sel=(p:string,s:number,j:'pre'|'post')=>{const l=k.lembar.find(x=>x.pesertaId===p&&x.sesi===s&&x.jenis===j);if(!l)return <td className="tes-sel">—</td>;const ok=DIHITUNG.includes(l.status);return <td className="tes-sel"><span className={'badge '+(ok?'green':'amber')} title={l.status}>{ok?nilai(k,l):'?'}</span></td>};
 const link=data.linkPusat?data.linkPusat.replace(/\/$/,'')+'/#k='+encodeURIComponent(k.id):'';
 return <div className="growth-space">{intro}
 {ks.length>1&&<div className="tes-tabs" role="tablist">{ks.map(x=><button key={x.id} role="tab" aria-selected={x.id===k.id} className={x.id===k.id?'primary':'secondary'} onClick={()=>{setKid(x.id);setSesi(0)}}>{x.nama}</button>)}</div>}
 <section className="panel compact"><div className="panel-heading"><div><h2>{k.nama}</h2><p>{k.sesi.length} sesi{k.pic?.nama?' · PIC '+k.pic.nama:''} · {pids.length} guru mengirim lembar</p></div><span className="tes-aksi"><button className="secondary" onClick={load}><RefreshCw size={16}/>Muat ulang</button>{link&&<a className="secondary" href={link} target="_blank" rel="noreferrer">Buka di Pusat Tes <ArrowUpRight size={16}/></a>}</span></div>
 <div className="tes-sesi">{rs.map(({s,r})=><button key={s.urut} className={'tes-kartu'+(s.urut===pilih.s.urut?' aktif':'')} onClick={()=>setSesi(s.urut)}><small>Sesi {s.urut} · {tgl(s.tanggal)}</small><strong>{s.judul||'(tanpa judul)'}</strong>{s.pemateri&&<small>{s.pemateri}</small>}<div className="tes-angka"><span><b>{r.rataPre??'—'}</b><small>pre ({r.nPre})</small></span><span><b>{r.rataPost??'—'}</b><small>post ({r.nPost})</small></span><span><b>{r.nGain??'—'}</b><small>N-gain {kat(r.nGain)}</small></span></div>{!(s.pre||[]).length&&<span className="badge">belum ada kunci</span>}{r.perluCek>0&&<span className="badge amber">{r.perluCek} perlu dicek</span>}</button>)}</div></section>
 <section className="panel"><div className="panel-heading"><div><h2>Nilai per guru</h2><p>Hijau = dihitung · kuning ? = perlu dicek di Pusat Tes.</p></div></div>{pids.length?<div className="tes-gulir"><table className="tes-tabel"><thead><tr><th rowSpan={2}>Guru</th>{k.sesi.map(s=><th key={s.urut} colSpan={2} title={s.judul}>S{s.urut}</th>)}</tr><tr>{k.sesi.flatMap(s=>[<th key={s.urut+'p'}>pre</th>,<th key={s.urut+'q'}>post</th>])}</tr></thead><tbody>{pids.map(p=>{const l=k.lembar.find(x=>x.pesertaId===p)!;return <tr key={p}><th>{nama(l)}<small>{l.pengirim?.nomor||''}</small></th>{k.sesi.flatMap(s=>[<Sel key={s.urut+'p'} n={sel(p,s.urut,'pre')}/>,<Sel key={s.urut+'q'} n={sel(p,s.urut,'post')}/>])}</tr>})}</tbody></table></div>:<p className="muted" style={{padding:'0 25px'}}>Belum ada lembar.</p>}</section>
 <section className="panel compact"><div className="panel-heading"><div><h2>Sesi {pilih.s.urut}: {pilih.s.judul}</h2><p>Pemahaman per butir. Nomor yang sama di pre dan post mengukur kemampuan yang sama.</p></div></div>
 {pilih.r.butir.length?<div className="tes-gulir"><table className="tes-tabel"><thead><tr><th>No</th><th>Kemampuan yang diukur</th><th>% benar pre</th><th>% benar post</th><th/></tr></thead><tbody>{pilih.r.butir.map(b=><tr key={b.no}><td>{b.no}</td><td>{b.kemampuan}</td><td><Batang v={b.pre}/></td><td><Batang v={b.post}/></td><td>{b.post!=null&&(b.post<60||(b.pre!=null&&b.post<b.pre))&&<span className="badge red">perlu diulang</span>}</td></tr>)}</tbody></table></div>:<p className="muted">Sesi ini belum punya soal &amp; kunci.</p>}
 {an?<div className="tes-analisis"><div><h3>Untuk pembina</h3><p>{an.untukPembina||'—'}</p></div><div><h3>Untuk peserta</h3><p>{an.untukPeserta||'—'}</p></div><small>Analisis model lokal{an.waktu?' · '+new Date(an.waktu).toLocaleString('id-ID'):''}{an.dikirim?' · dikirim ke Daniel':''}</small></div>:<p className="muted">Analisis sesi ini belum dibuat (dibuat di Pusat Tes, atau otomatis pada hari sesi).</p>}</section>
 </div>;
}
const Sel=({n}:{n:React.ReactNode})=><>{n}</>;
