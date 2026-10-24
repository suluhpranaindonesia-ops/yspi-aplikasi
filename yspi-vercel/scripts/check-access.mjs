import assert from 'node:assert/strict';
const origin=process.env.CHECK_ORIGIN||'http://localhost:5174';
const read=path=>fetch(origin+path,{signal:AbortSignal.timeout(15000)});
const page=await read('/');assert.equal(page.status,200);
assert.match(page.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
const cfg=await (await read('/api/auth-config')).json();
assert.equal(cfg.enabled,true);assert.equal(cfg.ready,true);
assert.equal(cfg.url,'https://qpqpvktvezdqzdcpueve.supabase.co');
assert.ok(cfg.key.startsWith('sb_publishable_'));
console.log('PASS page, security headers, new Supabase project');
for(const path of ['/api/reports','/api/growth','/api/auth/me','/api/jobs/11111111-1111-4111-8111-111111111111','/api/media/test']){
 assert.equal((await read(path)).status,401,path);console.log('PASS anonymous denied',path);
}
assert.equal((await fetch(origin+'/api/reports',{headers:{Authorization:'Bearer invalid-token'}})).status,401);
assert.equal((await fetch(origin+'/api/reports',{method:'POST',headers:{Origin:'https://outside.example.invalid',Authorization:'Bearer invalid-token','Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await fetch(origin+'/api/bridge/heartbeat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,401);
for(const t of ['yspi_reports','yspi_members','yspi_media','yspi_growth_plans','yspi_growth_events']){
 const r=await fetch(cfg.url+'/rest/v1/'+t+'?select=*&limit=0',{headers:{apikey:cfg.key},signal:AbortSignal.timeout(15000)});
 assert.ok([401,403].includes(r.status),t);console.log('PASS anonymous Supabase denied',t);
}
console.log('PASS invalid-token, cross-origin and old-bridge protection. No accounts or data changed.');

// Kasus paling berbahaya: pengguna yang SUDAH login tetapi BUKAN member. Karena klien memakai
// publishable key + JWT pengguna, orang seperti ini bisa memukul Supabase REST/Storage LANGSUNG,
// melewati gerbang yspi_members di API Next.js. RLS harus tetap menolaknya (bukan sekadar cek
// "authenticated"). Beri JWT akun non-member lewat env CHECK_NONMEMBER_JWT untuk menguji.
// Buat akunnya sendiri (jangan di sini) — skrip ini tidak pernah membuat/mengubah akun.
const jwt=process.env.CHECK_NONMEMBER_JWT;
if(!jwt){
 console.log('SKIP non-member test (set CHECK_NONMEMBER_JWT ke JWT akun login yang BUKAN pengurus untuk mengujinya)');
}else{
 const h={apikey:cfg.key,Authorization:'Bearer '+jwt};
 for(const t of ['yspi_reports','yspi_members','yspi_media','yspi_growth_plans','yspi_growth_events','yspi_jobs']){
  const r=await fetch(cfg.url+'/rest/v1/'+t+'?select=*&limit=1',{headers:h,signal:AbortSignal.timeout(15000)});
  // Aman: ditolak (401/403) ATAU 200 dengan nol baris (RLS menyaring). Bocor: 200 dengan baris.
  let aman=[401,403].includes(r.status);
  if(r.status===200){const b=await r.json().catch(()=>null);aman=Array.isArray(b)&&b.length===0;}
  assert.ok(aman,`BOCOR: non-member bisa membaca ${t} (status ${r.status}). RLS harus membatasi ke member aktif, bukan sekadar authenticated.`);
  console.log('PASS non-member denied',t);
 }
 // Storage: daftar & unduh objek bucket media harus ditolak untuk non-member.
 const s=await fetch(cfg.url+'/storage/v1/object/list/yspi-media',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:1}),signal:AbortSignal.timeout(15000)});
 let amanS=[401,403].includes(s.status);
 if(s.status===200){const b=await s.json().catch(()=>null);amanS=Array.isArray(b)&&b.length===0;}
 assert.ok(amanS,`BOCOR: non-member bisa melihat objek Storage yspi-media (status ${s.status}).`);
 console.log('PASS non-member denied storage yspi-media');
 console.log('PASS non-member cannot reach Supabase data directly. No accounts or data changed.');
}
