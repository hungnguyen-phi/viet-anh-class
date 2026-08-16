import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {Link} from '@/i18n/navigation';
import {todayInVN, weekDaysVN, isoDowVN} from '@/lib/dates';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {kieuDonVi} from '@/lib/don-vi';

// ════════════════════════════════════════════════════════════════════════════════════════════
// CHI TIẾT TUẦN — TỪNG EM: cam kết của em → việc của em → ô ngày em đã tick / đã điền số.
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Bản trước (tới 16/08/2026) vẽ ma trận "em nào tick việc CHUNG của lớp ngày nào". Từ khi việc
// chung là của cô (cô đặt, cô tick — 0132/0137), ma trận ấy chỉ còn toàn ô trống: nó hỏi các em một
// việc không còn là của các em. Chủ dự án: "phải hiện đúng cái của học sinh cơ".
//
// Nay: mỗi em một khối, trong đó mỗi việc một hàng — tên việc (kèm cam kết mẹ), bảy ô ngày (chỉ vẽ
// ngày áp dụng; ô vàng = đã tick, ô có số = đã điền lượng), và cột đã làm / đích. Cô CHỈ NHÌN.
type Row = {
  student_id: string | null;
  title: string;
  status: string;
  lead_measures:
    | {
        id: string;
        title: string;
        target_value: number | string;
        unit: string | null;
        active_weekdays: number[] | null;
        unit_per_tick: number | string | null;
        nhap_luong: boolean | null;
        lead_progress: {student_id: string | null; logged_date: string; value: number | string | null}[] | null;
      }[]
    | null;
};

export async function ChiTietTuan({classId, weekStart}: {classId: string; weekStart: string}) {
  const t = await getTranslations('wig');
  const supabase = await createClient();
  const today = todayInVN();
  const days = weekDaysVN(weekStart);
  const dayShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const [{data: emRows}, {data: ckRows}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(full_name, email)')
      .eq('class_id', classId)
      .eq('is_active', true),
    supabase
      .from('commitments')
      .select(
        'student_id, title, status, lead_measures(id, title, target_value, unit, active_weekdays, unit_per_tick, nhap_luong, lead_progress(student_id, logged_date, value))',
      )
      .eq('class_id', classId)
      .eq('week_start', days[0])
      .not('student_id', 'is', null)
      .order('created_at'),
  ]);

  const em = ((emRows ?? []) as unknown as {student_id: string; profiles: {full_name: string | null; email: string | null} | null}[])
    .map((e) => ({id: e.student_id, ten: tenHienThi(e.profiles?.full_name, e.profiles?.email)}))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  const ckTheoEm = new Map<string, Row[]>();
  for (const r of (ckRows ?? []) as unknown as Row[]) if (r.student_id) ckTheoEm.set(r.student_id, [...(ckTheoEm.get(r.student_id) ?? []), r]);

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-3 font-display text-[16px] font-bold text-navy">{t('detailPerStudent')}</h2>
      <div className="flex flex-col gap-3">
        {em.map((e) => {
          const cks = ckTheoEm.get(e.id) ?? [];
          const hang = cks.flatMap((c) =>
            (c.lead_measures ?? []).map((l) => {
              const apDung = new Set(l.active_weekdays ?? [1, 2, 3, 4, 5, 6, 7]);
              const cua = (l.lead_progress ?? []).filter((p) => p.student_id === e.id && p.logged_date >= days[0] && p.logged_date <= days[6]);
              const theoNgay = new Map(cua.map((p) => [p.logged_date, Number(p.value ?? 0)]));
              const upt = Number(l.unit_per_tick ?? 1) || 1;
              const kieu = kieuDonVi(l.unit ?? '');
              const daLam =
                cua.length === 0
                  ? 0
                  : kieu === 'do'
                    ? Number([...cua].sort((a, b) => (a.logged_date < b.logged_date ? 1 : -1))[0].value ?? 0)
                    : cua.reduce((s, p) => s + Number(p.value ?? 0), 0) * upt;
              const dich = Number(l.target_value) || 0;
              return {l, c, apDung, theoNgay, daLam, dich, xong: dich > 0 && daLam >= dich, nhapLuong: Boolean(l.nhap_luong)};
            }),
          );
          return (
            <div key={e.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/student/${e.id}`} className="inline-flex min-h-[24px] items-center text-[13.5px] font-extrabold text-navy hover:underline">
                  {e.ten}
                </Link>
                {cks.length === 0 && <span className="text-[12px] italic text-grey-mid">{t('noCommitmentYet')}</span>}
              </div>
              {hang.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">
                        <th className="pb-1 pr-2 font-extrabold">{t('colWorks')}</th>
                        {days.map((d, i) => (
                          <th key={d} className="pb-1 text-center font-extrabold">
                            {dayShort[i]}
                          </th>
                        ))}
                        <th className="pb-1 pl-2 text-right font-extrabold">{t('doneCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hang.map(({l, c, apDung, theoNgay, daLam, dich, xong, nhapLuong}) => (
                        <tr key={l.id} className="border-t border-navy/[0.07]">
                          <td className="py-1.5 pr-2">
                            <span className="block font-bold text-navy">{l.title}</span>
                            <span className="block text-[11px] font-semibold text-grey-mid">{c.title}</span>
                          </td>
                          {days.map((d) => {
                            const dow = isoDowVN(d);
                            if (!apDung.has(dow)) return <td key={d} />;
                            const gt = theoNgay.get(d);
                            const co = gt !== undefined;
                            const chuaToi = d > today;
                            return (
                              <td key={d} className="py-1.5 text-center">
                                <span
                                  className={`inline-flex h-7 min-w-7 items-center justify-center rounded-[7px] px-1 text-[11.5px] font-extrabold tabular-nums ${
                                    co
                                      ? 'bg-gold text-navy'
                                      : chuaToi
                                        ? 'border border-navy/10 text-transparent'
                                        : 'border border-dashed border-navy/25 text-transparent'
                                  }`}
                                  aria-label={co ? `${d}: ${nhapLuong ? gt : 'đã tick'}` : chuaToi ? `${d}: chưa tới` : `${d}: bỏ trống`}
                                >
                                  {co ? (nhapLuong ? gt : <Check size={13} strokeWidth={3.5} />) : '·'}
                                </span>
                              </td>
                            );
                          })}
                          <td className={`py-1.5 pl-2 text-right font-extrabold tabular-nums ${xong ? 'text-success-dark' : 'text-navy'}`}>
                            {daLam}/{dich}
                            {l.unit ? <span className="ml-1 font-semibold text-grey-mid">{l.unit}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {cks.length > 0 && hang.length === 0 && (
                <p className="mt-1 text-[12px] italic text-grey-mid">{t('commitNoWork', {title: cks.map((c) => c.title).join(' · ')})}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
