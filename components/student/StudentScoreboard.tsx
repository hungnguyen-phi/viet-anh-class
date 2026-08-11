import {getTranslations, getLocale} from 'next-intl/server';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {clientIp} from '@/lib/ip';
import {
  todayInVN,
  isoWeekLabel,
  nextWeekRangeVN,
  recentWeekLabels,
  weekDaysVN,
  isoDowVN,
} from '@/lib/dates';
import {DonutRing} from '@/components/charts/DonutRing';
import {MoodCheckin, MoodGate, type MoodKey} from '@/components/student/MoodCheckin';
import {LeadTicker, type TickerLead} from '@/components/student/LeadTicker';
import {
  StudentMeetings,
  type StudentMeeting,
  type Classmate,
} from '@/components/student/StudentMeetings';

import {MyRequests, type MyRequest} from '@/components/student/MyRequests';
import {BuddyAuto} from '@/components/student/BuddyAuto';
import {StudentWigManage, type ManageWig, type ManageLead} from '@/components/student/StudentWigManage';
import {RequestInbox, type EditRequest} from '@/components/student/RequestInbox';
import {EditRequestButton} from '@/components/student/EditRequestButton';
import {MeetingScoreboard} from '@/components/wig/MeetingScoreboard';
import {AREAS, areaLabel, areaIcon, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';

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
};
type LeadRow = {
  id: string;
  // wig_id chỉ khối quản lý dùng (gom việc theo từng WIG tuần) — có ở đây vì một câu
  // lead_measures duy nhất nay phục vụ cả bảng tick lẫn khối quản lý.
  wig_id: string;
  title: string;
  target_value: number;
  unit: string | null;
  // 0073 — những thứ trong tuần mà việc này được tick (ISO 1=T2…7=CN).
  active_weekdays: number[] | null;
  // 0076 — một lượt tick đáng bao nhiêu đơn vị của mục tiêu.
  unit_per_tick: number | null;
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
type ClassLeadRow = {
  lead_measure_id: string;
  title: string;
  target_value: number | string;
  unit: string | null;
  active_weekdays: number[] | null;
  // 0077 — chỉ dùng cho cập nhật lạc quan lúc bấm; class_total dưới đây đã nhân sẵn trong SQL.
  unit_per_tick: number | string | null;
  class_total: number | string;
  contributors: number | string;
  class_size: number | string;
  my_dates: string[] | null;
  // 0098 — hai con số của cách đo MỖI EM MỘT BỘ ĐẾM: tổng của chính em, và số em đã đạt đủ.
  my_total: number | string;
  students_done: number | string;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function StudentScoreboard({
  studentId,
  viewer,
  flash,
}: {
  studentId: string;
  viewer: Profile;
  flash?: string;
}) {
  const t = await getTranslations('student');
  const tc = await getTranslations('class');
  const tSW = await getTranslations('studentWig');
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
  // 7 ngày của tuần hiện tại (Thứ Hai → Chủ Nhật). Tính SỚM ở đây vì đợt truy vấn thứ hai cần
  // ngày Thứ Hai để hỏi bảng việc chung của lớp — trước đây đoạn này nằm mãi cuối hàm.
  const weekDays = weekDaysVN(today);

  const locale = await getLocale();

  // Truy vấn song song — RLS tự giới hạn quyền xem.
  const [
    {data: student},
    {data: enr},
    {data: wigRows},
    {data: meetingRows},
    {data: moodRow},
    areaMetaFromCache,
    {data: myRequestRows},
    {data: mWigs},
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
        .select('wig_id, area, period, period_label, start_date, end_date, unit, pct, status')
        .eq('student_id', studentId)
        .eq('scope', 'student')
        .in('period', ['year', 'week']),
      supabase
        .from('wig_meetings')
        .select(
          'id, week_label, results, commitments, next_actions, buddy_note, buddy_action, buddy_focus_lead_id, buddy_chat_open, created_at, buddy:profiles!wig_meetings_buddy_id_fkey(full_name), buddy_messages(id, role, content, created_at)',
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
      getAreaMeta(),
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
      canManage
        ? supabase
            .from('wigs')
            .select('id, area, period, period_label, target_value, unit')
            .eq('student_id', studentId)
            .eq('scope', 'student')
        : Promise.resolve({data: null}),
      canManage
        ? supabase
            .from('edit_requests')
            .select('id, kind, ref_id, message, created_at, requester:profiles!edit_requests_requester_id_fkey(full_name)')
            .eq('student_id', studentId)
            .eq('status', 'pending')
            .order('created_at', {ascending: false})
        : Promise.resolve({data: null}),
    ]);
  const areaMeta = areaMetaFromCache;

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
  const wigByArea = new Map(yearRows.map((r) => [r.area, r]));
  const weeksByArea = new Map<string, WigRow[]>();
  for (const w of weekRows) {
    const arr = weeksByArea.get(w.area) ?? [];
    arr.push(w);
    weeksByArea.set(w.area, arr);
  }

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
  // Bảng điểm "cầm mà họp" ở cuối trang đọc từ ĐÂY, không tự hỏi lại CSDL nữa: cùng dải ngày,
  // cùng dữ liệu, mà bớt được hai tầng chờ sâu nhất trang (xem MeetingScoreboard).
  const wonByArea = new Map(wigTuanNay.map((w) => [w.area, Number(w.pct ?? 0) >= 1]));


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

  const [cuaSoRes, ipRes, mangRes, daHopRes, matesRes, leadRes, classLeadRes] =
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
      ? supabase.rpc('tuan_da_hop', {p_class: classId, d: today})
      : Promise.resolve({data: false}),

    // ── Bốn câu dưới đây trước là "ĐỢT HAI", một tầng chờ riêng ────────────────────────────
    // Chúng chỉ cần classId và weekIds — cả hai đã biết xong ngay sau đợt truy vấn đầu tiên, nên
    // đứng riêng một tầng là bắt người dùng chờ thêm một vòng đi-về không đổi lấy gì.
    canManage && classId
      ? supabase
          .from('enrollments')
          .select('student_id, profiles!enrollments_student_id_fkey(full_name)')
          .eq('class_id', classId)
          .eq('is_active', true)
          .neq('student_id', studentId)
      : Promise.resolve({data: null}),
    weekIds.length > 0
      ? supabase
          .from('lead_measures')
          .select(
            'id, wig_id, title, target_value, unit, active_weekdays, unit_per_tick, lead_progress(id, value, logged_date, created_at, logged_by, student_id)',
          )
          .in('wig_id', weekIds)
      : Promise.resolve({data: null}),
    // VIỆC CHUNG CỦA LỚP (0073). Phải đi qua RPC chứ không hỏi thẳng bảng: RLS chỉ cho một em đọc
    // dòng tick của CHÍNH em, nên nếu hỏi thẳng thì con số "cả lớp" hiện ra đúng bằng phần của em
    // — mà đây là scoreboard của cả đội, em phải thấy tỷ số chung mới biết lớp đang thắng hay thua.
    classId
      ? supabase.rpc('class_lead_board', {
          p_class: classId,
          p_week_start: weekDays[0],
          // GVCN/phụ huynh mở trang của một em thì `my_dates` là của EM ĐÓ, không phải của người
          // đang xem. Hàm tự kiểm quyền; truyền id bừa thì rơi về chính mình.
          p_student: studentId,
        })
      : Promise.resolve({data: null}),
  ]);
  const mates = matesRes.data;
  const leadData = leadRes.data;
  const classLeadData = classLeadRes.data;

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
      buddy: {full_name: string | null} | null;
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
    buddy_name: m.buddy?.full_name ?? null,
  }));
  const focusIdByMeeting = new Map(
    (
      (meetingRows ?? []) as unknown as {id: string; buddy_focus_lead_id: string | null}[]
    ).map((m) => [m.id, m.buddy_focus_lead_id]),
  );

  const classmates: Classmate[] = (
    (mates ?? []) as unknown as {student_id: string; profiles: {full_name: string | null} | null}[]
  )
    .map((r) => ({id: r.student_id, name: r.profiles?.full_name ?? r.student_id}))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));


  const leadRows = (leadData ?? []) as unknown as LeadRow[];

  // "Việc đã xong: 3/5" của bảng điểm họp — tính TẠI ĐÂY từ dữ liệu vừa lấy, thay cho một truy
  // vấn lead_measures thứ hai ở tầng sâu nhất trang.
  //
  // Tick phải nằm trong TUẦN đang xét: không ràng thì một việc đã đạt ở tuần trước vẫn được đếm
  // "hoàn thành" cho tuần này, và buổi họp đọc ra một con số không thuộc về tuần mình đang bàn.
  // unit_per_tick (0076): một lượt tick đáng bao nhiêu đơn vị của mục tiêu — không nhân thì bảng
  // họp hiện 3 trong khi thanh tiến độ ngay trên nó hiện 90.
  const leadsTotal = leadRows.length;
  const leadsDone = leadRows.filter((l) => {
    const moiTick = Number(l.unit_per_tick ?? 1) || 1;
    const dat = (l.lead_progress ?? [])
      .filter((p) => p.logged_date >= tuanNay.dau && p.logged_date <= tuanNay.cuoi)
      .reduce((s, p) => s + Number(p.value ?? 0) * moiTick, 0);
    return Number(l.target_value) > 0 && dat >= Number(l.target_value);
  }).length;
  const classLeadRows = (classLeadData ?? []) as unknown as ClassLeadRow[];

  // 7 ngày của tuần → còn những THỨ mà việc đó áp dụng (0073). Trước đây bảng tick luôn bày đủ
  // T2…CN cho mọi việc, kể cả việc chỉ làm ở lớp — em không biết cuối tuần có phải tick không.
  const daysFor = (w: number[] | null) => {
    const on = new Set(w ?? [1, 2, 3, 4, 5, 6, 7]);
    return weekDays.filter((d) => on.has(isoDowVN(d)));
  };

  // VIỆC CHUNG đứng trước việc riêng: đây là thứ quyết định lớp thắng hay thua tuần này.
  const tickerLeads: TickerLead[] = [
    ...classLeadRows.map((l) => ({
      id: l.lead_measure_id,
      title: l.title,
      target: Number(l.target_value),
      unit: l.unit,
      kind: 'class' as const,
      days: daysFor(l.active_weekdays),
      myDates: l.my_dates ?? [],
      // class_total từ RPC ĐÃ nhân hệ số trong SQL (0076); truyền hệ số xuống chỉ để cập nhật lạc
      // quan lúc bấm nhích đúng bằng chừng ấy, không phải bằng 1.
      unitPerTick: Number(l.unit_per_tick ?? 1) || 1,
      classTotal: Number(l.class_total),
      contributors: Number(l.contributors),
      classSize: Number(l.class_size),
      myTotal: Number(l.my_total),
      studentsDone: Number(l.students_done),
    })),
    ...leadRows.map((l) => ({
      id: l.id,
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
      classTotal: null,
      contributors: null,
      classSize: null,
      myTotal: null,
      studentsDone: null,
    })),
  ];
  // Chỉ việc RIÊNG mới xin đổi tên được: việc chung là của cả lớp, một em đổi tên là đổi cho
  // mọi người — chỗ sửa nó là buổi họp WIG với GVCN.
  const myLeadOptions = leadRows.map((l) => ({id: l.id, title: l.title}));

  // GVCN/Admin: dữ liệu QUẢN LÝ WIG/lead/tick cá nhân + yêu cầu-sửa đang chờ (audit: hết ngõ cụt).
  let manageWigs: ManageWig[] = [];
  let manageLeads: ManageLead[] = [];
  let requests: EditRequest[] = [];
  if (canManage) {
    // Không còn truy vấn nào ở đây: `mWigs`/`reqs` đã lấy từ đợt một, `leadRows` từ đợt hai.
    manageWigs = ((mWigs ?? []) as {id: string; area: string; period: string; period_label: string | null; target_value: number; unit: string}[]).map((w) => ({
      id: w.id,
      areaLabel: areaLabel(areaMeta[w.area as Area], locale),
      periodLabel: (w.period === 'year' ? tSW('yearTag') : tSW('weekTag')) + (w.period_label ? ` · ${w.period_label}` : ''),
      isYear: w.period === 'year',
      target: Number(w.target_value),
      unit: w.unit,
      period_label: w.period_label,
    }));
    manageLeads = leadRows.map((l) => ({
      id: l.id,
      wigId: l.wig_id,
      title: l.title,
      target: Number(l.target_value),
      unit: l.unit,
      entries: (l.lead_progress ?? []).map((e) => ({id: e.id, date: e.logged_date})),
    }));
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
  const displayName = student.full_name ?? student.email;
  const hasWeek = weekRows.length > 0;

  return (
    <div className="mt-4 flex flex-col gap-[22px]">
      {/* Lớp chặn bắt buộc check-in — đặt NGOÀI hero (hero có backdrop-filter, sẽ phá position:fixed) */}
      {mustCheckin && <MoodGate />}
      {flash && (
        <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-bold text-success-dark">
          {flash}
        </div>
      )}

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
          <MoodCheckin
            initialMood={mood}
            canEdit={canEditMood}
            gated={mustCheckin}
            gioBam={moodSang?.created_at ?? null}
            cuaSo={cuaSo}
          />
        </div>
      </div>

      {/* Khối "GVCN thiết lập WIG cá nhân 1 chạm" từng đứng ở đây — đặt WIG năm cho em bằng cách
          chia mục tiêu lớp cho sĩ số. Bỏ cùng đợt 0100; thay bằng tiết đặt mục tiêu, nơi chính em
          gõ khoảng cách của mình. Xem docs/MO_HINH_WIG.md §6.2. */}

      {/* GVCN/Admin: yêu cầu-sửa đang chờ + quản lý WIG/lead/tick cá nhân (hết ngõ cụt) */}
      {canManage && <RequestInbox studentId={studentId} requests={requests} />}
      {canManage && <StudentWigManage studentId={studentId} wigs={manageWigs} leads={manageLeads} />}

      {/* WIG năm — bento ring theo màu môn */}
      <section>
        <h2 className="font-display text-[17px] font-bold text-navy">{t('wigYear')}</h2>
        <p className="mb-3 mt-0.5 max-w-[640px] text-[12px] font-semibold leading-relaxed text-grey-mid">
          {tc('wigGloss')}
        </p>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {AREAS.map((a) => {
            const w = wigByArea.get(a);
            const s = areaMeta[a];
            const Icon = areaIcon(s);
            return (
              <div key={a} className="glass glass-hover rounded-[20px] p-4">
                <div className="flex items-center gap-[7px] text-[13.5px] font-extrabold text-navy">
                  <span
                    className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg"
                    style={{background: s.soft, color: s.hex}}
                  >
                    <Icon size={15} strokeWidth={2.5} />
                  </span>
                  {areaLabel(s, locale)}
                </div>
                <div className="mt-3.5 flex justify-center">
                  {w ? (
                    <DonutRing pct={Number(w.pct ?? 0)} color={s.hex} />
                  ) : (
                    <div className="grid h-[78px] place-items-center text-xs font-semibold text-grey-mid">
                      {tc('noWig')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lead measure tuần + WIG tuần + Họp WIG (2 cột) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="font-display text-[17px] font-bold text-navy">{t('leads')}</h2>
            <span className="text-xs font-bold text-grey-mid">{t('leadsHint')}</span>
          </div>
          {tickerLeads.length === 0 ? (
            <p className="text-sm italic text-grey-mid">{t('noLeads')}</p>
          ) : (
            <LeadTicker
              leads={tickerLeads}
              studentId={studentId}
              // GVCN/Admin tick HỘ được — chủ dự án chốt 10/08/2026 ("vẫn có gv tick hộ"), cho
              // em nghỉ ốm, quên máy, hoặc lớp nhỏ chưa dùng điện thoại. Quyền ở CSDL đã mở sẵn
              // (rls_all_lead_progress); trước bản này màn hình chỉ có đường GỠ tick.
              canTick={canTick || canManage}
              // Công vẫn thuộc về EM (student_id), chỉ ghi lại ai là người bấm.
              nguoiGhi={viewer.id}
              today={today}
              tickOpen={tickOpen}
            />
          )}
          {/* Học sinh: xin GVCN sửa (vd gỡ tick của ngày đã qua, đổi mục tiêu) — hết ngõ cụt phía HS */}
          {canTick && classId && (
            <div className="mt-3">
              <EditRequestButton studentId={studentId} classId={classId} leads={myLeadOptions} />
            </div>
          )}
          {/* Yêu cầu đã gửi mà GVCN chưa xử lý → còn sửa/rút lại được */}
          {canTick && <MyRequests studentId={studentId} requests={myRequests} />}
        </section>

        <div className="flex flex-col gap-[22px]">
          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('wigWeek')}</h2>
            {hasWeek ? (
              <div className="glass rounded-[20px]">
                {AREAS.map((a, i) => {
                  const weeks = weeksByArea.get(a) ?? [];
                  const wins = weeks.filter((w) => Number(w.pct ?? 0) >= 1).length;
                  const s = areaMeta[a];
                  return (
                    <div
                      key={a}
                      className={`flex flex-wrap items-center gap-x-[9px] gap-y-1.5 px-3.5 py-3 ${
                        i < AREAS.length - 1 ? 'border-b border-navy/[0.08]' : ''
                      }`}
                    >
                      <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{background: s.hex}} />
                      <span className="whitespace-nowrap text-[13px] font-extrabold text-navy">
                        {areaLabel(s, locale)}
                      </span>
                      <span className="flex-1" />
                      <span className="flex gap-[3px]">
                        {weeks.length === 0 ? (
                          <span className="text-xs italic text-grey-mid">{tc('noWeekWig')}</span>
                        ) : (
                          weeks.slice(-5).map((w) => {
                            const won = Number(w.pct ?? 0) >= 1;
                            return (
                              <svg
                                key={w.wig_id}
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill={won ? '#f9dd0e' : 'transparent'}
                                stroke={won ? '#e3b400' : 'rgba(38,39,93,0.2)'}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            );
                          })
                        )}
                      </span>
                      {weeks.length > 0 && (
                        <span className="w-9 text-right font-display text-[15px] font-bold" style={{color: s.hex}}>
                          {wins}
                          <span className="text-[11.5px] text-grey-mid">/{weeks.length}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic text-grey-mid">{tc('noWig')}</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[17px] font-bold text-navy">{t('meetings')}</h2>
            {/* PRD Màn 6: "cầm scoreboard mà họp" — panel WIG tuần/lead của em */}
            {/* weekDays đã là 7 ngày của tuần hiện tại theo lịch VN (tính ở đầu hàm, cùng nguồn
                `today`) — truyền xuống để bảng điểm họp lọc theo NGÀY, khớp với dải ô tick ngay
                trên nó, thay vì theo nhãn kỳ do người gõ. */}
            {classId && (
              <MeetingScoreboard
                weekLabel={isoWeekLabel(new Date())}
                areaMeta={areaMeta}
                wonByArea={wonByArea}
                leadsDone={leadsDone}
                leadsTotal={leadsTotal}
              />
            )}
            {/* PRD §7 "ghi chú Buddy" — Buddy là LLM. KHÔNG có nút: mở trang là tự sinh, server
                chặn tối đa 1 lượt/ngày và chỉ gọi LLM khi có tick mới (0043). */}
            {canTick && (
              <BuddyAuto
                hasNote={meetings.some(
                  (m) => m.week_label === isoWeekLabel(new Date()) && Boolean(m.buddy_note),
                )}
              />
            )}
            <StudentMeetings
              studentId={studentId}
              classId={classId}
              meetings={meetings}
              classmates={classmates}
              canManage={canManage}
              canChat={canTick}
              defaultWeek={isoWeekLabel(new Date())}
              weekOptions={recentWeekLabels(6)}
              // Chỉ lĩnh vực đã có WIG NĂM: WIG tuần bắt buộc có parent_wig_id trỏ về WIG năm.
              planAreas={yearRows.map((r) => ({
                value: r.area,
                label: areaLabel(areaMeta[r.area as Area], locale),
                unit: r.unit,
              }))}
              nextWeekLabel={nextWeekRangeVN().label}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
