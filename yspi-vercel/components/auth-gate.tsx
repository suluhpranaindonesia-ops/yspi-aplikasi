'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {authClient,authConfig} from '@/lib/supabase-client';
import type {Session} from '@supabase/supabase-js';

export function AuthGate({children}:{children:ReactNode}){
 const [state,setState]=useState('loading'),[mode,setMode]=useState('login'),[recovery,setRecovery]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let live=true,sequence=0,unsubscribe=()=>{};
  async function check(session:Session|null){
   const ticket=++sequence;
   if(!session){if(live)setState('guest');return;}
   try{const r=await fetch('/api/auth/me',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(live&&ticket===sequence){setState(r.ok?'member':r.status===403?'denied':r.status===401?'guest':'error');if(r.ok&&new URLSearchParams(window.location.search).get('recovery')==='1')setRecovery(true);}}
   catch{if(live&&ticket===sequence)setState('error')}
  }
  (async()=>{try{
   const c=await authConfig();if(!live)return;if(!c.enabled||!c.ready){setState('setup');return;}
   const client=await authClient();if(!client)return;
   const {data}=client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'&&live)setRecovery(true);void check(session)});
   unsubscribe=()=>data.subscription.unsubscribe();
   const {data:{session}}=await client.auth.getSession();await check(session);
  }catch{if(live)setState('setup')}})();
  return()=>{live=false;unsubscribe()};
 },[]);
 async function signOut(){try{await(await authClient())?.auth.signOut()}finally{setPassword('');setConfirm('');setRecovery(false);setState('guest')}}
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setMessage('');
  try{
   const client=await authClient();if(!client)throw Error('Login belum tersedia.');
   if(recovery){if(password!==confirm)throw Error('Konfirmasi password belum sama.');const {error}=await client.auth.updateUser({password});if(error)throw error;setPassword('');setConfirm('');window.history.replaceState(null,'','/');setRecovery(false);setMessage('Password sudah diperbarui.');return;}
   if(mode==='login'){const {error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw Error('Login belum berhasil. Periksa email, password, dan verifikasi email Anda.');setPassword('');}
   if(mode==='signup'){if(password!==confirm)throw Error('Konfirmasi password belum sama.');const {error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin+'/auth/confirm'}});if(error)throw Error('Pendaftaran belum berhasil. Hubungi admin untuk memeriksa layanan email.');setPassword('');setConfirm('');setMessage('Jika pendaftaran diterima, periksa email untuk tautan verifikasi. Hanya pengurus yang disetujui dapat mengakses cerita.');}
   if(mode==='reset'){const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/auth/confirm?flow=recovery'});if(error)throw Error('Pengiriman belum berhasil. Hubungi admin untuk memeriksa layanan email.');setMessage('Jika akun terdaftar, petunjuk penggantian password akan dikirim ke email Anda.');}
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
 }
 if(state==='member'&&!recovery)return <><div className="session-bar"><span>Akses pengurus terverifikasi</span><button onClick={signOut}>Keluar</button></div>{children}</>;
 return <main className="auth-shell"><section className="auth-card"><img src="/logo-yspi.png" alt="Yayasan Suluh Prana Indonesia"/><p className="eyebrow">CERITA & PENCAPAIAN GURU</p><h1>{recovery?'Atur password baru':mode==='signup'?'Aktifkan akun pengurus':mode==='reset'?'Lupa password?':'Masuk ruang pengurus'}</h1>
 {state==='loading'?<p role="status">Memeriksa sesi…</p>:state==='setup'?<p role="alert">Login sedang disiapkan oleh administrator. Data cerita tidak dibuka untuk pengunjung.</p>:state==='error'?<><p role="alert">Koneksi belum tersedia. Silakan muat ulang halaman.</p><button className="secondary" onClick={()=>window.location.reload()}>Coba lagi</button></>:state==='denied'?<><p role="alert">Akun ini belum mendapat akses pengurus. Hubungi admin YSPI atau masuk dengan akun yang disetujui.</p><button className="secondary" onClick={signOut}>Ganti akun</button></>:<>
 <p className="muted">Gunakan email pengurus yang telah disetujui. Password ini khusus website YSPI, bukan password Gmail.</p>
 <form className="report-form" onSubmit={submit}>{!recovery&&<label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
 {(recovery||mode!=='reset')&&<label>Password<input type="password" autoComplete={recovery||mode==='signup'?'new-password':'current-password'} minLength={recovery||mode==='signup'?12:undefined} required value={password} onChange={e=>setPassword(e.target.value)}/></label>}
 {(recovery||mode==='signup')&&<label>Ulangi password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/><small>Minimal 12 karakter. Jangan gunakan password Gmail.</small></label>}
 <button className="primary" disabled={busy}>{busy?'Memproses…':recovery?'Simpan password':mode==='login'?'Masuk':mode==='signup'?'Kirim verifikasi email':'Kirim tautan reset'}</button></form>
 {!recovery&&<nav className="auth-links" aria-label="Pilihan login">{[['login','Sudah punya akun'],['signup','Aktifkan akun'],['reset','Lupa password']].filter(([key])=>key!==mode).map(([key,label])=><button key={key} onClick={()=>{setMode(key);setMessage('');setPassword('');setConfirm('')}}>{label}</button>)}</nav>}
 </>}{message&&<p className="auth-message" role="status">{message}</p>}</section></main>;
}
