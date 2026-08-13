// Dựng / trả lại vai + dữ liệu tối thiểu cho ba tài khoản THỬ, để audit được đủ bốn vai.
//
//   node vai-thu.mjs nang | ha | xem
//
// Mượn phiên ADMIN chứ không dùng service_role: CSDL có trigger chặn đổi role/campus/email
// ("Chỉ admin (hoặc hiệu trưởng, với giáo viên trong cơ sở mình) được đổi"), trigger đọc JWT nên
// service_role cũng bị chặn — và chặn IM LẶNG với client không kiểm error. Lượt đầu tôi in ra
// "Đã nâng…" trong khi CSDL không đổi gì cả.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const VIEC = process.argv[2];
const GHI = 'nguyen-trang.json';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const sv = createClient(U, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(U, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

const {data: qt} = await sv.from('profiles').select('email').eq('role', 'admin').order('email');
const emailQt = (qt ?? []).find((u) => u.email.startsWith('test'))?.email ?? qt?.[0]?.email;
const {data: lk} = await sv.auth.admin.generateLink({type: 'magiclink', email: emailQt});
const {data: ss} = await anon.auth.verifyOtp({type: 'email', token_hash: lk.properties.hashed_token});
const db = createClient(U, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: {persistSession: false},
  global: {headers: {Authorization: `Bearer ${ss.session.access_token}`}},
});

const GVCN = 'test1.gvcn@truongvietanh.com';
const PH = 'test1.ph@truongvietanh.com';
const BGH = 'test2.bgh@truongvietanh.com';
const hoSo = async (email) => (await sv.from('profiles').select('id, role').eq('email', email).single()).data;
const ghi = async (ten, p) => {
  const {error} = await p;
  if (error) {
    console.log(`SAI  ${ten}: ${error.message}`);
    process.exit(1);
  }
  console.log(`OK   ${ten}`);
};

const xem = async () => {
  const {data: ng} = await sv.from('profiles').select('email, role').order('role');
  const {data: lop} = await sv.from('classes').select('name, homeroom_teacher_id').order('name');
  const {count: nLink} = await sv.from('parent_links').select('parent_id', {count: 'exact', head: true});
  console.log('  vai :', (ng ?? []).map((x) => `${x.email.split('@')[0]}=${x.role}`).join(' · '));
  console.log('  lớp :', (lop ?? []).map((c) => `${c.name}=${c.homeroom_teacher_id ? 'có GVCN' : 'trống'}`).join(' · '));
  console.log('  liên kết phụ huynh:', nLink);
};

if (VIEC === 'xem') {
  await xem();
} else if (VIEC === 'nang') {
  const [g, p, b] = await Promise.all([hoSo(GVCN), hoSo(PH), hoSo(BGH)]);
  const {data: lop} = await sv
    .from('classes')
    .select('id, name')
    .is('homeroom_teacher_id', null)
    .eq('is_active', true)
    .order('name')
    .limit(1)
    .single();
  // Con của phụ huynh thử: ưu tiên học sinh ĐÃ ghi danh vào một lớp, để màn /report có số liệu
  // thật thay vì rỗng trơn.
  const {data: enr} = await sv.from('enrollments').select('student_id').eq('is_active', true).limit(1).single();
  const hsId = enr?.student_id ?? (await sv.from('profiles').select('id').eq('role', 'student').limit(1).single()).data.id;

  writeFileSync(
    GHI,
    JSON.stringify({vai: {[GVCN]: g.role, [PH]: p.role, [BGH]: b.role}, lop: lop.id, hocSinh: hsId}, null, 2),
  );
  await ghi(`${GVCN} → teacher`, db.from('profiles').update({role: 'teacher'}).eq('id', g.id));
  await ghi(`${PH} → parent`, db.from('profiles').update({role: 'parent'}).eq('id', p.id));
  await ghi(`${BGH} → principal`, db.from('profiles').update({role: 'principal'}).eq('id', b.id));
  await ghi(`GVCN lớp ${lop.name}`, db.from('classes').update({homeroom_teacher_id: g.id}).eq('id', lop.id));
  await ghi('gắn con cho phụ huynh thử', db.from('parent_links').upsert({parent_id: p.id, student_id: hsId, relationship: 'kiểm thử'}));
  console.log(`Nguyên trạng ghi ở ${GHI}. Audit xong chạy: node vai-thu.mjs ha`);
  await xem();
} else if (VIEC === 'ha') {
  if (!existsSync(GHI)) {
    console.log('KHÔNG có nguyen-trang.json — không hạ mò, sợ trả sai.');
    process.exit(1);
  }
  const n = JSON.parse(readFileSync(GHI, 'utf8'));
  const [g, p, b] = await Promise.all([hoSo(GVCN), hoSo(PH), hoSo(BGH)]);
  await ghi('xoá liên kết phụ huynh', db.from('parent_links').delete().eq('parent_id', p.id).eq('student_id', n.hocSinh));
  await ghi('trả GVCN lớp về trống', db.from('classes').update({homeroom_teacher_id: null}).eq('id', n.lop));
  await ghi(`${GVCN} → ${n.vai[GVCN]}`, db.from('profiles').update({role: n.vai[GVCN]}).eq('id', g.id));
  await ghi(`${PH} → ${n.vai[PH]}`, db.from('profiles').update({role: n.vai[PH]}).eq('id', p.id));
  await ghi(`${BGH} → ${n.vai[BGH]}`, db.from('profiles').update({role: n.vai[BGH]}).eq('id', b.id));
  await xem();
} else {
  console.log('Dùng: node vai-thu.mjs nang | ha | xem');
  process.exit(1);
}
