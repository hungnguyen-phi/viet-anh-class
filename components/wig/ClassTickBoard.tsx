import {getTranslations} from 'next-intl/server';
import {AlertTriangle, Check} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {Link} from '@/i18n/navigation';
import {todayInVN, weekDaysVN, isoDowVN} from '@/lib/dates';

// Bảng "em nào tick được gì, đến đâu" — thứ GVCN thiếu hẳn trước 0073.
//
// Trước bản này muốn biết một em đã làm gì thì phải mở trang /student/<id> của chính em đó; lớp
// 30 em là 30 lần vào-ra, và không có màn hình nào trả lời được câu hỏi thật của buổi họp WIG:
// "tuần này ai chưa làm?". Trang /wig chỉ hiện readyCount/studentCount — số em ĐÃ CÓ WIG, không
// phải số em đã tick.
//
// Hai lượt RPC (0073), không N+1: class_lead_board cho tổng theo từng việc, class_tick_matrix cho
// đủ cặp (học sinh × việc) kể cả ô trống — chính ô trống mới là thứ cần nhìn.

type BoardRow = {
  lead_measure_id: string;
  title: string;
  target_value: number | string;
  unit: string | null;
  active_weekdays: number[] | null;
  class_total: number | string;
  contributors: number | string;
};

type MatrixRow = {
  student_id: string;
  student_name: string;
  lead_measure_id: string;
  lead_title: string;
  active_weekdays: number[] | null;
  ticked_dates: string[] | null;
};

export async function ClassTickBoard({classId}: {classId: string}) {
  // Namespace `wig` (không tạo namespace riêng): khối này chỉ hiện ở trang /wig và là server
  // component, nên không phải cân nhắc gói bản dịch gửi xuống trình duyệt.
  const t = await getTranslations('wig');
  const supabase = await createClient();
  const today = todayInVN();
  const weekDays = weekDaysVN(today);
  const monday = weekDays[0];

  const [{data: boardData}, {data: matrixData}] = await Promise.all([
    supabase.rpc('class_lead_board', {p_class: classId, p_week_start: monday}),
    supabase.rpc('class_tick_matrix', {p_class: classId, p_week_start: monday}),
  ]);

  const board = (boardData ?? []) as BoardRow[];
  const matrix = (matrixData ?? []) as MatrixRow[];

  if (board.length === 0) {
    return (
      <section className="glass rounded-[20px] p-[18px]">
        <div className="font-display text-[15px] font-bold text-navy">{t('tickBoardTitle')}</div>
        <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-grey-mid">{t('tickBoardEmpty')}</p>
      </section>
    );
  }

  // Gom ma trận theo học sinh, giữ nguyên thứ tự tên do SQL trả về.
  const byStudent = new Map<string, {name: string; cells: Map<string, MatrixRow>}>();
  for (const r of matrix) {
    let s = byStudent.get(r.student_id);
    if (!s) {
      s = {name: r.student_name, cells: new Map()};
      byStudent.set(r.student_id, s);
    }
    s.cells.set(r.lead_measure_id, r);
  }
  const students = [...byStudent.entries()];
  const silent = students.filter(([, s]) =>
    [...s.cells.values()].every((c) => (c.ticked_dates ?? []).length === 0),
  ).length;

  const dayShort = t.raw('dayShort') as string[];
  // Nhãn thứ của những ngày mà việc này áp dụng — dùng cho cả tiêu đề cột lẫn tooltip từng ô.
  const activeDaysOf = (w: number[] | null) => {
    const on = new Set(w ?? [1, 2, 3, 4, 5, 6, 7]);
    return weekDays.filter((d) => on.has(isoDowVN(d)));
  };

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-display text-[15px] font-bold text-navy">{t('tickBoardTitle')}</span>
        <span className="rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-grey-mid">
          {monday} → {weekDays[6]}
        </span>
        {silent > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-status-bad/[0.10] px-2.5 py-1 text-[11px] font-extrabold text-status-bad">
            <AlertTriangle size={12} strokeWidth={2.5} />
            {t('tickBoardSilent', {n: silent})}
          </span>
        )}
      </div>
      <p className="mb-3 max-w-[640px] text-[11.5px] font-semibold leading-relaxed text-grey-mid">
        {t('tickBoardHint')}
      </p>

      {/* Tổng theo TỪNG VIỆC — con số quyết định thắng/thua của WIG tuần */}
      <div className="mb-3 flex flex-col gap-2">
        {board.map((l) => {
          const total = Number(l.class_total);
          const target = Number(l.target_value);
          const pct = target > 0 ? Math.min(1, total / target) : 0;
          const done = target > 0 && total >= target;
          return (
            <div key={l.lead_measure_id} className="rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-extrabold text-navy">{l.title}</span>
                <span className="rounded-full bg-navy/[0.05] px-2 py-0.5 text-[10.5px] font-bold text-grey-mid">
                  {activeDaysOf(l.active_weekdays)
                    .map((d) => dayShort[isoDowVN(d) - 1])
                    .join(' · ')}
                </span>
                {done && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success">
                    <Check size={11} strokeWidth={3} />
                    {t('tickBoardReached')}
                  </span>
                )}
                <span className="ml-auto text-[12px] font-extrabold tabular-nums text-navy">
                  {total}/{target} {l.unit ?? ''}
                </span>
              </div>
              <div className="mt-1.5 h-[7px] w-full overflow-hidden rounded-[4px] bg-navy/[0.08]">
                <div
                  className="h-full rounded-[4px] transition-[width] duration-500"
                  style={{
                    width: `${Math.round(pct * 100)}%`,
                    background: done ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
                  }}
                />
              </div>
              <div className="mt-1 text-[11px] font-semibold text-grey-mid">
                {t('tickBoardContributors', {n: Number(l.contributors), total: students.length})}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ma trận học sinh × việc. Cuộn ngang trong khung riêng — trang không được cuộn ngang. */}
      <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="bg-navy/[0.03]">
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('tickBoardStudent')}
              </th>
              {board.map((l) => (
                <th
                  key={l.lead_measure_id}
                  className="px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid"
                >
                  <span className="block max-w-[150px] truncate">{l.title}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map(([sid, s]) => {
              const none = [...s.cells.values()].every((c) => (c.ticked_dates ?? []).length === 0);
              return (
                <tr key={sid} className="border-t border-navy/[0.07]">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <Link
                      href={`/student/${sid}`}
                      className="text-[12.5px] font-bold text-navy hover:underline"
                    >
                      {s.name}
                    </Link>
                    {none && (
                      <span className="ml-1.5 rounded-full bg-status-bad/[0.10] px-1.5 py-0.5 text-[9.5px] font-extrabold text-status-bad">
                        {t('tickBoardNone')}
                      </span>
                    )}
                  </td>
                  {board.map((l) => {
                    const cell = s.cells.get(l.lead_measure_id);
                    const days = activeDaysOf(cell?.active_weekdays ?? l.active_weekdays);
                    const ticked = new Set(cell?.ticked_dates ?? []);
                    return (
                      <td key={l.lead_measure_id} className="px-3 py-2">
                        <div className="flex items-center gap-[3px]">
                          {days.map((d) => {
                            const on = ticked.has(d);
                            const future = d > today;
                            return (
                              <span
                                key={d}
                                title={`${dayShort[isoDowVN(d) - 1]} ${d.slice(5)}${on ? ' ✓' : ''}`}
                                className={`h-[13px] w-[13px] rounded-[4px] border ${
                                  on
                                    ? 'border-transparent bg-gold'
                                    : future
                                      ? 'border-dashed border-navy/15 bg-transparent'
                                      : 'border-navy/15 bg-navy/[0.05]'
                                }`}
                              />
                            );
                          })}
                          <span className="ml-1 text-[11px] font-bold tabular-nums text-grey-mid">
                            {ticked.size}/{days.length}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
