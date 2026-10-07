// Read-only/unauthenticated checks against the local preview. No accounts created.
import assert from 'node:assert/strict';
const origin='http://localhost:5173';
const config=await fetch(origin+'/api/auth-config').then(r=>r.json());
assert.equal(config.enabled,true);assert.equal(config.ready,true);
assert.ok(config.key.startsWith('sb_publishable_'));
assert.match(config.url,/^https:\/\/[a-z0-9]{20}\.supabase\.co$/);
for(const route of ['/api/reports','/api/growth','/api/growth/test','/api/jobs/11111111-1111-4111-8111-111111111111','/api/media/test','/api/auth/me']){
 const response=await fetch(origin+route);assert.equal(response.status,401,route);console.log('PASS anonymous blocked:',route);
}
const forged=await fetch(origin+'/api/reports',{headers:{Authorization:'Bearer invalid-token'}});
assert.equal(forged.status,401);console.log('PASS forged token blocked');
const crossOrigin=await fetch(origin+'/api/reports',{method:'POST',headers:{Authorization:'Bearer invalid-token',Origin:'https://outside.example.invalid','Content-Type':'application/json'},body:'{}'});
assert.equal(crossOrigin.status,403);console.log('PASS cross-origin write blocked');
const oldBridge=await fetch(origin+'/api/bridge/heartbeat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
assert.equal(oldBridge.status,401);console.log('PASS legacy bridge cannot bypass Supabase auth');
const anonCloud=await fetch(config.url+'/rest/v1/yspi_reports?select=id&limit=1',{headers:{apikey:config.key}});
assert.ok([401,403].includes(anonCloud.status));console.log('PASS anonymous cloud report read denied');
console.log('PASS: public configuration and 10 access-denial checks; no signed-in end-to-end claim.');
