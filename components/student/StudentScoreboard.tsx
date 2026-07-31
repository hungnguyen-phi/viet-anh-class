import {getTranslations, getLocale} from 'next-intl/server';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {clientIp} from '@/lib/ip';
import {todayInVN, isoWeekLabel, nextWeekRangeVN, recentWeekLabels} from '@/lib/dates';
import {DonutRing} from '@/components/charts/DonutRing';
import {MoodCheckin, MoodGate, type MoodKey} from '@/components/student/MoodCheckin';
import {LeadTicker, type TickerLead} from '@/components/student/LeadTicker';
import {
  StudentMeetings,
  type StudentMeeting,
  type Classmate,
} from '@/components/student/StudentMeetings';
import {StudentWigSetup} from '@/components/student/StudentWigSetup';
import {MyRequests, type MyRequest} from '@/components/student/MyRequests';
import {BuddyAuto} from '@/components/student/BuddyAuto';
import {StudentWigManage, type ManageWig, type ManageLead} from '@/components/student/StudentWigManage';
import {RequestInbox, type EditRequest} from '@/components/student/RequestInbox';
import {EditRequestButton} from '@/components/student/EditRequestButton';
import {MeetingScoreboard} from '@/components/wig/MeetingScoreboard';
import {AREAS, buildAreaMeta, areaLabel, areaIcon, type Area} from '@/lib/areas';

// Màu/icon/nhãn môn lấy từ area_config (fallback = --color-subj-* cũ ⇒ parity).

type WigRow = {
  wig_id: string;
  area: string;
  period: string;
  period_label: string | null;
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
  lead_progress:
    | {id: string; value: number; logged_date: string; created_at: string; logged_by: string | null}[]
    | null;
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

  const locale = await getLocale();

  // Truy vấn song song — RLS tự giới hạn quyền xem.
  const [
    {data: student},
    {data: enr},
    {data: wigRows},
    {data: meetingRows},
    {data: moodRow},
    {data: areaCfg},
    {data: myRequestRows},
    {data: mWigs},
    {data: reqs},
  ] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('id', studentId).maybeSingle(),
      supabase
        .from('enrollments')
        .select('class_id, classes(name, school_year, tick_lock_dow)')
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
        .select('wig_id, area, period, period_label, end_date, unit, pct, status')
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
      supabase
        .from('mood_checkins')
        .select('mood')
        .eq('student_id', studentId)
        .eq('date', today)
        .maybeSingle(),
      supabase.from('area_config').select('*').order('sort_order'),
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
  const areaMeta = buildAreaMeta(areaCfg);

  if (!student) {
    return (
      <div className="animate-rise glass mt-4 rounded-[26px] p-10 text-center">
        <p className="text-sm font-semibold text-grey-mid">{t('notFound')}</p>
      </div>
    );
  }

  const enrRow = enr as unknown as {
    class_id: string;
    classes: {name: string; school_year: string; tick_lock_dow: number | null} | null;
  } | null;
  const cls = enrRow?.classes;
  const classId = enrRow?.class_id ?? null;
  const mood = (moodRow?.mood ?? null) as MoodKey | null;

  // BẮT BUỘC check-in: chỉ chặn khi CHÍNH em đó chưa check-in hôm nay VÀ đang ở trong mạng
  // trường. Ngoài mạng trường (ở nhà/4G) student_checkin() trả 'blocked' → nếu vẫn chặn thì em
  // bị khoá cứng không tự thoát được, nên cho vào xem read-only (quyết định 2026-07-26).
  let mustCheckin = false;
  if (canEditMood && mood === null) {
    const ip = clientIp(await headers());
    // PHẢI gọi bằng service_role: migration 0031 đã revoke ip_allowed khỏi vai 'authenticated'
    // (để học sinh không dò được cấu hình mạng trường). Bản trước gọi bằng client thường nên
    // Supabase trả 403 ở MỌI lần học sinh mở trang — thấy rõ trong log API. Lỗi này im lặng:
    // data về undefined → mustCheckin=false → cổng không bao giờ chặn, mà mỗi lượt vẫn tốn một
    // vòng mạng hỏng.
    const {createAdminClient} = await import('@/lib/supabase/admin');
    const {data: onSchoolNetwork} = await createAdminClient().rpc('ip_allowed', {p_ip: ip ?? ''});
    mustCheckin = onSchoolNetwork === true;
  }

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
  const currentWeekLabel = isoWeekLabel(new Date());
  const weekIds = weekRows.filter((w) => w.period_label === currentWeekLabel).map((w) => w.wig_id);

  // ĐỢT HAI — HAI CÂU CÒN LẠI, CHẠY CÙNG NHAU.
  //
  // Trước đây ba vòng mạng nối đuôi: bạn cùng lớp → chờ → lead_measures (bảng tick) → chờ →
  // lead_measures (khối quản lý). Không câu nào cần kết quả của câu trước: bạn cùng lớp chỉ cần
  // classId, hai câu lead chỉ cần weekIds — cả hai đã biết xong ngay sau đợt một.
  //
  // Và hai câu lead_measures ấy HỎI TRÙNG NHAU: cùng bảng, cùng `.in('wig_id', weekIds)`, chỉ
  // khác bộ cột. Nay hỏi một lần với hợp của hai bộ (bảng tick cần value/created_at/logged_by,
  // khối quản lý cần wig_id) rồi tách ở phía dưới. Ba vòng → một.
  const [{data: mates}, {data: leadData}] = await Promise.all([
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
            'id, wig_id, title, target_value, unit, lead_progress(id, value, logged_date, created_at, logged_by)',
          )
          .in('wig_id', weekIds)
      : Promise.resolve({data: null}),
  ]);

  const classmates: Classmate[] = (
    (mates ?? []) as unknown as {student_id: string; profiles: {full_name: string | null} | null}[]
  )
    .map((r) => ({id: r.student_id, name: r.profiles?.full_name ?? r.student_id}))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const leadRows = (leadData ?? []) as unknown as LeadRow[];
  const tickerLeads: TickerLead[] = leadRows.map((l) => ({
    id: l.id,
    title: l.title,
    target: Number(l.target_value),
    unit: l.unit,
    entries: (l.lead_progress ?? []).map((p) => ({
      id: p.id,
      value: Number(p.value ?? 0),
      loggedDate: p.logged_date,
      createdAt: p.created_at,
      mine: p.logged_by === viewer.id,
    })),
  }));

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


  // 7 ngày của tuần hiện tại (Thứ Hai → Chủ Nhật) cho dải tick, và tuần còn mở hay đã chốt.
  // Phải khớp luật RLS ở 0046: trong tuần, không quá hôm nay, và hôm nay chưa qua ngày chốt.
  // Tính từ `today` (app_today, giờ VN) chứ không từ giờ máy chủ.
  const weekMonday = new Date(`${today}T00:00:00Z`);
  const isoDow = weekMonday.getUTCDay() === 0 ? 7 : weekMonday.getUTCDay();
  weekMonday.setUTCDate(weekMonday.getUTCDate() - (isoDow - 1));
  const weekDays = Array.from({length: 7}, (_, i) => {
    const d = new Date(weekMonday);
    d.setUTCDate(weekMonday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const tickOpen = isoDow <= (cls?.tick_lock_dow ?? 7);

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
  // C6 — trạng thái WIG cá nhân để hiện bảng thiết lập cho GVCN.
  const hasYear = yearRows.length > 0;
  const thisWeekLabel = isoWeekLabel(new Date());
  const hasThisWeek = weekRows.some((w) => w.period_label === thisWeekLabel);

  return (
    <div className="mt-4 flex flex-col gap-[22px]">
      {/* Lớp chặn bắt buộc check-in — đặt NGOÀI hero (hero có backdrop-filter, sẽ phá position:fixed) */}
      {mustCheckin && <MoodGate />}
      {flash && (
        <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-bold text-success">
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
          <MoodCheckin initialMood={mood} canEdit={canEditMood} gated={mustCheckin} />
        </div>
      </div>

      {/* C6 — GVCN thiết lập WIG cá nhân (đặt WIG năm / tạo WIG tuần 1 chạm) */}
      {canManage && classId && (
        <StudentWigSetup
          studentId={studentId}
          classId={classId}
          hasYear={hasYear}
          hasThisWeek={hasThisWeek}
          weekLabel={thisWeekLabel}
        />
      )}

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
              canTick={canTick}
              today={today}
              weekDays={weekDays}
              tickOpen={tickOpen}
            />
          )}
          {/* Học sinh: xin GVCN sửa (vd gỡ tick của ngày đã qua, đổi mục tiêu) — hết ngõ cụt phía HS */}
          {canTick && classId && (
            <div className="mt-3">
              <EditRequestButton
                studentId={studentId}
                classId={classId}
                leads={tickerLeads.map((l) => ({id: l.id, title: l.title}))}
              />
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
            {classId && <MeetingScoreboard classId={classId} studentId={studentId} weekLabel={isoWeekLabel(new Date())} />}
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
