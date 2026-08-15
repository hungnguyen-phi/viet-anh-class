// BA MÀN WIG SAU KHI DỰNG LẠI — /wig · /wig/chi-tiet · /wig/hop
//
// Trang /wig cũ bày mọi thứ cùng lúc: form tạo WIG năm, form tạo WIG tuần lồng trong từng WIG
// năm, form thêm lead measure lồng trong từng WIG tuần, bảng tick, khối họp, khối tạo WIG cá
// nhân, ba đoạn văn giải thích. Chủ dự án: "nhìn từ trên xuống 1 lượt thấy toàn là ô xếp dọc
// nhau, toàn là chữ, tôi không biết mình nên làm gì luôn".
//
// Bộ kiểm này giữ ba thứ khỏi mọc lại, và mỗi phép kiểm đều nhắm vào một lỗi ĐÃ xảy ra thật:
//
//   1. Trang chính phải NGẮN — không có form nào nằm chờ sẵn.
//   2. Ba màn phải nối được với nhau (ngõ cụt là lỗi hay gặp nhất khi tách màn).
//   3. CHỈ CÒN MỘT LOẠI MỤC TIÊU (0121). Trước đây mục này canh chuỗi năm → tháng → tuần; nay
//      chuỗi ấy không còn, nên nó canh điều thay thế: giao diện KHÔNG được mời người ta tạo một
//      loại mà cơ sở dữ liệu đã cấm.
//   4. Phòng họp mặc định tổng kết TUẦN VỪA XONG, không phải tuần này.
//   5. Chỉ có MỘT màn hình sửa được buổi họp (/meeting đá giáo viên sang /wig/hop).
//   6. Câu báo hỏng phải đi đường ?flash_err= — mọi hàm flash đều gỡ dấu.
//
//   node scripts/test-wig-ba-man.mjs [http://localhost:6871]
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const BASE = process.argv[2] ?? 'http://localhost:6871';
const env = {};
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth: {persistSession: false}});

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

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// Bỏ <script>: payload RSC mang cả gói bản dịch, dò trên đó là dò trúng thứ KHÔNG được vẽ ra —
// đúng cái bẫy đã làm một phép kiểm trước đây xanh giả.
const docHtml = async (url, ck) => {
  const r = await fetch(url, {headers: {cookie: ck}, redirect: 'manual'});
  const raw = await r.text();
  return {status: r.status, loc: r.headers.get('location'), html: raw.replace(/<script[\s\S]*?<\/script>/gi, '')};
};

// ── PHẦN 1: SOI MÃ NGUỒN (chạy được cả khi không có server) ────────────────────────────────

const page = readFileSync('app/[locale]/(dashboard)/wig/page.tsx', 'utf8');
const menu = readFileSync('components/wig/TaoWigMenu.tsx', 'utf8');
const taoWig = readFileSync('lib/wig-tao.ts', 'utf8');
const hopPage = readFileSync('app/[locale]/(dashboard)/wig/hop/page.tsx', 'utf8');
const meetingPage = readFileSync('app/[locale]/(dashboard)/meeting/page.tsx', 'utf8');

// 1. Trang chính KHÔNG được có form tạo nằm chờ sẵn.
check(
  'Trang /wig không còn form tạo nào nằm chờ sẵn',
  !/action=\{createWig\}|action=\{addLeadMeasure\}|WigCreateForm|createChildForm/.test(page),
  '',
);

// 2. Ba màn nối được với nhau — mỗi đường đi phải có một liên kết thật trong mã.
check(
  'Trang /wig có đường sang Chi tiết và sang Phòng họp',
  /pathname: '\/wig\/chi-tiet'/.test(page) && /pathname: '\/wig\/hop'/.test(page),
  '',
);
const chiTiet = readFileSync('app/[locale]/(dashboard)/wig/chi-tiet/page.tsx', 'utf8');
check(
  'Hai màn con đều có đường quay về /wig',
  /pathname: '\/wig'/.test(chiTiet) && /pathname: '\/wig' as const/.test(hopPage),
  '',
);
// Thanh ← → của màn chi tiết phải ở lại màn chi tiết. Đóng cứng '/wig' thì bấm sang tuần khác là
// văng ra ngoài, đọc thành "đổi tuần là mất hết chi tiết".
check(
  'Nút ← → ở màn chi tiết ở lại đúng màn đó',
  /basePath="\/wig\/chi-tiet"/.test(chiTiet),
  '',
);

// 3. 0121: CSDL chỉ nhận period='year'. Giao diện không được mời người ta đi vào ngõ cụt ấy.
//
// Đây từng là lỗi thật: menu vẫn bày ba thẻ Năm/Tháng/Tuần và MỞ SẴN thẻ Tháng khi lớp đã có mục
// tiêu năm, nên đường đi mặc định của cô là điền hết một biểu mẫu rồi ăn câu lỗi thô của Postgres
// (`wig_chi_con_nam_ck`). Dò MARKUP chứ không dò chữ: chuỗi dịch nằm sẵn trong gói gửi xuống.
check(
  'Menu tạo mục tiêu KHÔNG còn mời chọn Tháng/Tuần',
  !/setLoai\(/.test(menu) && !/needYearFirst|needMonthFirst/.test(menu),
  '',
);
check(
  'Và loại gửi lên luôn là year',
  /useState<'year' \| 'month' \| 'week'>\('year'\)/.test(menu),
  '',
);

// 4. Ngày của một kỳ do SERVER tra từ nhãn — trình duyệt không gửi ngày lên nữa.
check(
  'Trình duyệt chỉ gửi NHÃN kỳ, ngày do server tra',
  /name="period_label"/.test(menu) && !/name="start_date"|name="end_date"/.test(menu) && /ngayCuaKy\(/.test(taoWig),
  '',
);

// 5. Phòng họp mặc định tổng kết TUẦN VỪA XONG.
check(
  'Phòng họp mặc định tổng kết tuần vừa xong',
  /shiftWeeks\(thisMonday, -1\)/.test(hopPage),
  '',
);

// 6. Chỉ MỘT màn hình sửa được buổi họp.
check(
  '/meeting đưa giáo viên sang /wig/hop, không dựng bản sao thứ hai',
  /redirect\(`\/wig\/hop/.test(meetingPage) && /canManage={false}/.test(meetingPage),
  '',
);

// 7. Mọi câu báo hỏng phải đi đường ?flash_err= — hàm flash nào cũng phải gỡ dấu.
{
  const {readdirSync, statSync} = await import('node:fs');
  const walk = (d, out = []) => {
    for (const f of readdirSync(d)) {
      const p = d + '/' + f;
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(f)) out.push(p);
    }
    return out;
  };
  const thieu = walk('app/[locale]/(dashboard)').filter((f) => {
    const s = readFileSync(f, 'utf8');
    return /loi\(friendlyError/.test(s) && !/tachLoi\(/.test(s);
  });
  check(
    'Mọi câu báo hỏng đều đi đường ?flash_err=',
    thieu.length === 0,
    thieu.length ? thieu.join(', ') : 'không file nào quên gỡ dấu',
  );
}

// ── PHẦN 2: MỞ TRANG THẬT ──────────────────────────────────────────────────────────────────

// CHỌN LỚP TRƯỚC, ĐĂNG NHẬP SAU — và đăng nhập bằng GVCN CỦA CHÍNH LỚP ẤY.
//
// Bản cũ đăng nhập cứng bằng test1.gvcn rồi mới đi tìm lớp. Tài khoản ấy nay không chủ nhiệm lớp
// nào, nên mọi trang trả 307 (bị đá đi vì không có quyền vào lớp đó) và cả loạt phép kiểm đỏ như
// thể màn hình hỏng. Quyền vào lớp là của người chủ nhiệm, nên người mở trang phải là người ấy.
let ck = null;
{
  const {data: gv} = await admin
    .from('profiles')
    .select('id')
    .eq('email', 'test1.gvcn@truongvietanh.com')
    .maybeSingle();
  // KHÔNG bám cứng vào lớp của một tài khoản: test1.gvcn nay không chủ nhiệm lớp nào, và bản cũ
  // vì thế báo "không có lớp để mở trang" — đỏ vì dữ liệu đổi, không phải vì màn hình hỏng.
  const {data: lops} = await admin
    .from('classes')
    .select('id, name, homeroom_teacher_id')
    .eq('is_active', true)
    .not('homeroom_teacher_id', 'is', null)
    .order('name');
  // ƯU TIÊN LỚP CÓ VIỆC THẬT TRONG TUẦN. Mấy phép dưới đây soi màn hình có vẽ ra việc chung, ma
  // trận từng em, phòng họp — lớp rỗng thì chúng đỏ với lý do "tuần này lớp chưa có việc chung",
  // tức là đo sự trống rỗng của dữ liệu chứ không đo màn hình.
  const {data: dsCamKet} = await admin.from('commitments').select('class_id');
  const coViec = new Set((dsCamKet ?? []).map((c) => c.class_id));
  const ds = lops ?? [];
  const lop =
    ds.find((c) => c.homeroom_teacher_id === gv?.id && coViec.has(c.id)) ??
    ds.find((c) => coViec.has(c.id)) ??
    ds.find((c) => c.homeroom_teacher_id === gv?.id) ??
    ds[0];

  if (lop) {
    const {data: chuNhiem} = await admin
      .from('profiles')
      .select('email')
      .eq('id', lop.homeroom_teacher_id)
      .maybeSingle();
    try {
      const {data: g} = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: chuNhiem.email,
      });
      const {data: v} = await anon.auth.verifyOtp({
        type: 'email',
        token_hash: g.properties.hashed_token,
      });
      ck = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(v.session)).toString('base64url')}`;
    } catch (e) {
      console.log('BỎ QUA phần mở trang thật (không đăng nhập được):', e.message);
    }
  }

  if (!lop || !ck) {
    check('Có lớp để mở trang', false, 'không lớp nào đang hoạt động có GVCN đăng nhập được');
  } else {
    const q = `class=${lop.id}`;

    // NHÃN LẤY TỪ GÓI DỊCH. Ba khối này vẫn ở nguyên chỗ cũ; cái đổi là chữ trên chúng — 0121 đổi
    // "Mục tiêu tuần này" thành "Cam kết tuần này". Viết cứng thì bộ kiểm báo mất cả một khối màn
    // hình trong khi khối ấy vẫn hiện, chỉ mang tên mới.
    const goi = JSON.parse(readFileSync('messages/vi.json', 'utf8'));
    const co = (html, chuoi) => Boolean(chuoi) && html.includes(chuoi);

    const wig = await docHtml(`${BASE}/wig?${q}`, ck);
    check(
      'Trang /wig vẽ đủ ba khối: cam kết tuần · lớp đang đi tới đâu · nút họp',
      co(wig.html, goi.wig?.goalThisWeek) &&
        co(wig.html, goi.wig?.progressRail) &&
        // Nút họp mang MỘT TRONG HAI mặt: chưa họp thì mời đi họp, họp rồi thì nói đã họp tuần
        // nào. Dò cứng một chuỗi "phòng họp WIG" là bỏ sót hẳn nửa còn lại — và lớp nào đã họp
        // xong thì phép kiểm báo mất nút, trong khi nút vẫn ở đó với câu chữ khác.
        (co(wig.html, goi.wig?.meetingTime) ||
          wig.html.includes((goi.wig?.meetingDone ?? '').split('{')[0].trim())),
      `HTTP ${wig.status}`,
    );
    check(
      'Trang /wig có nút Tạo mục tiêu và nút Chi tiết',
      /Tạo mục tiêu/.test(wig.html) && /Chi tiết/.test(wig.html),
      '',
    );
    // Không còn dấu vết của trang cũ. Dò chuỗi tiếng Việt CỤ THỂ chứ không dò tên biến: chuỗi chỉ
    // vào được HTML nếu thật sự có component vẽ nó ra.
    check(
      'Trang /wig đã bỏ hẳn các khối cũ',
      !/Cầm bảng này mà họp/.test(wig.html) &&
        !/1 · Tạo WIG năm/.test(wig.html) &&
        !/Việc chung của lớp — em nào đã tick/.test(wig.html),
      '',
    );
    // Không khoá dịch nào lọt ra màn hình. next-intl in RA TÊN KHOÁ khi thiếu, và trang vẫn chạy.
    check(
      'Không có khoá dịch nào hiện ra thành chữ trên màn hình',
      !/\b(wig|meeting|class)\.[a-zA-Z][a-zA-Z0-9]{3,}\b/.test(wig.html.replace(/<[^>]+>/g, ' ')),
      '',
    );
    // Dấu lỗi phải được gỡ trước khi lên URL — sót là người dùng đọc "!!LOI!!Bạn không có quyền…".
    check('Không rò dấu !!LOI!! ra màn hình', !/!!LOI!!/.test(wig.html), '');

    const ct = await docHtml(`${BASE}/wig/chi-tiet?${q}`, ck);
    check('Màn /wig/chi-tiet mở được', ct.status === 200, `HTTP ${ct.status}`);
    {
      // Có tên em thật, không chỉ có tiêu đề — tiêu đề vẫn hiện ra với danh sách rỗng.
      const {data: ds} = await admin
        .from('enrollments')
        .select('profiles!enrollments_student_id_fkey(full_name)')
        .eq('class_id', lop.id)
        .eq('is_active', true);
      const ten = (ds ?? []).map((r) => r.profiles?.full_name).filter(Boolean);
      const coViec = /Tới giờ trong tuần này/.test(ct.html);
      check(
        'Màn chi tiết hiện từng em (hoặc nói rõ tuần này chưa có việc)',
        coViec ? ten.length > 0 && ten.every((n) => ct.html.includes(n)) : /chưa có việc chung nào/.test(ct.html),
        coViec ? `${ten.length} em` : 'tuần này lớp chưa có việc chung',
      );
    }

    const hop = await docHtml(`${BASE}/wig/hop?${q}`, ck);
    check('Phòng họp mở được', hop.status === 200, `HTTP ${hop.status}`);
    check(
      'Phòng họp có đủ ba bước và một nút chốt',
      // Bước 2 và nút chốt lấy nhãn từ gói dịch ("Kết thúc buổi họp" nay là "Chốt buổi họp").
      // Bước 3 chỉ dò phần đầu của mẫu câu, vì đuôi là biến {week} do server điền.
      (co(hop.html, goi.meeting?.step2) ||
        hop.html.includes((goi.meeting?.step2 ?? '').replace('&', '&amp;'))) &&
        hop.html.includes((goi.meeting?.step3 ?? '').split('{')[0].trim()) &&
        co(hop.html, goi.meeting?.finish),
      '',
    );
    {
      // Tuần đang tổng kết phải là tuần TRƯỚC tuần hiện tại — đây là quyết định của chủ dự án và
      // là thứ dễ trôi ngược nhất khi ai đó sửa mặc định.
      const {data: homNay} = await admin.rpc('vn_today');
      const d = new Date(`${homNay}T00:00:00Z`);
      const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - (dow - 1) - 7);
      const t2 = d.toISOString().slice(0, 10);
      const nhan = (() => {
        const x = new Date(`${t2}T00:00:00Z`);
        const n = x.getUTCDay() || 7;
        x.setUTCDate(x.getUTCDate() + 4 - n);
        const dau = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
        const tuan = Math.ceil(((x.getTime() - dau.getTime()) / 86400000 + 1) / 7);
        return `W${String(tuan).padStart(2, '0')}-${x.getUTCFullYear()}`;
      })();
      check(
        'Phòng họp mặc định mở đúng tuần vừa xong',
        hop.html.includes(`Đang tổng kết tuần ${nhan}`),
        nhan,
      );
    }

    // /meeting phải đá giáo viên sang phòng họp — một màn hình sửa được, không phải hai.
    //
    // KHÔNG dò mã 307. Layout dashboard là streaming: phần đầu HTML (kèm status 200) đã bay đi
    // trước khi component của trang chạy xong, nên redirect() ở server component KHÔNG đổi được
    // mã HTTP nữa — Next nhét lệnh chuyển trang vào giữa luồng và trình duyệt tự đi. Bản đầu của
    // phép kiểm này đòi 307 và báo đỏ một hành vi hoàn toàn đúng.
    //
    // Cũng KHÔNG dò chuỗi trên HTML thô: gói bản dịch được nhúng trong <script>, nên câu "Bản chỉ
    // đọc" CÓ MẶT trong trang kể cả khi không có gì vẽ nó ra. Phải cắt <script> rồi mới dò —
    // đúng cái bẫy đã làm một phép kiểm trước đây xanh giả.
    const mt = await docHtml(`${BASE}/meeting?${q}`, ck);
    const daCoLenhChuyen = /\/wig\/hop/.test(mt.loc ?? '') || /\/wig\/hop/.test(mt.html);
    check(
      '/meeting đưa giáo viên thẳng sang phòng họp',
      daCoLenhChuyen && !/Bản chỉ đọc dành cho ban giám hiệu/.test(mt.html),
      `HTTP ${mt.status}`,
    );
  }
}

// ── PHẦN 3: CSDL ───────────────────────────────────────────────────────────────────────────
{
  // Cổng check-in chỉ được có nghĩa khi trường THẬT SỰ khai dải mạng (0082).
  // Trước 0082, ip_allowed() trả TRUE khi trường chưa khai gì — nên mọi em ở mọi nơi đều bị coi
  // là đang đứng trong trường, bị cổng chặn cứng, và bấm xong là bị ghi "có mặt".
  const {data: daKhai, error} = await admin.rpc('truong_da_khai_mang');
  check(
    'Có hàm phân biệt "đang ở trường" với "chưa ai khai mạng"',
    !error,
    error ? error.message : `trường đã khai mạng: ${daKhai}`,
  );

}

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
