import {test} from 'node:test';
import assert from 'node:assert/strict';
import {uploadMedia} from '../lib/upload-media.ts';
function mock({found=true,uploadError=null,insertError=null}={}){
 const calls=[];
 const client={
  from(table){
   if(table==='yspi_reports')return {
    select(){return this},eq(){return this},
    async maybeSingle(){return {data:found?{id:'report-1'}:null,error:null}},
   };
   return {async insert(row){calls.push(['insert',row]);return {error:insertError}}};
  },
  storage:{from(bucket){return {
   async upload(path,file,opts){calls.push(['upload',bucket,path,file.size,opts]);return {error:uploadError}},
  }}},
 };
 return {client,calls};
}
test('large permitted media uploads directly to private bucket with no overwrite',async()=>{
 const {client,calls}=mock();await uploadMedia(client,'report-1',new File([new Uint8Array(5*1024*1024)],'test.png',{type:'image/png'}));
 assert.equal(calls[0][1],'yspi-media');assert.equal(calls[0][3],5*1024*1024);assert.equal(calls[0][4].upsert,false);
 assert.equal(calls[1][1].path,calls[0][2]);assert.equal(calls[1][1].report_id,'report-1');
});
test('invalid type, oversized file and invalid report ID rejected before upload',async()=>{
 const {client,calls}=mock();
 await assert.rejects(uploadMedia(client,'report-1',new File(['x'],'bad.html',{type:'text/html'})));
 await assert.rejects(uploadMedia(client,'report-1',new File([new Uint8Array(15*1024*1024+1)],'big.png',{type:'image/png'})));
 await assert.rejects(uploadMedia(client,'../other',new File(['x'],'ok.png',{type:'image/png'})));
 assert.equal(calls.length,0);
});
test('unreadable report prevents upload',async()=>{const {client,calls}=mock({found:false});await assert.rejects(uploadMedia(client,'report-1',new File(['x'],'ok.png',{type:'image/png'})));assert.equal(calls.length,0)});
test('failed upload never inserts metadata',async()=>{const {client,calls}=mock({uploadError:{}});await assert.rejects(uploadMedia(client,'report-1',new File(['x'],'ok.png',{type:'image/png'})));assert.equal(calls.length,1)});
test('failed metadata is surfaced, no automatic duplicate upload',async()=>{const {client,calls}=mock({insertError:{}});await assert.rejects(uploadMedia(client,'report-1',new File(['x'],'ok.png',{type:'image/png'})),/Hubungi admin/);assert.equal(calls.length,2)});
