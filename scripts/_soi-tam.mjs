import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const env={}; for(const l of readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const U=env.NEXT_PUBLIC_SUPABASE_URL, REF=new URL(U).host.split('.')[0];
const admin=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const anon=createClient(U,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const BASE='https://class.vietanh.org';
const ckCua=async(email)=>{const {data:g}=await admin.auth.admin.generateLink({type:'magiclink',email});
  const {data:v}=await anon.auth.verifyOtp({type:'email',token_hash:g.properties.hashed_token});
  return `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;};
const {data:lop}=await admin.from('classes').select('id,homeroom_teacher_id').eq('name','Test').single();
const {data:gv}=await admin.from('profiles').select('email').eq('id',lop.homeroom_teacher_id).single();
const {data:em}=await admin.from('enrollments').select('student_id').eq('class_id',lop.id).eq('is_active',true).limit(1).single();
const {data:hs}=await admin.from('profiles').select('email').eq('id',em.student_id).single();
const goi=JSON.parse(readFileSync('messages/vi.json','utf8')).meeting;

const t=await fetch(`${BASE}/wig/hop?class=${lop.id}`,{headers:{cookie:await ckCua(gv.email)}});
const th=(await t.text()).replace(/<script[\s\S]*?<\/script>/gi,'');
console.log('— MÀN CÔ —');
for(const k of ['roomStart','roomOpen','roomClosedHint']) if(goi[k]) console.log('  ',k,'::',th.includes(goi[k].split('{')[0].trim())?'HIỆN':'không');

const s=await fetch(`${BASE}/student`,{headers:{cookie:await ckCua(hs.email)}});
const sh=(await s.text()).replace(/<script[\s\S]*?<\/script>/gi,'');
console.log('— MÀN EM —  HTTP',s.status);
for(const k of ['roomInvite','roomJoin']) if(goi[k]) console.log('  ',k,'::',sh.includes(goi[k].split('{')[0].trim())?'HIỆN':'KHÔNG HIỆN');

const {data:rows}=await admin.from('wig_meetings').select('week_label,mo_luc,chot_at').eq('class_id',lop.id).is('student_id',null).order('week_label',{ascending:false}).limit(3);
console.log('— CSDL —', JSON.stringify(rows));
