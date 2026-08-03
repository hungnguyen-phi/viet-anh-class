import {getTranslations, getLocale} from 'next-intl/server';
import {Check, X} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {AREAS, buildAreaMeta, areaLabel} from '@/lib/areas';

// Panel "cầm scoreboard mà họp" (PRD Màn 5/6): WIG tuần thắng/thua ×4 + lead hoàn thành/tổng,
// cho tuần đang họp. Dùng cho họp LỚP (classId) hoặc CÁ NHÂN (studentId).
export async function MeetingScoreboard({
  classId,
  studentId,
  weekLabel,
  weekStart,
  weekEnd,
}: {
  classId: string;
  studentId?: string;
  weekLabel: string;
  // Hai đầu mốc của tuần đang họp. Có thì lọc theo NGÀY; không có thì đành theo nhãn (xem dưới).
  weekStart?: string;
  weekEnd?: string;
}) {
  const t = await getTranslations('meeting');
  const locale = await getLocale();
  const supabase = await createClient();
  const scope = studentId ? 'student' : 'class';

  // LỌC THEO NGÀY, không theo period_label.
  //
  // period_label là ô CHỮ TỰ DO trên panel sửa WIG (/wig), nằm tách rời hai ô ngày. Mọi thứ khác
  // quanh panel này — danh sách WIG của /wig, class_lead_board, class_tick_matrix, màn hình học
  // sinh — đều khớp theo start_date/end_date. Hai luật trên cùng một màn hình chính là thứ đã gây
  // sự cố 7B1, và ở đây nó có lối vào rất tự nhiên: huy hiệu "Lệch tuần" mới bảo GVCN rằng ngày
  // đang sai, họ vào sửa hai ô ngày, ô nhãn bên cạnh không ai đụng — thế là panel này mù, báo
  // "chưa có số liệu tuần này" trong khi bảng tick ngay dưới đang hiện 18/30.
  //
  // 0073 cũng chọn ngày với đúng lý do ấy: "nhãn kỳ là chữ người gõ, có thể bỏ trống hoặc gõ khác
  // quy ước, còn start_date/end_date thì luôn có".
  let q = supabase
    .from('wig_progress_v')
    .select('wig_id, area, pct')
    .eq('scope', scope)
    .eq('period', 'week');
  q =
    weekStart && weekEnd
      ? q.lte('start_date', weekEnd).gte('end_date', weekStart)
      : q.eq('period_label', weekLabel);
  q = studentId ? q.eq('student_id', studentId) : q.eq('class_id', classId);

  const [{data: wrows}, {data: areaCfg}] = await Promise.all([
    q,
    supabase.from('area_config').select('*').order('sort_order'),
  ]);
  const areaMeta = buildAreaMeta(areaCfg);
  const rows = (wrows ?? []) as {wig_id: string; area: string; pct: number | null}[];
  const wonByArea = new Map(rows.map((r) => [r.area, Number(r.pct ?? 0) >= 1]));

  const wigIds = rows.map((r) => r.wig_id);
  let leadsDone = 0;
  let leadsTotal = 0;
  if (wigIds.length > 0) {
    // Tick cũng phải nằm trong tuần đang họp. Không ràng thì một việc đã đạt ở tuần trước vẫn
    // được đếm "hoàn thành" cho tuần này — buổi họp đọc ra một con số không thuộc về tuần mình
    // đang bàn, mà đó đúng là con số PRD bảo cầm để họp.
    let lq = supabase.from('lead_measures').select('target_value, lead_progress(value)').in('wig_id', wigIds);
    if (weekStart && weekEnd) {
      lq = lq
        .gte('lead_progress.logged_date', weekStart)
        .lte('lead_progress.logged_date', weekEnd);
    }
    const {data: leadData} = await lq;
    for (const l of (leadData ?? []) as {target_value: number; lead_progress: {value: number}[] | null}[]) {
      leadsTotal += 1;
      const actual = (l.lead_progress ?? []).reduce((s, p) => s + Number(p.value ?? 0), 0);
      if (Number(l.target_value) > 0 && actual >= Number(l.target_value)) leadsDone += 1;
    }
  }

  const hasData = rows.length > 0 || leadsTotal > 0;

  return (
    <div className="glass rounded-[20px] p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="font-display text-[14px] font-bold text-navy">{t('scoreThisWeek')}</span>
        <span className="rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-grey-mid">
          {weekLabel}
        </span>
        {leadsTotal > 0 && (
          <span className="ml-auto rounded-full bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
            {t('leadDone')}: {leadsDone}/{leadsTotal}
          </span>
        )}
      </div>
      {!hasData ? (
        <p className="text-[12px] italic text-grey-mid">{t('noWeekData')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AREAS.map((a) => {
            const am = areaMeta[a];
            const has = wonByArea.has(a);
            const won = wonByArea.get(a) ?? false;
            return (
              <div
                key={a}
                className="flex items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 px-2.5 py-2"
              >
                <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{background: am.hex}} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-navy">
                  {areaLabel(am, locale)}
                </span>
                {has ? (
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                    style={{
                      background: won ? 'var(--color-success)' : 'rgba(192,57,43,0.12)',
                      color: won ? '#fff' : 'var(--color-status-bad)',
                    }}
                  >
                    {won ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-grey-soft">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
