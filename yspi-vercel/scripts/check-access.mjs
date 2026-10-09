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
