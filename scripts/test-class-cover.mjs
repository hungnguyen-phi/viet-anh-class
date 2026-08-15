// Ảnh bìa lớp: tải lên được, ghi được vào bảng, và người ngoài KHÔNG tải lên hộ được.
//
// Vì sao có bộ này: chủ trường báo tính năng "chưa được", đo ra thì storage.objects có ĐÚNG 0
// hàng — chưa lần nào chạy kể từ khi ra đời. Nguyên nhân là {upsert:true} + thiếu policy SELECT
// (migration 0071). Loại lỗi này không build nào bắt được, phải gọi thật mới lộ.
//
//   node scripts/test-class-cover.mjs
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});


// ── CHỐT CHẶN: BỘ KIỂM KHÔNG ĐƯỢC ĐẺ TÀI KHOẢN ────────────────────────────────────────────
// `generateLink({type:'magiclink'})` TỰ TẠO người dùng nếu email chưa có. Gõ nhầm một địa chỉ,
// hoặc dùng một tài khoản thử đã bị xoá, là production mọc thêm một tài khoản 'pending' nằm lại
// vĩnh viễn trong khối "Ai đang chờ bạn" của màn Quản trị.
//
// Đã xảy ra thật 15/08/2026: một bài đẻ ra test2.ph@truongvietanh.com, và test-admin-man lập tức
// đỏ tám dòng vì mọi con số trên tab lệch đúng một dòng — mất một vòng đi tìm "hồi quy" không có.
{
  const gocGenLink = admin.auth.admin.generateLink.bind(admin.auth.admin);
  admin.auth.admin.generateLink = async (opts) => {
    const {data: coHoSo} = await admin
      .from('profiles')
      .select('id')
      .eq('email', opts?.email ?? '')
      .maybeSingle();
    if (!coHoSo) throw new Error(`${opts?.email}: chưa có tài khoản này — bộ kiểm KHÔNG tạo mới`);
    return gocGenLink(opts);
  };
}
// Client mang danh tính một người thật — đúng như trình duyệt của họ.
async function nhuLa(email) {
  const {data: g, error} = await admin.auth.admin.generateLink({type: 'magiclink', email});
  if (error) throw new Error(email + ': ' + error.message);
  const anon = createClient(URL_, ANON, {auth: {persistSession: false}});
  const {data: v, error: e2} = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: g.properties.hashed_token,
  });
  if (e2) throw new Error(email + ': ' + e2.message);
  return createClient(URL_, ANON, {
    auth: {persistSession: false},
    global: {headers: {Authorization: `Bearer ${v.session.access_token}`}},
  });
}

const kq = [];
const check = (nhan, dat, ct = '') => kq.push(`${dat ? 'OK  ' : 'SAI '} ${nhan}${ct ? ' — ' + ct : ''}`);

// Ảnh webp 1×1 thật, không phải chuỗi rác — storage-api có kiểm kiểu nội dung.
const ANH = Buffer.from(
  'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
  'base64',
);

// Lớp lấy ĐỘNG. Bản cũ neo vào '7B1' — lớp ấy không còn trong CSDL, nên bài vỡ ngay ở dòng này
// và cả bộ đọc thành "app hỏng" trong khi chỉ là fixture mục.
const {data: lop} = await admin
  .from('classes')
  .select('id, name, homeroom_teacher_id')
  .eq('is_active', true)
  .not('homeroom_teacher_id', 'is', null)
  .order('name')
  .limit(1)
  .single();
const CLASS = lop.id;

// GIÁO VIÊN "LỚP KHÁC" — tìm người thật, không viết cứng.
//
// Bản cũ dùng test3.gvcn@truongvietanh.com; tài khoản ấy không còn tồn tại, và vì `generateLink`
// tự tạo người dùng nên chạy bài này sẽ ĐẺ nó ra dưới dạng tài khoản chờ duyệt trên production.
// Chốt chặn ở đầu tệp nay ném lỗi thay vì tạo — nên phải tìm một giáo viên có thật, chủ nhiệm
// MỘT LỚP KHÁC. Đó mới đúng vai mà phép kiểm cần: người ngoài lớp thì không được đọc/ghi.
const {data: gvKhacRow} = await admin
  .from('classes')
  .select('homeroom_teacher_id, profiles!classes_homeroom_teacher_id_fkey(email)')
  .eq('is_active', true)
  .not('homeroom_teacher_id', 'is', null)
  .neq('id', lop.id)
  .limit(1)
  .maybeSingle();
const emailGvKhac = gvKhacRow?.profiles?.email ?? null;
// LỚP CỦA NGƯỜI KIA — chính lớp mà `gvLa` chủ nhiệm, không phải một cái tên viết cứng ('6A2'
// cũng đã biến mất khỏi CSDL như '7B1'). Phép kiểm cần đúng một điều: người chủ nhiệm lớp kia
// không đụng được vào ảnh bìa lớp này, và ngược lại.
const {data: lopKhac} = await admin
  .from('classes')
  .select('id')
  .eq('homeroom_teacher_id', gvKhacRow.homeroom_teacher_id)
  .limit(1)
  .single();

const duong = `${CLASS}/${Date.now()}-test.webp`;
// GVCN CỦA CHÍNH LỚP VỪA CHỌN — không phải một email viết cứng. Tài khoản test1.gvcn nay không
// chủ nhiệm lớp nào, nên mở trang bằng nó là bị đá ra (307).
const {data: gvcn} = await admin
  .from('profiles')
  .select('email')
  .eq('id', lop.homeroom_teacher_id)
  .single();
const gv = await nhuLa(gvcn.email);
if (!emailGvKhac) {
  console.log('BỎ QUA: trường chỉ có một lớp có GVCN — không có "người lạ" nào để thử. CHƯA KIỂM.');
  process.exit(1);
}
const gvLa = await nhuLa(emailGvKhac);

// ── 1. GVCN tải ảnh bìa lớp MÌNH ──
const up = await gv.storage.from('class-covers').upload(duong, ANH, {contentType: 'image/webp'});
check('GVCN tải được ảnh bìa lớp mình', !up.error, up.error?.message ?? 'ok');

// ── 2. Ghi được đường dẫn vào bảng classes ──
if (!up.error) {
  const {data: pub} = gv.storage.from('class-covers').getPublicUrl(duong);
  const {error: dbErr} = await gv
    .from('classes')
    .update({cover_image_url: pub.publicUrl})
    .eq('id', CLASS);
  check('Ghi được cover_image_url vào lớp', !dbErr, dbErr?.message ?? 'ok');

  const {data: sau} = await admin
    .from('classes')
    .select('cover_image_url')
    .eq('id', CLASS)
    .single();
  check('Cột cover_image_url có giá trị', !!sau?.cover_image_url);

  // ── 3. Ảnh tải về được bằng URL công khai (chỗ trang hiện ảnh sẽ dùng) ──
  const r = await fetch(pub.publicUrl);
  check('Ảnh tải về được qua URL công khai', r.ok, `status ${r.status}`);
}

// ── 4. GVCN lớp KHÁC không tải hộ được ──
const upLa = await gvLa.storage
  .from('class-covers')
  .upload(`${CLASS}/${Date.now()}-chen-ngang.webp`, ANH, {contentType: 'image/webp'});
check('GVCN lớp khác KHÔNG tải lên hộ được', !!upLa.error, upLa.error?.message ?? 'TẢI ĐƯỢC — RÒ!');

// ── 5. Policy SELECT vẫn hẹp: GVCN lớp khác không liệt kê được ảnh lớp này ──
const {data: ds} = await gvLa.storage.from('class-covers').list(CLASS);
check('GVCN lớp khác KHÔNG liệt kê được ảnh lớp này', (ds ?? []).length === 0, `${(ds ?? []).length} tệp`);

// ── Dọn ──
await admin.storage.from('class-covers').remove([duong]);
await admin.from('classes').update({cover_image_url: null}).eq('id', CLASS);
await admin.from('classes').update({cover_image_url: null}).eq('id', lopKhac.id);
const {data: conLai} = await admin.storage.from('class-covers').list(CLASS);
check('Đã dọn sạch dữ liệu thử', (conLai ?? []).length === 0, `${(conLai ?? []).length} tệp còn lại`);

console.log(kq.join('\n'));
const sai = kq.filter((l) => l.startsWith('SAI')).length;
console.log(`\n${kq.length - sai}/${kq.length} đạt.${sai ? ` ${sai} SAI.` : ''}`);
process.exitCode = sai ? 1 : 0;
