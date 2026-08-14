import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const env={}; for(const l of readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const a=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:lop}=await a.from('classes').select('id').eq('name','Test').maybeSingle();
if (process.argv[2]==='xoa') {
  const {data:w}=await a.from('wigs').select('id').eq('class_id',lop.id).eq('title','ZZ thử ô tick+số');
  for(const x of w??[]) { await a.from('lead_progress').delete().in('lead_measure_id',
    ((await a.from('lead_measures').select('id').eq('wig_id',x.id)).data??[]).map(l=>l.id));
    await a.from('lead_measures').delete().eq('wig_id',x.id); }
  await a.from('wigs').delete().eq('class_id',lop.id).eq('title','ZZ thử ô tick+số');
  console.log('đã dọn'); process.exit(0);
}
const {data:w,error:e1}=await a.from('wigs').insert({
  class_id:lop.id, scope:'class', area:'knowledge', period:'week', period_label:'W33-2026',
  title:'ZZ thử ô tick+số', target_value:100, unit:'trang',
  start_date:'2026-08-10', end_date:'2026-08-16', measure_by:'tick', status:'approved',
}).select('id').single();
if(e1){console.error(e1.message);process.exit(1);}
const {error:e2}=await a.from('lead_measures').insert({
  wig_id:w.id, title:'Đọc sách mỗi tối', target_value:60, unit:'trang',
  active_weekdays:[1,2,3,4,5], unit_per_tick:1, nhap_luong:true,
});
console.log(e2?e2.message:'đã dựng, nhap_luong=true');
