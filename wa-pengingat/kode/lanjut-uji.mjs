// One-off recovery of the failed local decision, bound to its original snapshot.
import fs from 'node:fs';
import path from 'node:path';
import {daily,DIR,BRIDGE,readTracker,hashTracker,dateWIB,TRACKER} from './lokal-lengkap.mjs';
const now=new Date(),date=dateWIB(now),output=path.join(BRIDGE,'pengingat');
const previous=JSON.parse(fs.readFileSync(path.join(output,`bahan-${date}-pagi.json`),'utf8'));
const snapshot=readTracker();
if(snapshot.sha256!==previous.sha256)throw Error('Tracker changed; cached decision is stale.');
const initial=JSON.parse(fs.readFileSync(path.join(DIR,'keputusan-model-terakhir.json'),'utf8'));
if(initial.metrics.model!=='qwen3:8b'||initial.metrics.done_reason!=='stop')throw Error('Invalid local model response.');
const result=await daily('qwen3:8b',snapshot.items,'perorang',now,console.log,initial);
if(hashTracker()!==snapshot.sha256)throw Error('Tracker changed while generating.');
const stem=`pesan-${date}-pagi-uji-perorang`;
fs.writeFileSync(path.join(output,stem+'.md'),result.text);
fs.writeFileSync(path.join(output,stem+'.audit.json'),JSON.stringify({mode:'perorang',source:TRACKER,sha256Before:snapshot.sha256,sha256After:hashTracker(),...result,generatedAt:now.toISOString()},null,2));
console.log(`UJI SUKSES: ${result.value.aktif.length} aktif, ${result.text.length} karakter, Excel tidak berubah. Tidak dikirim.`);
