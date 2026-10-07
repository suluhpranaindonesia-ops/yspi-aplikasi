import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export function GET(){const e=env as any,enabled=e.YSPI_AUTH_MODE==='supabase';const ready=enabled&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(String(e.SUPABASE_URL))&&typeof e.SUPABASE_PUBLISHABLE_KEY==='string'&&e.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');return Response.json({enabled,ready,...(ready?{url:e.SUPABASE_URL,key:e.SUPABASE_PUBLISHABLE_KEY}:{})},{headers:{'Cache-Control':'no-store'}});}
