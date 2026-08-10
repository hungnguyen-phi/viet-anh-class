import {after} from 'next/server';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Check, X, Trophy, Images, ChevronRight} from 'lucide-react';
import {TodayMenuCard} from '@/components/menu/TodayMenuCard';
import {Link} from '@/i18n/navigation';
import {DonutRing} from '@/components/charts/DonutRing';
import {WeekPicker} from '@/components/report/WeekPicker';
import {AREAS, areaLabel} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {weekRangeVN} from '@/lib/dates';

type WeekReportRow = {
  area: string;
  wig_actual: number;
  wig_target: number;
  wig_won: boolean;
  leads_total: number;
  leads_done: number;
};
type YearProg = {area: string; pct: number | null; status: string | null};
type Meeting = {results: string | null; commitments: string | null; next_actions: string | null};

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{week?: string; child?: string}>;
}) {
  const {locale} = await params;
  const {week: weekParam, child: childParam} = await searchParams;
  setRequestLocale(locale);
  // Chỉ phụ huynh — admin đã có /admin và /student/[id], không xem báo cáo con ngẫu nhiên.
  await requireRole(['parent']);
  const t = await getTranslations('report');
  const tArea = await getTranslations('class');
  const supabase = await createClient();

  // Hai câu này KHÔNG phụ thuộc nhau — trước đây await lần lượt, tức là hai vòng mạng xếp hàng
  // cho không. Cấu hình lĩnh vực và danh sách con là hai thứ chẳng liên quan gì.
  const [areaMetaFromCache, {data: links}] = await Promise.all([
    getAreaMeta(),
    // TẤT CẢ con của phụ huynh (RLS pl_parent_self chỉ trả link của chính họ).
    supabase.from('parent_links').select('student_id, profiles!parent_links_student_id_fkey(full_name)'),
  ]);
  const areaMeta = areaMetaFromCache;
  const children = ((links ?? []) as unknown as {student_id: string; profiles: {full_name: string | null} | null}[])
    .map((l) => ({id: l.student_id, name: l.profiles?.full_name ?? l.student_id}))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  // Con đang xem: theo ?child= nếu hợp lệ (thuộc phụ huynh), ngược lại con đầu.
  const childId = childParam && children.some((c) => c.id === childParam) ? childParam : children[0]?.id;

  if (!childId) {
    return (
      <div className="glass rounded-[26px] p-10 text-center">
        <h1 className="font-display text-xl font-bold text-navy">{t('title')}</h1>
        <p className="mt-2 text-sm text-grey-mid">{t('noChild')}</p>
      </div>
    );
  }

  // Đợt 1 (song song, chỉ phụ thuộc childId): hồ sơ con, lớp, điểm danh tổng quan,
  // tiến độ WIG năm cá nhân (view — parent đọc được qua wig_parent_read), danh sách tuần.
  const [{data: child}, {data: enr}, {data: att}, {data: yearRows}, {data: weeksData}] =
    await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', childId).maybeSingle(),
      supabase
        .from('enrollments')
        .select('classes(name, school_year)')
        .eq('student_id', childId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      supabase.from('attendance_records').select('status').eq('student_id', childId),
      supabase
        .from('wig_progress_v')
        .select('area, pct, status')
        .eq('student_id', childId)
        .eq('scope', 'student')
        .eq('period', 'year'),
      supabase.rpc('child_weeks', {s: childId}),
    ]);

  const cls = (enr as unknown as {classes: {name: string; school_year: string} | null} | null)
    ?.classes;
  const counts: Record<string, number> = {present: 0, absent: 0, late: 0, excused: 0};
  (att ?? []).forEach((a) => {
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  });
  const yearByArea = new Map((yearRows ?? []).map((r) => [(r as YearProg).area, r as YearProg]));
  // Bộ chọn tuần nói bằng NGÀY, không bằng mã "W31-2026" (0083). Nhãn vẫn là khoá tra cứu cho
  // child_week_report(), nhưng nó không còn là thứ phụ huynh phải đọc.
  const dsTuan = (weeksData ?? []) as {week_label: string; week_start: string; week_end: string}[];
  const weeks = dsTuan.map((w) => w.week_label);
  const week = weekParam && weeks.includes(weekParam) ? weekParam : weeks[0];
  // Tuần mở sẵn có thể là một tuần ĐÃ QUA (danh sách chỉ gồm tuần con có việc). Trước đây không
  // có gì nói ra, nên bố mẹ đọc số của tuần trước mà tưởng là tuần này.
  const tuanNayISO = weekRangeVN().start;
  const tuanDangXem = dsTuan.find((w) => w.week_label === week);

  // Đợt 2 (phụ thuộc tuần đã chọn): báo cáo tuần (WIG thắng/tổng + LM hoàn thành/tổng) + biên bản họp.
  let weekRows: WeekReportRow[] = [];
  let meeting: Meeting | null = null;
  if (week) {
    const [{data: wr}, {data: mtg}] = await Promise.all([
      supabase.rpc('child_week_report', {s: childId, wk: week}),
      // TRA THEO NGÀY khi biết ngày (0080/0083). Nhãn tuần là ô CHỮ giáo viên sửa được, nên tra
      // theo nhãn thì ai gõ lại thành "Tuần 31" là biên bản biến mất khỏi báo cáo của gia đình —
      // lặng lẽ, và phụ huynh là người ít có khả năng phát hiện nhất. Nhãn chỉ còn là đường lùi
      // cho biên bản cũ chưa có ngày.
      tuanDangXem?.week_start
        ? supabase
            .from('wig_meetings')
            .select('results, commitments, next_actions')
            .eq('student_id', childId)
            .eq('week_start', tuanDangXem.week_start)
            .maybeSingle()
        : supabase
            .from('wig_meetings')
            .select('results, commitments, next_actions')
            .eq('student_id', childId)
            .eq('week_label', week)
            .maybeSingle(),
    ]);
    weekRows = (wr ?? []) as WeekReportRow[];
    meeting = (mtg ?? null) as Meeting | null;
  }
  const weekByArea = new Map(weekRows.map((r) => [r.area, r]));

  const statuses = ['present', 'absent', 'late', 'excused'] as const;
  const statusColor: Record<string, string> = {
    present: 'text-success-dark',
    absent: 'text-status-bad',
    late: 'text-warn-text',
    excused: 'text-grey-mid',
  };

  // Ghi audit truy cập báo cáo nhạy cảm (§12.4).
  //
  // KHÔNG await — ghi log là việc của hệ thống, người dùng không việc gì phải đứng chờ nó xong
  // mới được xem báo cáo về con mình. Trước đây await ở đây chặn nguyên phần render, tốn thêm
  // một vòng mạng vào đúng lúc người dùng đang chờ. after() của Next chạy nó SAU khi trả xong
  // phản hồi. Trang /campus đã sửa đúng lỗi này rồi (campus/page.tsx) — chỗ này bị sót.
  after(() => {
    void supabase.rpc('log_audit', {
      p_action: 'view_parent_report',
      p_detail: {student_id: childId, week: week ?? null},
    });
  });

  return (
    <div className="space-y-6">
      {/* Hero + bộ lọc tuần */}
      <div className="glass animate-rise rounded-[26px] p-6 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[27px] font-bold leading-tight text-navy">
              {child?.full_name ?? t('child')}
            </h1>
            {cls && (
              <p className="mt-1 text-[13px] font-bold text-txt">
                {t('class')}: <b className="text-navy">{cls.name}</b>{' '}
                <span className="text-grey-mid">· {cls.school_year}</span>
              </p>
            )}
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            {/* Chọn con khi phụ huynh có nhiều hơn 1 con */}
            {children.length > 1 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {children.map((c) => (
                  <Link
                    key={c.id}
                    href={{pathname: '/report', query: {child: c.id}}}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
                      c.id === childId
                        ? 'border-navy bg-navy text-white'
                        : 'border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            {dsTuan.length > 0 && week && (
              <WeekPicker
                weeks={dsTuan.map((w) => ({
                  label: w.week_label,
                  start: w.week_start,
                  end: w.week_end,
                  laTuanNay: w.week_start === tuanNayISO,
                }))}
                current={week}
                label={t('selectWeek')}
                nowTag={t('thisWeek')}
              />
            )}
            <span className="text-[10.5px] font-semibold italic text-grey-mid">{t('readOnly')}</span>
          </div>
        </div>
      </div>

      {/* Điểm danh tổng quan */}
      <section>
        <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('attendance')}</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {statuses.map((s) => (
            <div key={s} className="glass glass-hover rounded-[20px] p-4 text-center">
              <div className={`font-display text-[26px] font-bold ${statusColor[s]}`}>
                {counts[s] ?? 0}
              </div>
              <div className="mt-1 text-xs font-extrabold text-txt">{t(s)}</div>
            </div>
          ))}
        </div>
        {/* NÓI RÕ BỐN Ô NÀY KHÔNG THEO TUẦN.
            Chúng nằm ngay dưới bộ chọn tuần, nên bố mẹ bấm đổi tuần rồi nhìn xuống thấy số không
            nhúc nhích — và kết luận app hỏng. Con số vẫn đúng, chỉ là nó trả lời một câu hỏi khác. */}
        <p className="mt-2 text-[11.5px] font-semibold italic leading-relaxed text-grey-mid">
          {t('attendanceNote')}
        </p>
      </section>

      {/* Kết quả tuần được chọn: WIG thắng/tổng + LM hoàn thành/tổng theo 4 lĩnh vực */}
      <section>
        <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 font-display text-[17px] font-bold text-navy">
          {t('weekResult')}
          {tuanDangXem && (
            <span className="text-[13px] font-bold text-grey-mid">
              {tuanDangXem.week_start.slice(8, 10)}/{tuanDangXem.week_start.slice(5, 7)} →{' '}
              {tuanDangXem.week_end.slice(8, 10)}/{tuanDangXem.week_end.slice(5, 7)}
            </span>
          )}
          {tuanDangXem && tuanDangXem.week_start !== tuanNayISO && (
            <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[11px] font-extrabold text-grey-mid">
              {t('pastWeek')}
            </span>
          )}
        </h2>
        {weeks.length === 0 ? (
          <p className="text-xs italic text-grey-mid">{t('noWeeks')}</p>
        ) : weekRows.length === 0 ? (
          <p className="text-xs italic text-grey-mid">{t('noWeekData')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {AREAS.map((a) => {
              const r = weekByArea.get(a);
              if (!r) {
                return (
                  <div key={a} className="glass rounded-[20px] p-4">
                    <div className="text-[13.5px] font-extrabold text-navy">
                      {areaLabel(areaMeta[a], locale)}
                    </div>
                    <p className="mt-3 text-xs italic text-grey-mid">{t('noWeekData')}</p>
                  </div>
                );
              }
              return (
                <div key={a} className="glass glass-hover rounded-[20px] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-extrabold whitespace-nowrap text-navy">
                      {areaLabel(areaMeta[a], locale)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold"
                      style={{
                        background: r.wig_won ? 'rgba(30,138,90,0.12)' : 'rgba(192,57,43,0.12)',
                        color: r.wig_won ? 'var(--color-success-dark)' : 'var(--color-status-bad)',
                      }}
                    >
                      {r.wig_won ? (
                        <Check size={11} strokeWidth={2.5} />
                      ) : (
                        <X size={11} strokeWidth={2.5} />
                      )}
                      {r.wig_won ? t('won') : t('notWon')}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold text-grey-mid">{t('wigWon')}</span>
                    <b className="font-display font-bold text-navy">
                      {Number(r.wig_actual)}
                      <span className="text-grey-mid">/{Number(r.wig_target)}</span>
                    </b>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="font-semibold text-grey-mid">{t('leadDone')}</span>
                    <b className="font-display font-bold text-navy">
                      {r.leads_done}
                      <span className="text-grey-mid">/{r.leads_total}</span>
                    </b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Chiêm nghiệm tuần + Tiến độ WIG năm cá nhân (2 cột như prototype) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Chiêm nghiệm + tuần sau (từ biên bản họp WIG cá nhân Coach×Buddy) */}
        {week && (
          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('reflection')}</h2>
            <div className="glass rounded-[20px] p-[18px]">
              {meeting && (meeting.results || meeting.next_actions) ? (
                <>
                  {meeting.results && (
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                        {t('reflection')}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[1.7] font-semibold whitespace-pre-line text-txt">
                        {meeting.results}
                      </p>
                    </div>
                  )}
                  {meeting.next_actions && (
                    <div className="mt-3.5 border-t border-navy/[0.08] pt-3">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-navy">
                        <Trophy size={11} strokeWidth={2.5} style={{color: 'var(--color-gold-mid)'}} />
                        {t('nextWeek')}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[1.7] font-semibold whitespace-pre-line text-txt">
                        {meeting.next_actions}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs italic text-grey-mid">{t('noMeeting')}</p>
              )}
            </div>
          </section>
        )}

        {/* Tiến độ WIG NĂM cá nhân (4 lĩnh vực) — cumulative */}
        <section>
          <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('wigProgress')}</h2>
          <div className="grid grid-cols-2 gap-3">
            {AREAS.map((a) => {
              const w = yearByArea.get(a);
              return (
                <div key={a} className="glass glass-hover rounded-[18px] p-3 text-center">
                  <div className="text-xs font-extrabold whitespace-nowrap text-navy">
                    {tArea(`areas.${a}`)}
                  </div>
                  {w ? (
                    <div className="mt-2.5">
                      <DonutRing pct={Number(w.pct ?? 0)} status={w.status ?? ''} size={62} />
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-grey-mid">{tArea('noWig')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Thực đơn hôm nay + ảnh lớp.
          Hai thứ này phụ huynh xin, nhưng là thứ LIẾC MỘT CÁI chứ không phải đọc kỹ mỗi ngày —
          nên nằm ở đây thay vì chiếm một tab trên thanh menu vốn đã chật (docs/NAV_IA.md).
          Thẻ thực đơn tự suy ra cơ sở của người xem, không cần truyền gì. */}
      <TodayMenuCard />

      <Link
        href="/gallery"
        className="glass glass-hover flex items-center gap-3 rounded-[20px] p-[18px] transition-all"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/20 text-gold-deep">
          <Images size={18} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold text-navy">
            Hình ảnh lớp
          </span>
          <span className="block text-[12.5px] font-semibold text-grey-mid">
            Ảnh học tập và sự kiện do giáo viên chủ nhiệm đăng
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 text-grey-mid" />
      </Link>
    </div>
  );
}
