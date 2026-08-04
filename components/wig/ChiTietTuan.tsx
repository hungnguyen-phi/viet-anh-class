import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {Link} from '@/i18n/navigation';
import {todayInVN, weekDaysVN, isoDowVN} from '@/lib/dates';

// ════════════════════════════════════════════════════════════════════════════
// CHI TIẾT TUẦN — em nào làm tới đâu, quên hôm nào.
// ════════════════════════════════════════════════════════════════════════════
//
// Thay cho bảng ma trận cũ nhét giữa trang /wig. Bảng ấy đặt học sinh làm hàng và VIỆC làm cột,
// nên mỗi ô chỉ còn chỗ cho một dãy chấm bé xíu chung cho cả việc — nhìn ra được "em này làm ít"
// nhưng không ra được "em này quên thứ Ba". Mà "quên hôm nào" mới là thứ giáo viên nhắc được.
//
// Nay mỗi VIỆC một bảng riêng, cột là NGÀY, nên đọc theo hàng là biết em ấy bỏ đúng hôm nào.
//
// BA TRẠNG THÁI Ô, phải phân biệt được:
//   vàng ✓     đã tick
//   nét đứt    ngày áp dụng đã qua mà bỏ trống  → đây mới là "quên"
//   chấm mờ    ngày chưa tới                    → KHÔNG PHẢI LỖI CỦA AI
//
// Vế thứ ba quan trọng hơn vẻ ngoài của nó: nếu vẽ ngày chưa tới giống ngày bỏ trống thì sáng
// thứ Hai nào mở ra cũng thấy cả lớp đỏ lòm, và vài lần như thế là người ta thôi đọc màu. Vì vậy
// MẪU SỐ cũng chỉ đếm những ngày ĐÃ QUA — "2/3" giữa tuần, không phải "2/5".

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
  active_weekdays: number[] | null;
  ticked_dates: string[] | null;
};

export async function ChiTietTuan({classId, weekStart}: {classId: string; weekStart: string}) {
  const t = await getTranslations('wig');
  const supabase = await createClient();
  const today = todayInVN();
  // weekDaysVN tự lùi về Thứ Hai, và phải giữ đúng vậy: hai RPC dưới KHÔNG tự ép p_week_start về
  // đầu tuần — chúng lấy nguyên cửa sổ [ngày truyền vào, +6].
  const weekDays = weekDaysVN(weekStart);
  const monday = weekDays[0];

  const [{data: boardData}, {data: matrixData}] = await Promise.all([
    supabase.rpc('class_lead_board', {p_class: classId, p_week_start: monday}),
    supabase.rpc('class_tick_matrix', {p_class: classId, p_week_start: monday}),
  ]);

  const board = (boardData ?? []) as BoardRow[];
  const matrix = (matrixData ?? []) as MatrixRow[];
  const dayShort = t.raw('dayShort') as string[];

  if (board.length === 0) {
    return (
      <div className="glass rounded-[20px] p-6 text-center">
        <p className="text-[13px] font-bold text-navy">{t('detailEmpty')}</p>
        <p className="mx-auto mt-1 max-w-[440px] text-[11.5px] font-semibold leading-relaxed text-grey-mid">
          {t('detailEmptyHow')}
        </p>
      </div>
    );
  }

  // Ngày trong tuần mà một việc áp dụng — đúng luật RLS dùng để chặn tick (lead_day_ok, 0073).
  const ngayApDung = (w: number[] | null) => {
    const on = new Set(w ?? [1, 2, 3, 4, 5, 6, 7]);
    return weekDays.filter((d) => on.has(isoDowVN(d)));
  };

  // Gom theo học sinh để dựng bảng của từng việc, giữ nguyên thứ tự tên do SQL trả về.
  const theoEm = new Map<string, {ten: string; o: Map<string, MatrixRow>}>();
  for (const r of matrix) {
    let s = theoEm.get(r.student_id);
    if (!s) {
      s = {ten: r.student_name, o: new Map()};
      theoEm.set(r.student_id, s);
    }
    s.o.set(r.lead_measure_id, r);
  }
  const dsEm = [...theoEm.entries()];

  // ── TỔNG CẢ TUẦN CỦA TỪNG EM ──────────────────────────────────────────────────────────────
  // Mẫu số chỉ tính ngày ĐÃ QUA, cộng qua tất cả các việc.
  const tong = dsEm
    .map(([id, s]) => {
      let lam = 0;
      let can = 0;
      for (const l of board) {
        const o = s.o.get(l.lead_measure_id);
        const ngay = ngayApDung(o?.active_weekdays ?? l.active_weekdays).filter((d) => d <= today);
        const ticked = new Set(o?.ticked_dates ?? []);
        can += ngay.length;
        lam += ngay.filter((d) => ticked.has(d)).length;
      }
      return {id, ten: s.ten, lam, can, ti: can > 0 ? lam / can : 0};
    })
    // Em làm ít nhất đứng đầu: câu hỏi của người mở màn này là "ai chưa làm", nên đừng bắt họ dò
    // trong ba mươi cái tên. Bằng nhau thì theo tên.
    .sort((a, b) => a.ti - b.ti || a.ten.localeCompare(b.ten, 'vi'));

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[11.5px] font-semibold leading-relaxed text-grey-mid">{t('detailLegend')}</p>

      {board.map((l) => {
        const ngay = ngayApDung(l.active_weekdays);
        const daQua = ngay.filter((d) => d <= today);
        return (
          <section key={l.lead_measure_id} className="glass rounded-[20px] p-[18px]">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[14.5px] font-bold text-navy">{l.title}</h2>
              <span className="rounded-full bg-navy/[0.05] px-2 py-0.5 text-[10.5px] font-bold text-grey-mid">
                {ngay.map((d) => dayShort[isoDowVN(d) - 1]).join(' · ')}
              </span>
              <span className="ml-auto text-[13px] font-extrabold tabular-nums text-navy">
                {Number(l.class_total)}/{Number(l.target_value)} {l.unit ?? ''}
              </span>
            </div>

            {/* Cuộn ngang trong khung riêng — trang không được cuộn ngang (luật của dự án). */}
            <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
              <table className="w-full min-w-[440px] border-collapse">
                <thead>
                  <tr className="bg-navy/[0.03]">
                    <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">
                      {t('tickBoardStudent')}
                    </th>
                    <th className="px-3 py-2 text-left">
                      <span className="flex items-center gap-[5px]">
                        {ngay.map((d) => (
                          <span
                            key={d}
                            className="w-[22px] text-center text-[9.5px] font-extrabold uppercase text-grey-soft"
                          >
                            {dayShort[isoDowVN(d) - 1]}
                          </span>
                        ))}
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">
                      {t('detailDone')}
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {dsEm.map(([sid, s]) => {
                    const o = s.o.get(l.lead_measure_id);
                    const ticked = new Set(o?.ticked_dates ?? []);
                    const lam = daQua.filter((d) => ticked.has(d)).length;
                    // Những hôm ĐÃ QUA mà bỏ trống — nói tên thứ ra, đó là thứ nhắc được.
                    const quen = daQua.filter((d) => !ticked.has(d) && d < today);
                    const homNay = ngay.includes(today) && !ticked.has(today);
                    return (
                      <tr key={sid} className="border-t border-navy/[0.07]">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2">
                          <Link
                            href={`/student/${sid}`}
                            className="inline-flex min-h-[24px] items-center text-[12.5px] font-bold text-navy hover:underline"
                          >
                            {s.ten}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-[5px]">
                            {ngay.map((d) => {
                              const on = ticked.has(d);
                              const chuaToi = d > today;
                              return (
                                <span
                                  key={d}
                                  title={`${dayShort[isoDowVN(d) - 1]} ${d.slice(8, 10)}/${d.slice(5, 7)}${on ? ' ✓' : ''}`}
                                  className={`grid h-[22px] w-[22px] place-items-center rounded-[6px] border-[1.5px] ${
                                    on
                                      ? 'border-transparent bg-gold text-navy'
                                      : chuaToi
                                        ? 'border-dotted border-navy/20 bg-transparent opacity-50'
                                        : 'border-dashed border-navy/25 bg-navy/[0.03]'
                                  }`}
                                >
                                  {on && <Check size={12} strokeWidth={3} />}
                                </span>
                              );
                            })}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-[12.5px] font-extrabold tabular-nums text-navy">
                          {lam}/{daQua.length}
                        </td>
                        <td className="px-3 py-2">
                          {daQua.length === 0 ? null : lam === 0 ? (
                            <span className="whitespace-nowrap rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                              {t('detailNever')}
                            </span>
                          ) : quen.length > 0 ? (
                            <span className="whitespace-nowrap rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                              {t('detailForgot', {
                                days: quen.map((d) => dayShort[isoDowVN(d) - 1]).join(', '),
                              })}
                            </span>
                          ) : homNay ? (
                            <span className="whitespace-nowrap rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                              {t('detailNotToday')}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                              {t('detailOnTrack')}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="glass rounded-[20px] p-[18px]">
        <h2 className="mb-2.5 font-display text-[15px] font-bold text-navy">{t('detailSoFar')}</h2>
        <div className="flex flex-col">
          {tong.map((e) => {
            const pct = Math.round(e.ti * 100);
            return (
              <div key={e.id} className="flex items-center gap-3 border-t border-navy/[0.07] py-2 first:border-t-0">
                <Link
                  href={`/student/${e.id}`}
                  className="block min-w-0 flex-1 truncate py-1 text-[12.5px] font-bold text-navy hover:underline"
                >
                  {e.ten}
                </Link>
                <span className="h-[8px] w-[56px] shrink-0 overflow-hidden rounded-[5px] bg-navy/[0.08] sm:w-[120px]">
                  <span
                    className="block h-full rounded-[5px]"
                    style={{
                      width: `${pct}%`,
                      background:
                        e.lam === 0
                          ? 'var(--color-status-bad)'
                          : e.ti >= 0.8
                            ? 'var(--color-success)'
                            : 'var(--color-gold-mid)',
                    }}
                  />
                </span>
                <span className="w-[58px] shrink-0 text-right text-[12.5px] font-extrabold tabular-nums text-navy">
                  {e.lam}/{e.can}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] font-semibold leading-relaxed text-grey-mid">
          {t('detailDenominator')}
        </p>
      </section>
    </div>
  );
}
