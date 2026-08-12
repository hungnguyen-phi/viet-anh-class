// XOÁ MỤC TIÊU NĂM CÓ XOÁ SẠCH CẢ CÂY BA TẦNG KHÔNG.
//
// Vì sao có file này: cây WIG là năm → tháng → tuần, còn khoá ngoại parent_wig_id để NO ACTION.
// Bản deleteWig cũ chỉ gỡ MỘT tầng con nên xoá mục tiêu năm luôn vướng khoá ngoại và thất bại
// im lìm dưới câu "còn dữ liệu liên quan". Bài này dựng đúng một cây ba tầng GIẢ (không đụng dữ
// liệu thật), chạy đúng trình tự xoá cháu → con → gốc của deleteWig, rồi đếm lại.
//
//   node scripts/test-xoa-wig-ba-tang.mjs
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});

const kq = [];
const dat = (ok, ten, ghi = '') => kq.push({ok, ten, ghi});

// Mượn một lớp thật để qua được ràng buộc class_id, nhưng WIG dựng ra là của riêng bài kiểm.
const {data: lop} = await admin.from('classes').select('id').limit(1).single();
const nhan = 'KIEMTUDONG-XOA-' + Date.now().toString(36);

const them = async (period, period_label, start_date, end_date, parent) => {
  const {data, error} = await admin
    .from('wigs')
    .insert({
      class_id: lop.id,
      scope: 'class',
      area: 'knowledge',
      period,
      period_label,
      start_date,
      end_date,
      title: nhan,
      target_value: 10,
      unit: 'buổi',
      parent_wig_id: parent ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`${period}: ${error.message}`);
  return data.id;
};

const nam = await them('year', nhan, '2030-07-01', '2031-06-30', null);
const thang = await them('month', nhan + '-M', '2030-07-01', '2030-07-31', nam);
const tuan = await them('week', nhan + '-W', '2030-07-01', '2030-07-07', thang);

// ── Đúng trình tự deleteWig đang chạy: dò con → dò cháu → xoá cháu → xoá con → xoá gốc ──────
const conCua = async (ids) => {
  if (ids.length === 0) return [];
  const {data} = await admin.from('wigs').select('id').in('parent_wig_id', ids);
  return (data ?? []).map((w) => w.id);
};
const con = await conCua([nam]);
const chau = await conCua(con);
dat(con.length === 1 && chau.length === 1, 'Dò ra đủ cả tầng con lẫn tầng cháu', `${con.length} con, ${chau.length} cháu`);

let hong = null;
for (const tang of [chau, con]) {
  if (tang.length === 0) continue;
  const {error} = await admin.from('wigs').delete().in('id', tang);
  if (error) hong ??= error.message;
}
const {error: eGoc} = await admin.from('wigs').delete().eq('id', nam);
if (eGoc) hong ??= eGoc.message;
dat(!hong, 'Không lệnh xoá nào vướng khoá ngoại', hong ?? '');

const {count} = await admin.from('wigs').select('id', {count: 'exact', head: true}).in('id', [nam, thang, tuan]);
dat(count === 0, 'Xoá mục tiêu năm là sạch cả ba tầng, không sót mốc treo', `còn ${count} mốc`);

// Dọn nếu có gì sót — bài kiểm chạy trên CSDL thật, không được để lại rác.
await admin.from('wigs').delete().in('id', [tuan, thang, nam]);

for (const k of kq) console.log(k.ok ? 'OK  ' : 'SAI ', k.ten, k.ghi ? '— ' + k.ghi : '');
const so = kq.filter((k) => k.ok).length;
console.log(`\n${so}/${kq.length} đạt.`);
process.exit(so === kq.length ? 0 : 1);
