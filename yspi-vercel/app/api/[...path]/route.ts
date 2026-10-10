import {supabaseEnabled,supabaseApi} from '@/lib/supabase-api';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(req:Request){
 if(!supabaseEnabled())return Response.json({error:'Penyambungan Supabase belum selesai.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return supabaseApi(req);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
export const DELETE=handle;
