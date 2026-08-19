import {getLocale, getTranslations} from 'next-intl/server';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {clientIp} from '@/lib/ip';
import {getAreaMeta} from '@/lib/area-config';
import {AREAS, areaLabel} from '@/lib/areas';
import {
  todayInVN,
  isoWeekLabel,
  weekDaysVN,
  isoDowVN,
  vnNoon,
  mondayOf,
  isValidDayVN,
  shiftWeeks,
  khoangTuan,
  cachTuan,
} from '@/lib/dates';
import {kieuDonVi} from '@/lib/don-vi';
import {MoodCheckin, MoodGate, type MoodKey} from '@/components/student/MoodCheckin';
import {LeadTicker, type TickerLead} from '@/components/student/LeadTicker';
import {StudentMeetings, type StudentMeeting} from '@/components/student/StudentMeetings';

import {MyRequests, type MyRequest} from '@/components/student/MyRequests';
import {BuddyAuto} from '@/components/student/BuddyAuto';
import {HopPdr} from '@/components/student/HopPdr';
import {RequestInbox, type EditRequest} from '@/components/student/RequestInbox';
import {MucTieuCuaCon, type MucTieuCuaEm, type SoDoCuaTuan} from '@/components/student/MucTieuCuaCon';
import {NghePhongHop} from '@/components/wig/NghePhongHop';
import {CamKetCuaEm} from '@/components/wig/CamKetCuaEm';
import {DaiChiSo, gopChiSo} from '@/components/wig/DaiChiSo';
import {NutDuyetCamKet} from '@/components/wig/NutXoaCamKet';
import {SuaCamKet} from '@/components/wig/SuaCamKet';
import {FlashToast} from '@/components/ui/FlashToast';
import {ChonTuanCuaEm} from '@/components/student/ChonTuanCuaEm';
import {ArrowRight, Users} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {tenHienThi} from '@/lib/ten-hien-thi';

// Màu/icon/nhãn môn lấy từ area_config (fallback = --color-subj-* cũ ⇒ parity).

type WigRow = {
  wig_id: string;
  area: string;
  period: string;
  period_label: string | null;
  // NGÀY là khoá thật để biết một WIG thuộc tuần nào; period_label chỉ để con người đọc.
  start_date: string;
  end_date: string;
  // unit của WIG năm → dùng làm đơn vị mặc định cho form kế hoạch tuần sau.
  unit: string | null;
  pct: number | null;
  status: string | null;
  // 'manual' = con số sống ngoài app → KHÔNG vẽ vòng phần trăm, chỉ Đạt/Chưa đạt.
  measure_by: string | null;
  achieved_at: string | null;
};
type LeadRow = {
  id: string;
  // wig_id chỉ khối quản lý dùng (gom việc theo từng WIG tuần) — có ở đây vì một câu
  // lead_measures duy nhất nay phục vụ cả bảng tick lẫn khối quản lý.
  wig_id: string;
  // 0121/0137 — việc treo dưới CAM KẾT tuần; dùng để xếp việc vào đúng thẻ mục tiêu năm.
  commitment_id: string | null;
  title: string;
  target_value: number;
  unit: string | null;
  // 0073 — những thứ trong tuần mà việc này được tick (ISO 1=T2…7=CN).
  active_weekdays: number[] | null;
  // 0076 — một lượt tick đáng bao nhiêu đơn vị của mục tiêu.
  unit_per_tick: number | null;
  // 0110 — ô ngày là ô ĐIỀN SỐ chứ không phải một chạm (giờ, bài, trang, lead…).
  nhap_luong: boolean | null;
  lead_progress:
    | {
        id: string;
        value: number;
        logged_date: string;
        created_at: string;
        logged_by: string | null;
        student_id: string | null;
      }[]
    | null;
};

// Một dòng của class_lead_board() — VIỆC CHUNG của lớp tuần này (0073).
// (Kiểu ClassLeadRow đã gỡ: màn của em thôi đọc class_lead_board từ 16/08 — việc chung là phần của cô.)

// (initialsOf đã gỡ: chỗ duy nhất dùng nó là danh sách bạn cùng tick việc chung.)

export async function StudentScoreboard({
  studentId,
  viewer,
  flash,
  weekParam,
  pathname,
}: {
  studentId: string;
  viewer: Profile;
  flash?: string;
  /** ?week= — tuần đang xem (bất kỳ ngày nào trong tuần); thiếu = tuần chứa hôm nay. */
  weekParam?: string;
  /** Đường dẫn của trang đang nhúng, để thanh tuần đổi ?week= tại chỗ. */
  pathname: string;
}) {
  const t = await getTranslations('student');
  const tg = await getTranslations('goal');
  const tm = await getTranslations('meeting');
  const supabase = await createClient();
  const canManage = viewer.role === 'teacher' || viewer.role === 'admin';
  const canEditMood = viewer.id === studentId && viewer.role === 'student';
  // Chỉ phụ thuộc `viewer` và `studentId` — hai thứ đã có ngay từ tham số hàm. Tính ở đây để câu
  // edit_requests bên dưới vào được cùng đợt Promise.all thay vì phải chờ tới cuối hàm.
  const canTick = viewer.id === studentId && viewer.role === 'student';

  // Ngày hôm nay theo giờ VN — TÍNH TẠI CHỖ, không hỏi máy chủ CSDL.
  //
  // Trước đây gọi rpc('app_today'), tốn một vòng mạng (đo được 60–197 ms) chỉ để hỏi hôm nay là
  // ngày mấy. Và chính mã này đã dùng todayInVN() làm phương án dự phòng ngay dòng dưới — tức là
  // đã tin nó đúng rồi. lib/dates.ts tính bằng Intl với múi giờ Asia/Ho_Chi_Minh nên không phụ
  // thuộc giờ máy chủ (máy chủ chạy UTC, lệch 7 tiếng).
  const today = todayInVN();
  // 7 ngày của TUẦN ĐANG XEM (Thứ Hai → Chủ Nhật). Mặc định là tuần chứa hôm nay; ?week= (thanh
  // tuần, 16/08/2026) thì là tuần ấy — cam kết, việc, tick, biên bản đều đọc theo cùng một tuần.
  const thisMonday = mondayOf(today);
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam!) : thisMonday;
  const weekDays = weekDaysVN(monday);


  // Truy vấn song song — RLS tự giới hạn quyền xem.
  const [
    {data: student},
    {data: enr},
    {data: wigRows},
    {data: meetingRows},
    {data: moodRow},
    ,
    {data: myRequestRows},
    ,
    {data: reqs},
  ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('id', studentId).maybeSingle(),
      supabase
        .from('enrollments')
        // campus_id đi kèm luôn (audit tốc độ 10/08/2026): trước đây phải hỏi RIÊNG bảng classes
        // một câu nữa chỉ để lấy đúng cột này, và câu ấy nằm ở một TẦNG CHỜ khác — cửa sổ
        // check-in phải đợi nó xong mới hỏi được. Thêm một cột vào câu đã chạy sẵn thì miễn phí.
        .select('class_id, classes(name, school_year, tick_lock_dow, campus_id)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        // Có .order() rồi mới .limit(1) — em chuyển lớp giữa năm còn nhiều dòng ghi danh đang bật
        // thì Postgres trả dòng nào tuỳ ý, và trang đổi lớp ngẫu nhiên giữa hai lần tải. Đúng lỗi
        // đã sửa ở getMyClass đợt trước; chỗ này bị sót.
        .order('class_id')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('wig_progress_v')
        .select(
          'wig_id, area, period, period_label, start_date, end_date, unit, pct, status, measure_by, achieved_at',
        )
        .eq('student_id', studentId)
        .eq('scope', 'student')
        .in('period', ['year', 'week']),
      supabase
        .from('wig_meetings')
        .select(
          'id, week_label, results, commitments, next_actions, buddy_note, buddy_action, buddy_focus_lead_id, buddy_chat_open, created_at, buddy_messages(id, role, content, created_at)',
        )
        .eq('student_id', studentId)
        .order('created_at', {ascending: false}),
      // Cảm xúc HÔM NAY, cả hai buổi, kèm GIỜ BẤM — giờ bấm chính là bằng chứng có mặt kể từ khi
      // check-in thay điểm danh, nên phải lấy về để hiện ngay dưới icon.
      supabase
        .from('mood_checkins')
        .select('mood, buoi, created_at')
        .eq('student_id', studentId)
        .eq('date', today),
      Promise.resolve(null),
      // Yêu-cầu-sửa của CHÍNH người đang xem. Trước đây nằm mãi cuối hàm, chạy SAU bốn đợt truy
      // vấn khác — mà nó chỉ phụ thuộc viewer.id, thứ đã biết từ trước khi hàm chạy. Tức là một
      // vòng mạng xếp hàng thuần tuý, không chờ gì cả. Kéo lên đây để chạy cùng đợt.
      // RLS er_requester_read đã giới hạn requester_id = auth.uid(), lọc lại cho rõ ý.
      canTick
        ? supabase
            .from('edit_requests')
            .select('id, kind, ref_id, message')
            .eq('requester_id', viewer.id)
            .eq('status', 'pending')
            .order('created_at', {ascending: false})
        : Promise.resolve({data: null}),
      // HAI CÂU CỦA KHỐI QUẢN LÝ, kéo từ cuối hàm lên đây. Cả hai chỉ lọc theo `studentId` — thứ
      // đã có trong tham số hàm trước khi chạm mạng lần nào. Trước đây chúng nằm trong một
      // Promise.all riêng SAU khi lead_measures về, nên GVCN mở trang của một em phải chờ thêm
      // trọn một vòng mạng mà chẳng để đợi dữ liệu gì.
      // (Truy vấn wigs cho khối quản lý cá nhân đã gỡ 16/08/2026 — cô chỉ duyệt, không quản lý.)
      Promise.resolve({data: null}),
      canManage
        ? supabase
            .from('edit_requests')
            .select('id, kind, ref_id, message, created_at, requester:profiles!edit_requests_requester_id_fkey(full_name)')
            .eq('student_id', studentId)
            .eq('status', 'pending')
            .order('created_at', {ascending: false})
        : Promise.resolve({data: null}),
    ]);

  if (!student) {
    return (
      <div className="animate-rise glass mt-4 rounded-[26px] p-10 text-center">
        <p className="text-sm font-semibold text-grey-mid">{t('notFound')}</p>
      </div>
    );
  }

  const enrRow = enr as unknown as {
    class_id: string;
    classes: {
      name: string;
      school_year: string;
      tick_lock_dow: number | null;
      campus_id: string | null;
    } | null;
  } | null;
  const cls = enrRow?.classes;
  const classId = enrRow?.class_id ?? null;
  const moodSang = (moodRow ?? []).find((r) => r.buoi === 'sang') ?? null;
  const moodChieu = (moodRow ?? []).find((r) => r.buoi === 'chieu') ?? null;
  const mood = (moodSang?.mood ?? null) as MoodKey | null;

  // ── BỐN CÂU HỎI CÙNG MỘT ĐỢT (audit tốc độ 10/08/2026) ────────────────────────────────────
  //
  // Bốn thứ dưới đây trước nằm ở BA TẦNG CHỜ nối đuôi nhau — cửa sổ check-in (sau khi hỏi thêm
  // bảng classes), rồi cổng check-in, rồi "tuần đã họp chưa" mãi cuối hàm — dù cả bốn chỉ cần
  // những thứ đã biết ngay sau đợt truy vấn đầu tiên: classId, campus_id và địa chỉ IP. Ba tầng
  // ấy là ba lần đi-về xếp hàng, trên đường mà mỗi lần đi-về tốn hàng trăm mili-giây.
  //
  // BẮT BUỘC check-in: chỉ chặn khi CHÍNH em đó chưa check-in hôm nay VÀ đang ở trong mạng
  // trường. Ngoài mạng trường (ở nhà/4G) student_checkin() trả 'blocked' → nếu vẫn chặn thì em
  // bị khoá cứng không tự thoát được, nên cho vào xem read-only (quyết định 2026-07-26).
  const rows = (wigRows ?? []) as WigRow[];
  const yearRows = rows.filter((r) => r.period === 'year');
  const weekRows = rows
    .filter((r) => r.period === 'week')
    .sort((a, b) => a.end_date.localeCompare(b.end_date));

  // Bảng "tick hằng ngày" chỉ được chứa lead measure của WIG TUẦN NÀY.
  // Trước đây lấy mọi WIG tuần (W29, W30, W31…) nên cùng một việc hiện nhiều dòng với số đếm
  // khác nhau — học sinh không biết dòng nào của tuần nào. Dãy pip "WIG tuần của em" thì vẫn
  // dùng weekRows (mọi tuần) vì nó cố tình thể hiện lịch sử thắng/thua.
  //
  // LỌC THEO NGÀY, KHÔNG THEO NHÃN. Bản cũ so `period_label === 'W32-2026'` — mà nhãn ấy là một
  // ô CHỮ TỰ DO giáo viên sửa được, và trên cùng cái bảng này việc CHUNG của lớp lại đi qua
  // class_lead_board vốn cắt theo NGÀY (0073). Hai luật cho hai nửa của một bảng: sửa nhãn thành
  // "Tuần 32" là việc riêng của em biến mất trong khi việc chung vẫn còn, và không màn hình nào
  // nói ra. Đây đúng là cặp luật đã gây sự cố 7B1, chỉ còn sót lại ở màn hình học sinh.
  //
  // Vị ngữ dưới đây là bản chép ĐÚNG của class_lead_board: khoảng ngày của WIG giao với tuần lịch.
  const tuanNay = {dau: weekDays[0], cuoi: weekDays[6]};
  const wigTuanNay = weekRows.filter(
    (w) => w.start_date <= tuanNay.cuoi && w.end_date >= tuanNay.dau,
  );
  // Việc RIÊNG của em treo ở đâu — hai chỗ, và phải hỏi cả hai.
  //
  //   · WIG tuần cá nhân (đời cũ, trước 0100): việc treo dưới mốc tuần của em.
  //   · Mục tiêu của em (từ 0100): việc treo thẳng dưới chính mục tiêu ấy, vốn là period='year'.
  //     Mục tiêu của em nay sống cả học kỳ chứ không đẻ lại mỗi tuần, nên nếu chỉ hỏi WIG tuần
  //     thì bảng tick của em trống trơn trong khi em vừa tự đặt việc xong.
  const weekIds = [...wigTuanNay.map((w) => w.wig_id), ...yearRows.map((w) => w.wig_id)];

  const campusId = cls?.campus_id ?? null;
  const canGoiCong = canEditMood && mood === null;
  const ipHienTai = canGoiCong ? clientIp(await headers()) : null;

  // PHẢI gọi bằng service_role: migration 0031 đã revoke ip_allowed khỏi vai 'authenticated'
  // (để học sinh không dò được cấu hình mạng trường). Bản trước gọi bằng client thường nên
  // Supabase trả 403 ở MỌI lần học sinh mở trang — thấy rõ trong log API. Lỗi này im lặng:
  // data về undefined → mustCheckin=false → cổng không bao giờ chặn, mà mỗi lượt vẫn tốn một
  // vòng mạng hỏng.
  const {createAdminClient} = canGoiCong || campusId
    ? await import('@/lib/supabase/admin')
    : {createAdminClient: null};
  const admin = createAdminClient ? createAdminClient() : null;

  // MỐC THÁNG ĐÃ BỎ (0121): `wig_chi_con_nam_ck` cấm period='month', nên truy vấn mốc tháng ở đây
  // không bao giờ trả về dòng nào — một vòng đi–về tới CSDL trên MỌI lần em mở trang, đổi lấy một
  // dòng chữ không bao giờ hiện. Cả chuỗi mocThang* gỡ theo, ở cả MucTieuCuaCon.
  const [cuaSoRes, ipRes, mangRes, daHopRes, leadRes, mucTieuRes, soDoRes, wigLopRes, , hopLopRes, ckTuanRes] =
    await Promise.all([
    // CỬA SỔ CHECK-IN của cơ sở em đang học. Lấy một lần, dùng cho cả buổi sáng lẫn buổi chiều.
    // Null khi em chưa có lớp (chưa biết cơ sở) → giao diện giữ nguyên hành vi cũ, không khoá gì.
    admin && campusId
      ? admin.rpc('checkin_windows', {p_campus: campusId})
      : Promise.resolve({data: null}),
    // HAI CÂU HỎI, KHÔNG PHẢI MỘT.
    //
    // ip_allowed() trả TRUE khi trường CHƯA khai dải mạng nào — "chưa cấu hình thì không chặn"
    // (0031). Nhưng chỗ này dùng nó theo nghĩa ngược lại: "TRUE nghĩa là em đang đứng trong
    // trường". Trường Việt Anh hiện chưa bật dải nào, nên mọi em ở mọi nơi đều được coi là đang
    // ở trường: em mở app tối Chủ Nhật ở nhà là gặp một cổng chặn cứng cả màn hình, không Esc,
    // không bấm nền, và bấm xong thì CSDL có thêm một dòng điểm danh "có mặt" — đã có 8 dòng
    // như thế. Nay hỏi thêm một câu để phân biệt "đang ở trường" với "chưa ai khai gì" (0082).
    admin && canGoiCong
      ? admin.rpc('ip_allowed', {p_ip: ipHienTai ?? ''})
      : Promise.resolve({data: null}),
    admin && canGoiCong ? admin.rpc('truong_da_khai_mang') : Promise.resolve({data: null}),
    // Tuần còn mở cho sửa hay đã chốt — phải khớp luật RLS ở 0081: HỌP XONG LÀ CHỐT.
    //
    // Trước đây so hôm nay với `classes.tick_lock_dow`, một ngày giáo viên khai trước. Nay mốc
    // chốt là việc thật sự xảy ra: lớp đã ghi nhận buổi họp cho tuần này thì thôi sửa tick. Hỏi
    // đúng cái hàm mà RLS dùng, để màn hình không nói khác tầng chặn — bấm được rồi bị từ chối
    // còn khó hiểu hơn là thấy nút xám ngay từ đầu.
    classId
      ? supabase.rpc('tuan_da_hop', {p_class: classId, d: weekDays[0]})
      : Promise.resolve({data: false}),

    // ── Hai câu dưới đây trước là "ĐỢT HAI", một tầng chờ riêng ────────────────────────────
    // Chúng chỉ cần classId và weekIds — cả hai đã biết xong ngay sau đợt truy vấn đầu tiên, nên
    // đứng riêng một tầng là bắt người dùng chờ thêm một vòng đi-về không đổi lấy gì.
    //
    // KHÔNG CÒN hỏi danh sách bạn cùng lớp và bảng buddy_pairs (12/08/2026): Buddy của em là con
    // sư tử AI, không phải bạn ngồi bên cạnh. Xem ghi chú "MỘT CHỮ BUDDY, MỘT NGHĨA" ở
    // StudentMeetings. Bỏ được luôn hai vòng đi-về mỗi lần mở trang.
    //
    // CHỈ VIỆC CỦA TUẦN NÀY. Việc treo dưới cam kết tuần (commitment_id, 0137/0138), và cam kết
    // thì có week_start. Bản trước lấy MỌI việc dưới mục tiêu năm của em — sang tuần thứ ba là ba
    // dòng "Làm bài buổi tối 0/5" xếp chồng, không dòng nào nói mình của tuần nào (chủ dự án thấy
    // đúng cảnh ấy 16/08/2026). Nối vào commitments bằng !inner để lọc theo tuần ngay trong câu
    // hỏi, không kéo hết về rồi lọc.
    weekIds.length > 0
      ? supabase
          .from('lead_measures')
          .select(
            'id, wig_id, commitment_id, title, target_value, unit, active_weekdays, unit_per_tick, nhap_luong, lead_progress(id, value, logged_date, created_at, logged_by, student_id), commitments!inner(week_start)',
          )
          .in('wig_id', weekIds)
          .eq('commitments.week_start', weekDays[0])
      : Promise.resolve({data: null}),
    // (Truy vấn class_lead_board đã gỡ 16/08/2026: việc chung nay là phần của cô — cô đặt, cô
    //  tick, cô nhìn — nên màn của em không còn ai đọc nó nữa.)
    // MỤC TIÊU CỦA EM (0100). Không lấy từ wig_progress_v được: view ấy không mang kind/status/
    // set_by xuống, mà cả ba đều cần để bày đúng — "chờ cô duyệt", "cô đặt giúp con", và phân
    // biệt mục tiêu học tập với mục tiêu riêng.
    supabase
      .from('wigs')
      .select(
        'id, kind, status, set_by, measure_by, title, baseline, target_value, unit, area, start_date, end_date, created_at, achieved_at, source_wig_id, reject_note',
      )
      .eq('student_id', studentId)
      .eq('scope', 'student')
      .eq('period', 'year'),
    // SỐ ĐO NGOÀI APP của TUẦN NÀY (0108) — cân nặng, chiều cao, điểm TB môn. Đi chung chuyến này
    // chứ không hỏi trong MucTieuCuaCon: khối ấy là client component, hỏi ở đó là thêm một vòng
    // đi-về sau khi cả trang đã dựng xong.
    //
    // Lọc theo NGÀY THỨ HAI của tuần, cùng khoá mà `ghiSoDo` ghi vào. Không lấy cả lịch sử: thẻ chỉ
    // hiện số của tuần đang chạy, kéo về hai mươi tuần để vẽ một dòng là trả tiền cho thứ không ai
    // nhìn — lịch sử thuộc về buổi họp và báo cáo, không thuộc về thẻ này.
    supabase
      .from('wig_so_do')
      .select('wig_id, gia_tri, vai_tro, updated_at')
      .eq('week_start', weekDays[0]),
    // Trận đánh của lớp — để em chọn mình đang góp vào cái nào. Đây là LIÊN KẾT HƯỚNG ĐI, không
    // phải phép chia: con số của em do em đặt, không suy ra từ con số của lớp.
    classId
      ? supabase
          .from('wigs')
          .select('id, area, title, unit')
          .eq('class_id', classId)
          .eq('scope', 'class')
          .eq('period', 'year')
          // Chỉ WIG lớp ĐÃ DUYỆT mới là chỗ để em gắn vào (PRD v3 / 0148 — WIG lớp GVCN tạo
          // nay chờ BGH duyệt trước).
          .eq('status', 'approved')
          // Mục tiêu CUỘN không hiện ở đây: nó đếm ngược từ chính mục tiêu của em, nên chọn nó
          // làm "trận đánh mình đang góp vào" là một vòng tròn. Và chủ dự án đã chốt em không
          // nhìn thấy loại này (0116).
          .neq('measure_by', 'cuon')
      : Promise.resolve({data: null}),
    // (Sổ của con — student_reflections — thôi đọc ở đây 16/08/2026: khối đã bỏ khỏi màn.)
    Promise.resolve({data: null}),
    // BIÊN BẢN HỌP CỦA CẢ LỚP (student_id null). Trước 13/08/2026 em chỉ thấy dòng riêng của
    // mình, nên buổi họp xong là chiêm nghiệm và LỜI HỨA của cả lớp biến mất khỏi màn hình em —
    // trong khi đó chính là thứ 4DX bảo cả nhóm phải nhìn thấy suốt tuần. RLS đã cho học sinh
    // đọc dòng của lớp (rls_select_wig_meetings).
    classId
      ? supabase
          .from('wig_meetings')
          .select('week_label, week_start, results, commitments, chot_at, mo_luc')
          .eq('class_id', classId)
          .is('student_id', null)
          .order('week_start', {ascending: false})
          .limit(3)
      : Promise.resolve({data: null}),
    // CAM KẾT TUẦN NÀY CỦA EM — trục nối mục tiêu năm với việc để tick (0121/0138). Mỗi cam kết
    // treo vào một mục tiêu (của lớp hoặc của chính em); thẻ mục tiêu năm bày cam kết + việc của nó.
    supabase
      .from('commitments')
      .select('id, title, status, wig_id, verdict')
      .eq('student_id', studentId)
      .eq('week_start', weekDays[0])
      .order('created_at'),
  ]);
  const leadData = leadRes.data;
  const ckTuan = (ckTuanRes.data ?? []) as {id: string; title: string; status: string; wig_id: string; verdict: string | null}[];

  const cuaSoRaw = Array.isArray(cuaSoRes.data) ? cuaSoRes.data[0] : cuaSoRes.data;
  const cuaSo: {
    moLuc: string;
    hetDungGio: string;
    hetMuon: string;
    chieuMo: string;
    chieuDong: string;
  } | null = cuaSoRaw
    ? {
        moLuc: cuaSoRaw.mo_luc,
        hetDungGio: cuaSoRaw.het_dung_gio,
        hetMuon: cuaSoRaw.het_muon,
        chieuMo: cuaSoRaw.chieu_mo,
        chieuDong: cuaSoRaw.chieu_dong,
      }
    : null;

  type HopLopRow = {
    week_label: string;
    week_start: string;
    results: string | null;
    commitments: string | null;
    chot_at: string | null;
    mo_luc: string | null;
  };
  // Biên bản của LỚP có nội dung thật, và CHỈ khi còn nóng: tuần này hoặc tuần trước.
  //
  // Lý do khối này tồn tại là "lời hứa chung phải sống suốt tuần" (13/08) — mà lời hứa của
  // biên bản W32 là hứa CHO W33; sang W34 nó đã hết hạn từ lâu. Bản cũ ghim "biên bản gần nhất
  // có nội dung" bất kể bao xa, nên lớp nghỉ họp hai tuần là màn em ghim một lời hứa ôi thiu —
  // chủ dự án hỏi thẳng (19/08/2026): "tại sao phải đưa 2 tuần trước vào". Quá tuần trước thì
  // thôi ghim; ai cần đọc lại thì vào phòng họp lớp.
  const nhanTuanHomNay = isoWeekLabel(vnNoon(todayInVN()));
  const hopLop =
    ((hopLopRes.data ?? []) as HopLopRow[]).find((r) => {
      const cach = cachTuan(r.week_label, nhanTuanHomNay);
      return (
        cach !== null && cach >= 0 && cach <= 1 &&
        ((r.results ?? '').trim() || (r.commitments ?? '').trim())
      );
    }) ?? null;

  // PHÒNG HỌP ĐANG MỞ (0130) — cô vừa bấm "Bắt đầu họp". Hiện lời mời NGAY TRÊN BẢNG THÀNH TÍCH,
  // không bắt em tự nghĩ ra đường vào /student/hop: chủ dự án chốt "tất cả màn hình của các em
  // đều hiện phòng họp".
  const phongDangMo =
    ((hopLopRes.data ?? []) as HopLopRow[]).find((r) => r.mo_luc && !r.chot_at) ?? null;

  const mustCheckin = mangRes.data === true && ipRes.data === true;
  const tickOpen = !daHopRes.data;

  const meetings: StudentMeeting[] = (
    (meetingRows ?? []) as unknown as {
      id: string;
      week_label: string;
      results: string | null;
      commitments: string | null;
      next_actions: string | null;
      buddy_note: string | null;
      buddy_action: string | null;
      buddy_focus_lead_id: string | null;
      buddy_chat_open: boolean | null;
      created_at: string;
      buddy_messages: {id: string; role: string; content: string; created_at: string}[] | null;
    }[]
  ).map((m) => ({
    id: m.id,
    week_label: m.week_label,
    results: m.results,
    commitments: m.commitments,
    next_actions: m.next_actions,
    buddy_note: m.buddy_note,
    buddy_action: m.buddy_action,
    // Tên lead measure sẽ được gán bên dưới, sau khi đã nạp tickerLeads.
    buddy_focus_title: null,
    buddy_chat_open: Boolean(m.buddy_chat_open),
    buddy_messages: [...(m.buddy_messages ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((x) => ({id: x.id, role: x.role, content: x.content})),
    created_at: m.created_at,
  }));
  const focusIdByMeeting = new Map(
    (
      (meetingRows ?? []) as unknown as {id: string; buddy_focus_lead_id: string | null}[]
    ).map((m) => [m.id, m.buddy_focus_lead_id]),
  );

  const leadRows = (leadData ?? []) as unknown as LeadRow[];


  // 7 ngày của tuần → còn những THỨ mà việc đó áp dụng (0073). Trước đây bảng tick luôn bày đủ
  // T2…CN cho mọi việc, kể cả việc chỉ làm ở lớp — em không biết cuối tuần có phải tick không.
  const daysFor = (w: number[] | null) => {
    const on = new Set(w ?? [1, 2, 3, 4, 5, 6, 7]);
    return weekDays.filter((d) => on.has(isoDowVN(d)));
  };

  // VIỆC CHUNG KHÔNG CÒN HIỆN TRÊN MÀN CỦA EM (16/08/2026).
  //
  // Chủ dự án: "có leadmeasure nhưng cô là người tick, các em ko cần thấy cái đó".
  //
  // Trước bản này màn của em bày cả hai — việc chung của lớp (mọi em đều phải tick) và việc riêng
  // của em — tới bốn dòng, không phân hạng, nên em không biết cái nào nhường được cái nào. Chính
  // chủ dự án nhìn vào và hỏi "sao mà cân bằng được".
  //
  // Nay việc chung là phần của cô: cô đặt, cô tick, cô nhìn. Màn của em chỉ còn thứ em tự hứa và
  // tự làm — mà đó cũng đúng là thứ 4DX muốn em nhìn vào mỗi ngày.
  //
  // Và gỡ luôn cả truy vấn class_lead_board: không còn ai đọc, để lại là một vòng đi–về tới CSDL
  // trên mọi lần em mở trang, đổi lấy không gì cả.
  const tickerLeads: TickerLead[] = [
    ...leadRows.map((l) => ({
      id: l.id,
      commitmentId: l.commitment_id ?? null,
      title: l.title,
      target: Number(l.target_value),
      unit: l.unit,
      kind: 'mine' as const,
      unitPerTick: Number(l.unit_per_tick ?? 1) || 1,
      days: daysFor(l.active_weekdays),
      // Lọc theo student_id chứ không theo logged_by: GVCN tick hộ một em thì dòng đó vẫn là của
      // EM (student_id), chỉ khác người ghi. Bản trước so `logged_by === viewer.id` nên GVCN mở
      // trang của một em thấy dải ngày trống trơn dù em đã tick đủ.
      //
      // VÀ phải lọc theo TUẦN. `days` ngay dưới chỉ vẽ ô cho 7 ngày của tuần này, còn LeadTicker
      // lấy `mine = myDates.length` làm tử số của thanh tiến độ — không ràng ngày thì một lượt
      // tick nằm ngoài tuần (GVCN sửa hộ ngày cũ, hoặc dữ liệu trước khi 0073 siết ngày) sẽ đẩy
      // thanh lên mà không có ô vàng nào tương ứng. Trên production đã có thật: một em hiện
      // "5/5 ĐẠT" trong khi màn hình chỉ có 4 ô. Việc CHUNG ngay bên cạnh lấy my_dates từ RPC —
      // vốn đã lọc theo tuần — nên trước bản này hai loại việc trong cùng một bảng đếm hai kiểu.
      myDates: (l.lead_progress ?? [])
        .filter(
          (p) =>
            p.student_id === studentId &&
            p.logged_date >= weekDays[0] &&
            p.logged_date <= weekDays[6],
        )
        .map((p) => p.logged_date),
      // 0110 — LƯỢNG của từng ngày. Ô một-chạm không cần (luôn là 1), ô điền số thì cần để mở lại
      // đúng con số em đã gõ hôm ấy.
      nhapLuong: Boolean(l.nhap_luong),
      myValues: Object.fromEntries(
        (l.lead_progress ?? [])
          .filter((p) => p.student_id === studentId)
          .map((p) => [p.logged_date, Number(p.value ?? 0)]),
      ),
      classTotal: null,
      contributors: null,
      classSize: null,
      // SỐ CỦA EM TUẦN NÀY — CỘNG CON SỐ ĐÃ GHI, KHÔNG ĐẾM SỐ Ô VÀNG.
      //
      // Trước bản này chỗ đây để `null`, và LeadTicker rơi vào đường dự phòng
      // `myDates.length * unitPerTick` — tức là ĐẾM SỐ NGÀY đã tick. Với việc một-chạm thì hai
      // cách ra cùng một số nên không ai thấy gì. Với việc ĐIỀN SỐ thì sai hẳn: chủ dự án gõ 15
      // lead vào ô thứ Sáu, dòng đã ghi xuống CSDL đàng hoàng (kiểm lại: value = 15), mà thanh
      // vẫn đứng ở "1/1600 lead" — nhìn ra đúng như "nhập 15 vẫn ko lên số, ko ăn".
      //
      // Luật gộp lấy y nguyên của việc CHUNG (class_lead_board, 0114) để hai loại việc trong cùng
      // một bảng không đếm hai kiểu: đơn vị đo lại thì lấy con số MỚI NHẤT, còn lại thì cộng rồi
      // nhân hệ số.
      myTotal: (() => {
        const trongTuan = (l.lead_progress ?? []).filter(
          (p) =>
            p.student_id === studentId &&
            p.logged_date >= weekDays[0] &&
            p.logged_date <= weekDays[6],
        );
        if (trongTuan.length === 0) return 0;
        if (kieuDonVi(l.unit ?? '') === 'do') {
          const moiNhat = [...trongTuan].sort((a, b) =>
            a.logged_date < b.logged_date ? 1 : -1,
          )[0];
          return Number(moiNhat.value ?? 0);
        }
        return (
          trongTuan.reduce((tong, p) => tong + Number(p.value ?? 0), 0) *
          (Number(l.unit_per_tick ?? 1) || 1)
        );
      })(),
      studentsDone: null,
    })),
  ];
  // Chỉ việc RIÊNG mới xin đổi tên được: việc chung là của cả lớp, một em đổi tên là đổi cho
  // mọi người — chỗ sửa nó là buổi họp WIG với GVCN.

  // GVCN/Admin: yêu cầu-sửa đang chờ (khối quản lý WIG cá nhân đã gỡ 16/08/2026 — cô chỉ duyệt).
  let requests: EditRequest[] = [];
  if (canManage) {
    requests = ((reqs ?? []) as unknown as {id: string; kind: string; ref_id: string | null; message: string | null; created_at: string; requester: {full_name: string | null} | null}[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      ref_id: r.ref_id,
      message: r.message,
      requesterName: r.requester?.full_name ?? null,
      createdAt: r.created_at,
    }));
  }


  // (tickOpen đã tính ở đợt gộp phía trên — trước đây câu tuan_da_hop nằm đúng chỗ này và là
  // một tầng chờ riêng, dù nó chỉ cần classId đã biết từ đầu hàm.)

  // Tên lead measure theo id — dùng cho "việc hôm nay" của Buddy và cho nhãn yêu cầu-sửa.
  const leadTitleById = new Map(tickerLeads.map((l) => [l.id, l.title]));
  // Buddy chỉ trả về SỐ THỨ TỰ, server đã map thành id thật; ở đây đổi id → tên để hiển thị.
  // Lead của tuần cũ không có trong tickerLeads → title null → dòng "việc hôm nay" tự ẩn.
  for (const m of meetings) {
    const fid = focusIdByMeeting.get(m.id);
    if (fid) m.buddy_focus_title = leadTitleById.get(fid) ?? null;
  }

  // Yêu cầu-sửa CỦA CHÍNH người đang xem còn 'pending' → cho sửa lời nhắn / rút lại (0040).
  // Dữ liệu đã lấy từ Promise.all ở trên; ở đây chỉ ghép thêm tên việc, không chạm mạng nữa —
  // leadTitleById mới có sau khi lead_measures về, nên phần GHÉP phải nằm dưới, còn phần HỎI thì
  // không việc gì phải chờ.
  const myRequests: MyRequest[] = (
    (myRequestRows ?? []) as {id: string; kind: string; ref_id: string | null; message: string | null}[]
  ).map((r) => ({...r, leadTitle: r.ref_id ? leadTitleById.get(r.ref_id) ?? null : null}));
  const displayName = tenHienThi(student.full_name, student.email);

  // Mục tiêu của em + trận đánh của lớp để chọn — cho khối MucTieuCuaCon.
  const mucTieuCuaEm = (mucTieuRes.data ?? []) as unknown as MucTieuCuaEm[];

  // Nhãn 4 domain (area_config, đúng ngôn ngữ) cho bốn ô mục tiêu — PRD v3 4.2.
  const [areaMeta, locale] = await Promise.all([getAreaMeta(), getLocale()]);
  const nhanTheoArea = Object.fromEntries(AREAS.map((a) => [a, areaLabel(areaMeta[a], locale)]));

  // ── HỌP PDR VỚI BUDDY (0146 — PRD v3 6.2.7) ────────────────────────────────────────────────
  // Luôn là TUẦN HIỆN TẠI, không theo tuần đang xem: biên bản PDR là việc của tuần này, còn thanh
  // tuần ở cột trái chỉ điều khiển khu cam kết/tick.
  const nhanTuanPdr = isoWeekLabel(vnNoon(thisMonday));
  // Trục tuần của KHU HỌP phải tự đọc được (19/08/2026 — "w32 rồi đến w33 rồi đến w31… không có
  // 1 cái gì rõ ràng cả"): tuần sau cho câu nhịp PDR, và tên quan hệ cho biên bản lớp cũ.
  const tuanSauPdr = isoWeekLabel(vnNoon(shiftWeeks(thisMonday, 1)));
  const tenQuanHeTuan = (lb: string) => {
    const n = cachTuan(lb, nhanTuanPdr);
    if (n === null || n < 0) return null;
    if (n === 0) return t('weekThis');
    if (n === 1) return t('weekLast');
    return t('weeksAgo', {n});
  };
  // GỘP MỘT ĐỢT (tối ưu tốc độ 18/08/2026): PDR (4 câu) + metrics độc lập nhau và đều chỉ cần
  // studentId/monday có sẵn từ trước — chạy song song một vòng thay vì hai vòng nối tiếp. Trên
  // VPS mất ~5% gói, mỗi vòng bớt đi là bớt một lần rút thăm với cái đuôi ~1 giây.
  const [capRes, pdrRes, pdrCoachRes, lichCoachRes, soRowsRes] = await Promise.all([
    supabase
      .from('buddy_pairs')
      .select('id, student_id, buddy_id')
      .eq('is_active', true)
      .or(`student_id.eq.${studentId},buddy_id.eq.${studentId}`)
      .order('created_at'),
    supabase
      .from('pdr_meetings')
      .select('id, week_label, q1_plan, q2_result, q3_obstacle, q4_overcome, q5_better_way, q6_commitment, acknowledged_at')
      .eq('student_id', studentId)
      .eq('type', 'buddy')
      .eq('week_label', nhanTuanPdr)
      .maybeSingle(),
    supabase
      .from('pdr_meetings')
      .select('id, week_label, q1_plan, q2_result, q3_obstacle, q4_overcome, q5_better_way, q6_commitment, acknowledged_at')
      .eq('student_id', studentId)
      .eq('type', 'coach')
      .eq('week_label', nhanTuanPdr)
      .maybeSingle(),
    supabase
      .from('pdr_schedules')
      .select('monthly_day')
      .eq('student_id', studentId)
      .eq('type', 'coach')
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('metrics_tuan_v')
      .select('week_start, tong_lead, lead_xong, tong_ck, ck_thang, ck_thua')
      .eq('student_id', studentId)
      .lte('week_start', monday),
  ]);
  const capBuddy = capRes.data ?? [];
  const idBuddy = capBuddy.map((p) => (p.student_id === studentId ? p.buddy_id : p.student_id));
  let tenBuddy: string[] = [];
  let lichBuddy: string | null = null;
  if (idBuddy.length > 0) {
    const [tenRes, lichRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').in('id', idBuddy),
      supabase
        .from('pdr_schedules')
        .select('weekday, time_slot')
        .in('buddy_pair_id', capBuddy.map((p) => p.id))
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ]);
    const tenCua = new Map((tenRes.data ?? []).map((p) => [p.id, tenHienThi(p.full_name, p.email)]));
    tenBuddy = idBuddy.map((id) => tenCua.get(id) ?? '—');
    if (lichRes.data?.weekday)
      lichBuddy = `${lichRes.data.weekday === 8 ? 'CN' : `T${lichRes.data.weekday}`}${
        lichRes.data.time_slot ? ` · ${String(lichRes.data.time_slot).slice(0, 5)}` : ''
      }`;
  }
  const wigDaDuyet = mucTieuCuaEm
    .filter((m) => m.status === 'approved')
    .map((m) => ({id: m.id, title: m.title}));

  // SỐ ĐO TUẦN NÀY, tra theo id mục tiêu. Định dạng giờ ghi Ở ĐÂY chứ không ở component: khối kia
  // là client component, để nó tự gọi toLocaleString là mời sai lệch máy chủ/trình duyệt in ra hai
  // chuỗi khác nhau rồi React kêu hydrate lệch.
  // MỐC THÁNG NÀY, tra theo id mục tiêu năm (cha của mốc).

  const soDoTheoWig: Record<string, SoDoCuaTuan> = {};
  for (const r of (soDoRes.data ?? []) as {
    wig_id: string;
    gia_tri: number;
    vai_tro: string;
    updated_at: string;
  }[]) {
    soDoTheoWig[r.wig_id] = {
      wig_id: r.wig_id,
      gia_tri: Number(r.gia_tri),
      vai_tro: r.vai_tro,
      ghi_luc: r.updated_at ? r.updated_at.slice(0, 10) : null,
    };
  }
  // Sổ của con — mới nhất trước; thẻ tự tách trang của tuần đang chạy ra khỏi phần lịch sử.
  const wigLopChon = ((wigLopRes.data ?? []) as {id: string; area: string; title: string | null}[]).map(
    (w) => ({id: w.id, area: w.area, title: w.title ?? w.area}),
  );

  // ── HAI KHU PHẲNG, KHÔNG LỒNG (16/08/2026, lần ba) ──────────────────────────────────────────
  //
  // Bản trước nhét cả cây vào một thẻ: thẻ mục tiêu › khung "tuần này" › khung cam kết › khung việc
  // — bốn khung lồng nhau. Chủ dự án: "4 cấp nằm bên trong đè lên nhau… quá rối". Đúng. Cây thì
  // vẫn là cây, nhưng bày ra thì phải phẳng:
  //   KHU 1 — MỤC TIÊU NĂM: mỗi mục tiêu một thẻ gọn (tên, khoảng ngày, vòng %, góp vào lớp).
  //   KHU 2 — TUẦN ĐANG XEM: một danh sách phẳng — dòng CAM KẾT (nhãn, tên, trạng thái, Sửa) rồi
  //           các dòng VIỆC của nó (ô ngày để tick / điền số) — không khung bọc, chỉ vạch ngăn.
  //           Cuối danh sách là nút "+ Thêm cam kết" (chọn mục tiêu năm của em nếu có hơn một).
  const pctTheoWig: Record<string, number> = Object.fromEntries(
    yearRows.map((w) => [w.wig_id, Number(w.pct ?? 0)]),
  );
  const nhanTuanNay = isoWeekLabel(vnNoon(monday));
  const dayShort = t.raw('dayShort') as string[];
  // Chỉ WIG đã duyệt vào ô chọn của cam kết (PRD v3; trigger 0148 là chốt thật).
  const mucTieuChon = mucTieuCuaEm
    .filter((m) => m.status === 'approved')
    .map((m) => ({id: m.id, area: m.area, title: m.title, unit: m.unit}));
  const tenMucTieu = new Map(mucTieuCuaEm.map((m) => [m.id, m.title]));

  // ── METRICS (0147 — PRD v3 6.3): lead đạt/tổng + cam kết thắng/thua, tuần đang xem và luỹ kế.
  // Dữ liệu đã lấy CÙNG ĐỢT với PDR ở trên; ở đây chỉ gom tại chỗ, không thêm vòng mạng.
  const soRows = soRowsRes.data;
  const soTuan = gopChiSo((soRows ?? []).filter((r) => r.week_start === monday));
  const soLuyKe = gopChiSo(soRows ?? []);
  const soPips = (soRows ?? [])
    .slice()
    .sort((a, b) => (a.week_start ?? '').localeCompare(b.week_start ?? ''))
    .map((r) => ({thang: r.ck_thang ?? 0, thua: r.ck_thua ?? 0}));

  const khuTuan = (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="font-display text-[17px] font-bold text-navy">{t('thisWeekTitle')}</h2>
        <div className="ml-auto">
          <DaiChiSo tuan={soTuan} luyKe={soLuyKe} pips={soPips} />
        </div>
      </div>
      {ckTuan.length === 0 && !canTick && (
        <p className="text-[12.5px] italic text-grey-mid">{t('noCommitmentThisWeek')}</p>
      )}
      <div className="flex flex-col gap-3">
        {ckTuan.map((c) => {
          const viec = tickerLeads.filter((l) => l.commitmentId === c.id);
          return (
            <div key={c.id} className="rounded-[14px] border-l-[3px] border-gold-mid bg-white/50 py-2.5 pl-3.5 pr-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 text-[14.5px] font-extrabold text-navy">{c.title}</span>
                {mucTieuCuaEm.length > 1 && tenMucTieu.get(c.wig_id) && (
                  <span className="basis-full text-[11px] font-semibold text-grey-mid sm:basis-auto">
                    → {tenMucTieu.get(c.wig_id)}
                  </span>
                )}
                {c.status === 'sent' ? (
                  <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">{tg('waiting')}</span>
                ) : (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">{tg('approved')}</span>
                )}
                {canManage && c.status === 'sent' && <NutDuyetCamKet commitmentId={c.id} studentId={studentId} />}
                {canTick && tickOpen && classId && (
                  <SuaCamKet
                    commitmentId={c.id}
                    studentId={studentId}
                    classId={classId}
                    title={c.title}
                    status={c.status}
                    viec={viec.map((l) => ({id: l.id, title: l.title, target: l.target, unit: l.unit}))}
                  />
                )}
              </div>
              {viec.length > 0 ? (
                <div className="mt-2">
                  <LeadTicker
                    leads={viec}
                    studentId={studentId}
                    canTick={canTick}
                    nguoiGhi={viewer.id}
                    today={today}
                    tickOpen={tickOpen}
                  />
                </div>
              ) : (
                <p className="mt-1 text-[12px] font-semibold italic text-grey-mid">{t('noWorkUnder')}</p>
              )}
            </div>
          );
        })}
      </div>
      {canTick && mucTieuCuaEm.length > 0 && (
        <div className={ckTuan.length > 0 ? 'mt-3' : ''}>
          <CamKetCuaEm
            gon
            anDanhSach
            weekStart={weekDays[0]}
            weekLabel={nhanTuanPdr}
            daCo={ckTuan}
            tongDaCo={ckTuan.length}
            dayShort={dayShort}
            wigLop={mucTieuChon}
            wigMacDinh={mucTieuChon.length === 1 ? mucTieuChon[0].id : undefined}
          />
        </div>
      )}
    </section>
  );

  return (
    <div className="mt-4 flex flex-col gap-[22px]">
      {/* Lớp chặn bắt buộc check-in — đặt NGOÀI hero (hero có backdrop-filter, sẽ phá position:fixed) */}
      {mustCheckin && <MoodGate />}
      {flash && <FlashToast message={flash} />}

      {/* Hero: chào mừng + mood check-in (2 cột glass) */}
      <div className="animate-rise grid grid-cols-1 overflow-hidden rounded-[26px] glass md:grid-cols-2">
        <div className="flex items-center gap-[18px] p-7">
          <span className="animate-pop grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[22px] bg-linear-to-b from-gold-soft to-gold font-display text-[28px] font-bold text-navy shadow-[var(--shadow-gold)]">
            ★
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-gold-text">
              {t('title')}
            </div>
            <h1 className="font-display text-[30px] font-bold leading-[1.15] text-navy">
              {t('hello', {name: displayName})}
            </h1>
            {cls && (
              <div className="mt-0.5 text-[13.5px] font-bold text-txt">
                {cls.name} · {cls.school_year}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-navy/[0.08] p-6 md:border-l md:border-t-0">
          {/* Truyền CẢ HAI buổi xuống. Trước 13/08/2026 chỗ này chỉ đưa buổi sáng, còn
              `moodChieu` tính ra ở trên rồi bỏ không — nên buổi chiều không có cách nào hiện,
              và <MoodCheckin> cũng không có cách nào biết mình đang ở buổi nào. */}
          <MoodCheckin
            initialMood={mood}
            initialMoodChieu={(moodChieu?.mood ?? null) as MoodKey | null}
            canEdit={canEditMood}
            gated={mustCheckin}
            gioBam={moodSang?.created_at ?? null}
            gioBamChieu={moodChieu?.created_at ?? null}
            cuaSo={cuaSo}
          />
        </div>
      </div>

      {/* ── MỤC TIÊU NĂM: hai thẻ cạnh nhau, không khung bọc ngoài (17/08/2026). ─────────────── */}
      <section>
        <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('wigYear')}</h2>
        {classId ? (
          <MucTieuCuaCon
            studentId={studentId}
            classId={classId}
            mucTieu={mucTieuCuaEm}
            wigLop={wigLopChon}
            laChinhEm={canTick}
            canManage={canManage}
            namHoc={cls?.school_year ?? null}
            soDoTheoWig={soDoTheoWig}
            tuanChuaChot={tickOpen}
            pctTheoWig={pctTheoWig}
            nhanTheoArea={nhanTheoArea}
          />
        ) : (
          <p className="text-sm italic text-grey-mid">{t('noLeads')}</p>
        )}
      </section>

      {/* ── TUẦN ĐANG XEM: thanh tuần ngay trên khu tuần — thứ nó điều khiển. Trên màn rộng khu
          tuần (việc mỗi ngày, rộng) chiếm 2/3, họp WIG 1/3 bên phải. */}
      <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <ChonTuanCuaEm
            pathname={pathname}
            monday={monday}
            thisMonday={thisMonday}
            label={isoWeekLabel(vnNoon(monday))}
            start={weekDays[0]}
            end={weekDays[6]}
          />
          {classId && khuTuan}
          {/* Học sinh: xin GVCN sửa (vd gỡ tick của ngày đã qua) — hết ngõ cụt phía HS */}
          {/* Nút "Xin sửa" chung ở đây ĐÃ GỠ 18/08/2026: từng cam kết đã duyệt có nút xin sửa riêng
              (SuaCamKet); thêm một nút nữa đứng ngoài thẻ là hai chữ "Xin sửa" trên một màn. */}
          {/* Yêu cầu đã gửi mà GVCN chưa xử lý → còn sửa/rút lại được */}
          {canTick && <MyRequests studentId={studentId} requests={myRequests} />}
          {/* GVCN/Admin: yêu cầu-sửa đang chờ */}
          {canManage && <RequestInbox studentId={studentId} requests={requests} />}
        </div>

      {/* ── HỌP WIG — cột phải trên màn rộng. ("Sổ của bạn" và "Bảng tuần này" đã bỏ 16/08/2026.) */}
      <div className="flex flex-col gap-3">
          {/* Khối "WIG tuần của em" từng đứng ở đây — năm dòng pip thắng/thua theo bốn lĩnh
              vực. Từ 0100 em KHÔNG còn WIG tuần nữa: mục tiêu của em sống cả học kỳ, còn nhịp
              hằng tuần nằm ở việc để tick. Để lại thì nó vĩnh viễn hiện "Chưa thiết lập WIG"
              và giục em đi làm một thứ CSDL đã cấm. Xem docs/MO_HINH_WIG.md §1. */}

          {/* NGHE PHÒNG HỌP MỞ RA. Đặt NGOÀI điều kiện `phongDangMo` — thứ nó canh chính là lúc
              phòng CHƯA mở chuyển thành ĐÃ mở, nên gắn nó vào bên trong lời mời là chỉ nghe sau
              khi đã nghe thấy. Trả về null, không vẽ gì. */}
          {canTick && classId && <NghePhongHop classId={classId} />}

          {/* LỚP ĐANG HỌP — LỜI MỜI ĐẶT NGAY TRÊN BẢNG THÀNH TÍCH (0130).
              Chủ dự án: "khi giáo viên ấn họp, tất cả màn hình của các em đều hiện phòng họp".
              Nút "Vào phòng họp" cũ vẫn ở dưới, nhưng nó nằm lẫn giữa các khối và chỉ ai biết
              đường mới bấm — một buổi họp đang diễn ra thì phải tự nói ra, không đợi em đi tìm. */}
          {canTick && phongDangMo && (
            <Link
              // Trỏ THẲNG vào tuần đang họp, không để trang tự đoán: hai bên đoán khác nhau một
              // lần là em ngồi trong phòng của tuần khác với cả lớp.
              href={{pathname: '/student/hop', query: {hop: phongDangMo.week_start}}}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] border-[1.5px] border-gold-deep/30 bg-gold/[0.14] p-4 transition-transform hover:-translate-y-px"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-gold/40 text-gold-text">
                <Users size={17} strokeWidth={2.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-bold text-navy">
                  {tm('roomInvite')}
                </span>
                <span className="mt-0.5 block text-[12px] font-semibold leading-relaxed text-grey-mid">
                  {tm('roomInviteHint', {week: phongDangMo.week_label})}
                </span>
              </span>
              <span className="btn-gold inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-4 font-display text-[13px] font-black">
                {tm('roomJoin')}
                <ArrowRight size={14} strokeWidth={2.8} />
              </span>
            </Link>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[17px] font-bold text-navy">{t('meetings')}</h2>
              {/* ĐƯỜNG VÀO PHÒNG HỌP — chỉ cho chính em, và chỉ từ đây. Biên bản là thứ của buổi
                  họp; không mở thêm cửa nào khác vào nó. */}
              {canTick && (
                <Link
                  href="/student/hop"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy"
                >
                  {t('enterMeetingRoom')}
                  <ArrowRight size={12} strokeWidth={2.5} />
                </Link>
              )}
            </div>

            {/* BIÊN BẢN CỦA CẢ LỚP. Họp xong thì chiêm nghiệm và lời hứa chung phải có chỗ đứng
                trên màn của từng em suốt tuần — nếu không thì câu cả lớp vừa hứa với nhau chỉ
                sống được đúng buổi họp. */}
            {hopLop && (
              <div className="rounded-[16px] border-[1.5px] border-gold-deep/25 bg-gold/[0.10] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-gold-text">
                    {t('classMinutes')}
                  </span>
                  {/* Biên bản mới nhất thường là của TUẦN TRƯỚC (lớp họp cuối tuần) — phải nói
                      thẳng điều đó, không thì nó đứng cạnh khối PDR "tuần này" và hai nhãn tuần
                      vênh nhau đọc như lỗi (19/08/2026). */}
                  {tenQuanHeTuan(hopLop.week_label) && (
                    <span className="text-[11px] font-extrabold text-navy">
                      {tenQuanHeTuan(hopLop.week_label)}
                    </span>
                  )}
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-navy">
                    {hopLop.week_label}
                    {khoangTuan(hopLop.week_label) && ` · ${khoangTuan(hopLop.week_label)}`}
                  </span>
                </div>
                {hopLop.results && (
                  <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-navy">
                    <b className="text-grey-mid">{t('reflection')}: </b>
                    <span className="whitespace-pre-line">{hopLop.results}</span>
                  </p>
                )}
                {hopLop.commitments && (
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-navy">
                    <b className="text-grey-mid">{t('classPromise')}: </b>
                    <span className="whitespace-pre-line">{hopLop.commitments}</span>
                  </p>
                )}
              </div>
            )}
            {/* HỌP PDR VỚI BUDDY — 6 câu + Ghi nhận (PRD v3 6.2.7). Đứng trên biên bản lớp cũ:
                đây là việc MỖI TUẦN của chính em, còn các khối dưới là thứ để đọc. */}
            <HopPdr
              laChinhEm={canTick}
              tenBuddy={tenBuddy}
              lich={lichBuddy}
              bienBan={pdrRes.data ?? null}
              wigDaDuyet={wigDaDuyet}
              weekLabel={nhanTuanPdr}
              khoangNgay={khoangTuan(nhanTuanPdr)}
              tuanSau={tuanSauPdr}
            />
            {/* PDR 1-1 VỚI GIÁO VIÊN — chỉ hiện khi GVCN đã cài lịch (PRD v3: mỗi tháng một
                lần). Tên riêng không cần: đối tác luôn là GVCN, và RLS hồ sơ không mở tên
                giáo viên cho em qua đường này. */}
            {lichCoachRes.data && (
              <HopPdr
                loai="coach"
                laChinhEm={canTick}
                tenBuddy={[tm('gvcnLabel')]}
                lich={tm('coachDay', {d: lichCoachRes.data.monthly_day ?? 0})}
                bienBan={pdrCoachRes.data ?? null}
                wigDaDuyet={wigDaDuyet}
                weekLabel={nhanTuanPdr}
                khoangNgay={khoangTuan(nhanTuanPdr)}
                tuanSau={tuanSauPdr}
              />
            )}
            {/* PRD §7 "ghi chú Sư Tử" — Sư Tử là LLM (đổi tên từ Buddy 18/08/2026: chữ Buddy nay
                thuộc về bạn học PDR). KHÔNG có nút: mở trang là tự sinh, server
                chặn tối đa 1 lượt/ngày và chỉ gọi LLM khi có tick mới (0043). */}
            {canTick && (
              <BuddyAuto
                hasNote={meetings.some(
                  (m) => m.week_label === isoWeekLabel(new Date()) && Boolean(m.buddy_note),
                )}
              />
            )}
            <StudentMeetings
              meetings={meetings}
              canManage={canManage}
              canChat={canTick}
              tuanNay={nhanTuanPdr}
            />
          </section>
      </div>
      </div>
    </div>
  );
}
