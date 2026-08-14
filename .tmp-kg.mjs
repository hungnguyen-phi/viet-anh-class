// Dựng một mục tiêu kg ĐO TRONG APP để xem dốc mốc + ô điền số chạy thật.
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const env={}; for(const l of readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const a=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:lop}=await a.from('classes').select('id').eq('name','Test').maybeSingle();
const {data:gv}=await a.from('profiles').select('id').eq('email','tunhien01@truongvietanh.com').maybeSingle();
// Dọn lần chạy trước nếu có
const {data:cu}=await a.from('wigs').select('id').eq('class_id',lop.id).eq('title','tăng cân (thử)');
for(const w of cu??[]) {
  const {data:th}=await a.from('wigs').select('id').eq('parent_wig_id',w.id);
  for(const t of th??[]){ const {data:tu}=await a.from('wigs').select('id').eq('parent_wig_id',t.id);
    for(const x of tu??[]) { await a.from('lead_measures').delete().eq('wig_id',x.id); }
    await a.from('wigs').delete().eq('parent_wig_id',t.id); }
  await a.from('wigs').delete().eq('parent_wig_id',w.id);
  await a.from('wigs').delete().eq('id',w.id);
}
console.log('đã dọn lần trước:', (cu??[]).length);
