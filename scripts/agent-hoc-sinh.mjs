// BỐN HỌC SINH CHO AGENT — tạo và xoá.
//
//   node scripts/agent-hoc-sinh.mjs tao    # tạo 4 em, xếp vào lớp Test
//   node scripts/agent-hoc-sinh.mjs xoa    # xoá sạch: tick, mục tiêu, biên bản, ghi danh, tài khoản
//   node scripts/agent-hoc-sinh.mjs xem    # liệt kê đang có gì
//
// Vì sao tạo mới thay vì mượn tài khoản có sẵn: lớp Test đang có tài khoản THẬT của chủ dự án
// (alex@truongvietanh.com) và hai tài khoản anh ấy đang dùng để thử tay. Agent đăng nhập vào đó là
// đá phiên của người thật và ghi đè lên dữ liệu anh ấy đang xem dở. Bốn tài khoản riêng thì đăng
// nhập được bằng magic link (nhanh hơn SSO), và xoá được gọn khi xong.
//
// KHÔNG đụng: alex@, claudia@, test1.hs@ — và không đụng GVCN tunhien01@ (chỉ đăng nhập, không sửa).
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

// Tên đặt để nhìn bảng là biết ngay ai là agent — và mỗi em một tính cách để buổi thử ra dữ liệu
// giống lớp thật, không phải bốn bản sao.
const EM = [
  {email: 'agent1@test.truongvietanh.com', ten: 'AGENT An (đều đặn)'},
  {email: 'agent2@test.truongvietanh.com', ten: 'AGENT Bình (bỏ giữa chừng)'},
  {email: 'agent3@test.truongvietanh.com', ten: 'AGENT Chi (dồn cuối tuần)'},
  {email: 'agent4@test.truongvietanh.com', ten: 'AGENT Dũng (không làm gì)'},
];

const {data: lop} = await admin.from('classes').select('id, name').eq('name', 'Test').maybeSingle();
if (!lop) {
  console.error('Không thấy lớp Test.');
  process.exit(1);
}

const lenh = process.argv[2] ?? 'xem';

async function xem() {
  const {data} = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .in('email', EM.map((e) => e.email));
  console.log(`Lớp ${lop.name} · agent đang có: ${data?.length ?? 0}/4`);
  for (const p of data ?? []) console.log(`  ${p.email}  ·  ${p.full_name}  ·  ${p.role}`);
}

if (lenh === 'tao') {
  for (const e of EM) {
    const {data: co} = await admin.from('profiles').select('id').eq('email', e.email).maybeSingle();
    let id = co?.id;
    if (!id) {
      // email_confirm: bỏ qua bước xác thực hộp thư — tài khoản này không có hộp thư thật.
      const {data, error} = await admin.auth.admin.createUser({email: e.email, email_confirm: true});
      if (error) {
        console.error('Không tạo được', e.email, ':', error.message);
        continue;
      }
      id = data.user.id;
    }
    // Trigger on_auth_user_created đã dựng sẵn dòng profiles với role 'pending' — nâng lên student.
    await admin.from('profiles').update({role: 'student', full_name: e.ten}).eq('id', id);
    const {data: ghi} = await admin
      .from('enrollments')
      .select('id')
      .eq('student_id', id)
      .eq('class_id', lop.id)
      .maybeSingle();
    if (!ghi) await admin.from('enrollments').insert({student_id: id, class_id: lop.id, is_active: true});
    console.log('✓', e.email);
  }
  await xem();
} else if (lenh === 'xoa') {
  const {data: ds} = await admin
    .from('profiles')
    .select('id, email')
    .in('email', EM.map((e) => e.email));
  const ids = (ds ?? []).map((p) => p.id);
  if (ids.length === 0) {
    console.log('Không còn agent nào để xoá.');
  } else {
    // Xoá theo đúng thứ tự phụ thuộc. Mốc tháng treo dưới mục tiêu năm nên đi trước mục tiêu.
    const {data: wigs} = await admin.from('wigs').select('id').in('student_id', ids);
    const wigIds = (wigs ?? []).map((w) => w.id);
    if (wigIds.length) {
      const {data: lms} = await admin.from('lead_measures').select('id').in('wig_id', wigIds);
      const lmIds = (lms ?? []).map((l) => l.id);
      if (lmIds.length) await admin.from('lead_progress').delete().in('lead_measure_id', lmIds);
      await admin.from('lead_measures').delete().in('wig_id', wigIds);
      await admin.from('wig_so_do').delete().in('wig_id', wigIds);
      await admin.from('wigs').delete().in('parent_wig_id', wigIds);
      await admin.from('wigs').delete().in('id', wigIds);
    }
    // Lượt tick của agent trên VIỆC CHUNG của lớp — không nằm dưới wig của em nên phải xoá riêng.
    await admin.from('lead_progress').delete().in('student_id', ids);
    await admin.from('wig_meetings').delete().in('student_id', ids);
    await admin.from('mood_checkins').delete().in('student_id', ids);
    await admin.from('student_reflections').delete().in('student_id', ids);
    await admin.from('enrollments').delete().in('student_id', ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
    console.log(`Đã xoá ${ids.length} agent và mọi dấu vết của họ.`);
  }
} else {
  await xem();
}
