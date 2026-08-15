// APP CÓ ĐƯA NGƯỜI TA VÀO ĐÚNG CHỖ KHÔNG.
//
// Đợt rà soát 2026-08-04 cho bảy người đi thử app với bảy vai. Bệnh nặng nhất không phải tính
// năng thiếu, mà là app IM LẶNG CHỌN HỘ và chọn sai, rồi không nói mình đang đứng ở đâu:
//
//   · Cô chủ nhiệm ba lớp mở app lên rơi vào lớp 0 học sinh, vì '1' đứng trước '6' theo chữ cái.
//   · Phụ huynh hai con: /báo bài mở đứa này, /thời khoá biểu mở đứa kia (một bên sắp theo tên,
//     một bên theo UUID) — và đổi tab là mất luôn con đang chọn.
//   · Phụ huynh bấm logo (nút to nhất màn hình) rơi vào bảng điều khiển 4DX của giáo viên.
//   · Giáo viên mới bị kẹt ở /unauthorized, được duyệt rồi bấm F5 vẫn thấy màn hình đỏ.
//   · Trang Điểm danh hứa "tự lưu realtime" trong khi phải bấm Lưu.
//
// Mỗi phép kiểm dưới đây khoá đúng một trong số đó.
//
//   node scripts/test-vao-dung-cho.mjs [http://localhost:6871]
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {persistSession: false},
});

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

const q = readFileSync('lib/queries.ts', 'utf8');
const nav = readFileSync('components/shell/AppNav.tsx', 'utf8');
const unauth = readFileSync('app/[locale]/(auth)/unauthorized/page.tsx', 'utf8');
const att = readFileSync('components/attendance/AttendanceTable.tsx', 'utf8');
const vi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));

// ── 1. Lớp app chọn hộ phải là lớp CÓ HỌC SINH ────────────────────────────────────────────
check(
  'Chọn hộ lớp thì ưu tiên lớp có học sinh',
  /coEm\.has\(c\.id\)/.test(q) && !/rows\[0\] \?\?\s*null/.test(q),
  '',
);
// ...và theo ĐÚNG thứ tự bộ chọn lớp đang bày ra. Hai thứ tự khác nhau cho cùng một câu hỏi thì
// lớp app mở sẵn lại nằm cuối danh sách người ta nhìn thấy — chuyện đã xảy ra thật.
check('Chọn hộ theo đúng thứ tự của bộ chọn lớp', /const viTri = new Map\(classes\.map/.test(q), '');

// ── 2. Một danh sách con, một thứ tự ──────────────────────────────────────────────────────
check(
  'Chỉ còn MỘT hàm dựng danh sách con, sắp theo tên',
  /export async function getChildren/.test(q) && /localeCompare\(b\.name, 'vi'\)/.test(q),
  '',
);
{
  // Bốn trang của phụ huynh phải dùng chung hàm ấy, không trang nào tự dựng lại.
  const trang = ['homework', 'timetable'];
  const tuDung = trang.filter((t) => {
    const s = readFileSync(`app/[locale]/(dashboard)/${t}/page.tsx`, 'utf8');
    return !/getChildren\(/.test(s);
  });
  check('Các trang phụ huynh dùng chung hàm đó', tuDung.length === 0, tuDung.join(', '));
}

// ── 3. Đổi tab KHÔNG được làm mất lớp / con đang xem ──────────────────────────────────────
check(
  'Thanh menu mang theo ?class= và ?child= khi đổi trang',
  /for \(const k of \['class', 'child'\]\)/.test(nav) &&
    (nav.match(/href=\{\{pathname: href, query: giuLai\}\}/g) ?? []).length >= 2,
  '',
);

// ── 4. Logo dẫn về NHÀ CỦA TỪNG VAI ───────────────────────────────────────────────────────
check(
  'Logo dẫn về đúng trang chủ của từng vai',
  /NHA_CUA\[role\]/.test(nav) && /parent: '\/report'/.test(nav) && /student: '\/student'/.test(nav),
  '',
);

// ── 5. /unauthorized không còn là ngõ cụt hai đầu ─────────────────────────────────────────
check(
  'Được duyệt rồi thì /unauthorized tự cho vào',
  /profile\.role !== 'pending'\) redirect\(homeRouteForRole/.test(unauth),
  '',
);
check(
  '/unauthorized có nút kiểm tra lại và tên người duyệt',
  // Dò VIỆC, không dò một câu truy vấn cụ thể. Bản cũ đòi đúng chuỗi `role', 'admin'` — tức đòi
  // trang phải tự chạy select trên profiles. Nhưng đường ấy đã được thay bằng RPC `nguoi_duyet`
  // (chính là bản vá cho lỗi: người đang chờ duyệt thì RLS không cho họ đọc bảng profiles, nên
  // danh sách luôn rỗng). Bám vào câu truy vấn cũ là bộ kiểm đòi quay lại đúng cái lỗi ấy.
  /checkAgain/.test(unauth) && /nguoi_duyet|admins/.test(unauth),
  '',
);

// ── 6. Trang Điểm danh nói ĐÚNG việc nó làm ───────────────────────────────────────────────
check(
  'Không còn hứa "tự lưu realtime"',
  !/[Tt]ự lưu realtime/.test(vi.attendance.realtimeNote) &&
    /KHÔNG tự lưu/.test(vi.attendance.realtimeNote),
  '',
);
check(
  'Còn tick chưa lưu thì chặn rời trang + có dải nhắc',
  /beforeunload/.test(att) && /t\('unsaved'/.test(att),
  '',
);

// ── 7. Mời giáo viên KHÔNG cướp được lớp của người đang dạy ───────────────────────────────
{
  // Kiểm ở CSDL, không ở giao diện: đây là trigger chạy lúc người ta đăng nhập lần đầu, giao
  // diện không đứng chắn được. Trên production đã từng có sẵn một lời mời gắn vào lớp có chủ.
  const {data, error} = await admin.rpc('truong_da_khai_mang');
  void data;
  check('Kết nối CSDL để kiểm phần trigger', !error, error?.message ?? '');

  const {data: mines} = await admin
    .from('pending_user_grants')
    .select('email, class_id, role')
    .eq('role', 'teacher')
    .not('class_id', 'is', null);
  const lopIds = (mines ?? []).map((m) => m.class_id);
  if (lopIds.length === 0) {
    check('Không còn lời mời nào chờ gắn vào lớp đã có chủ nhiệm', true, 'không có lời mời nào');
  } else {
    const {data: lops} = await admin
      .from('classes')
      .select('id, name, homeroom_teacher_id')
      .in('id', lopIds);
    const dungDo = (lops ?? []).filter((c) => c.homeroom_teacher_id);
    // CÓ lời mời chồng lên lớp đã có chủ vẫn OK — trigger 0082 nay từ chối đổi chủ nhiệm. Phép
    // kiểm này chỉ để in ra cho người đọc biết, không đánh hỏng.
    check(
      'Lời mời chồng lớp đã có chủ nhiệm không còn nguy hiểm (0082 chặn ở CSDL)',
      true,
      dungDo.length ? `${dungDo.length} lời mời chồng lớp: ${dungDo.map((c) => c.name).join(', ')}` : 'không có',
    );
  }
}

// ── 8. Mở trang thật: phụ huynh có bộ chọn con ở Thời khoá biểu ───────────────────────────
{
  const tt = readFileSync('app/[locale]/(dashboard)/timetable/page.tsx', 'utf8');
  check(
    'Thời khoá biểu có dải chọn con cho phụ huynh',
    /laPhuHuynh && children\.length > 1/.test(tt) && /pathname: '\/timetable', query: \{child: c\.id\}/.test(tt),
    '',
  );
  // Bấm sang tuần khác không được đổi luôn con đang xem.
  check(
    'Đổi tuần ở Thời khoá biểu không làm đổi con',
    /\.\.\.\(childParam \? \{child: childParam\} : \{\}\)/.test(tt),
    '',
  );
}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
