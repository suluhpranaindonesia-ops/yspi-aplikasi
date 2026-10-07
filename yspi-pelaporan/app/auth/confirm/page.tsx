'use client';
import {useEffect,useState} from 'react';
import {authClient} from '@/lib/supabase-client';
export default function Confirm(){
 const [error,setError]=useState('');
 useEffect(()=>{(async()=>{try{const client=await authClient();if(!client)throw Error('Login belum aktif.');const params=new URLSearchParams(window.location.search);const code=params.get('code');const {data:{session}}=await client.auth.getSession();if(!session&&code){const {error}=await client.auth.exchangeCodeForSession(code);if(error)throw error;}const result=await client.auth.getSession();if(!result.data.session)throw Error('Tautan sudah kedaluwarsa atau dibuka di browser berbeda. Minta tautan baru dari halaman login.');window.location.replace(params.get('flow')==='recovery'?'/?recovery=1':'/');}catch(e){setError((e as Error).message)}})()},[]);
 return <main className="auth-shell"><section className="auth-card"><img src="/logo-yspi.png" alt="YSPI"/><h1>Verifikasi akun</h1><p role="status">{error||'Memeriksa tautan verifikasi…'}</p>{error&&<a className="secondary" href="/">Kembali ke login</a>}</section></main>;
}
