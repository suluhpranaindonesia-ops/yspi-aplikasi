import {createClient, type SupabaseClient} from '@supabase/supabase-js';
type Config={enabled:boolean;ready:boolean;url?:string;key?:string};
let configPromise:Promise<Config>|undefined;
let clientPromise:Promise<SupabaseClient|null>|undefined;
export function authConfig(){return configPromise??=fetch('/api/auth-config',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Pengaturan login belum tersedia');return r.json()})}
export function authClient(){return clientPromise??=authConfig().then(c=>{
 if(!c.enabled)return null;
 if(!c.ready||!c.url||!c.key)throw Error('Login sedang disiapkan oleh administrator.');
 return createClient(c.url,c.key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
})}
export async function authHeaders(){const client=await authClient();if(!client)return {};const {data:{session}}=await client.auth.getSession();return session?{Authorization:'Bearer '+session.access_token}:{};}
export async function authenticatedFetch(url:string,init:RequestInit={}){const headers=new Headers(init.headers);for(const [k,v] of Object.entries(await authHeaders()))headers.set(k,v);return fetch(url,{...init,headers,cache:'no-store'});}
