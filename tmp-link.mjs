import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const env={};for(const l of readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.argv[2]});
if(error){console.log('LỖI:',error.message);process.exit(1);}
console.log(`https://class.vietanh.org/vi/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`);
