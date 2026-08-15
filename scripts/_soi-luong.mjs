import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const env={}; for(const l of readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const U=env.NEXT_PUBLIC_SUPABASE_URL, REF=new URL(U).host.split('.')[0];
const admin=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const anon=createClient(U,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const phien=async(email)=>{const {data:g}=await admin.auth.admin.generateLink({type:'magiclink',email});
  const {data:v}=await anon.auth.verifyOtp({type:'email',token_hash:g.properties.hashed_token});
  return {tok:v.session.access_token,
    cli:createClient(U,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${v.session.access_token}`}}}),
    ck:`sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`};};

const {data:lop}=await admin.from('classes').select('id,name,homeroom_teacher_id').eq('name','Test').single();
const {data:gvp}=await admin.from('profiles').select('email').eq('id',lop.homeroom_teacher_id).single();
const {data:em}=await admin.from('enrollments').select('student_id').eq('class_id',lop.id).eq('is_active',true).order('student_id').limit(1).single();
const {data:hs}=await admin.from('profiles').select('email,full_name').eq('id',em.student_id).single();
const {data:t2}=await admin.rpc('vn_week_start'); const tuan=String(t2).slice(0,10);

const co=await phien(gvp.email);
const troEm=await phien(hs.email);

const {data:ckEm}=await admin.from('commitments').select('id,title,status').eq('student_id',em.student_id).eq('week_start',tuan);
const {data:lms}=await admin.from('lead_measures').select('id,title,target_value').in('commitment_id',(ckEm??[]).map(c=>c.id));
console.log('EM  :', hs.full_name, '| tuần', tuan);
console.log('      cam kết:', (ckEm??[]).map(c=>`${c.title} [${c.status}]`).join(' · ')||'(không)');
console.log('      việc   :', (lms??[]).map(l=>l.title).join(' · ')||'(không)');

const {data:board,error:e1}=await co.cli.rpc('class_lead_board',{p_class:lop.id,p_week_start:tuan});
console.log('CÔ  class_lead_board:', e1?('LỖI '+e1.message):`${(board??[]).length} việc — `+(board??[]).map(b=>b.title).join(' · '));
const {data:pdr,error:e2}=await co.cli.rpc('pdr_bang',{p_class:lop.id,p_week:tuan});
console.log('CÔ  pdr_bang       :', e2?('LỖI '+e2.message):`${(pdr??[]).length} dòng`);
const d=(pdr??[]).find(r=>r.student_id===em.student_id);
if(d) console.log('      dòng của em ấy:', JSON.stringify(d));
const {data:mt,error:e3}=await co.cli.rpc('class_tick_matrix',{p_class:lop.id,p_week_start:tuan});
console.log('CÔ  class_tick_matrix:', e3?('LỖI '+e3.message):`${(mt??[]).length} ô`);
