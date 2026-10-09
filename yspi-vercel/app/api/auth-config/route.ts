import {supabaseEnvironment} from '@/lib/supabase-environment';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export function GET(){
 const e=supabaseEnvironment(),enabled=e.YSPI_AUTH_MODE==='supabase';
 const ready=enabled&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(String(e.SUPABASE_URL))&&typeof e.SUPABASE_PUBLISHABLE_KEY==='string'&&e.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');
 return Response.json({enabled,ready,...(ready?{url:e.SUPABASE_URL,key:e.SUPABASE_PUBLISHABLE_KEY}:{})},{headers:{'Cache-Control':'no-store'}});
}
