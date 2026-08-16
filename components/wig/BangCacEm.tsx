import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {duyetMucTieu} from '@/app/[locale]/(dashboard)/student/actions';
import {duyetCamKet} from '@/app/[locale]/(dashboard)/wig/actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// CÁC EM TUẦN NÀY — cùng một cây với màn của em, nhìn từ phía cô.
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án 16/08/2026: "bên giáo viên thì wig 1 đàng, bên học sinh thì wig 1 nẻo?". Đúng: trang
// WIG của cô chỉ có cây của LỚP (mục tiêu năm lớp → cam kết lớp → việc cô tick), còn cây của TỪNG
// EM (mục tiêu năm em → cam kết em → việc em tick) chỉ hiện trên màn của em — cô muốn duyệt phải
// vào từng trang một, mà ở đó lại có nút "đặt hộ / sửa / xoá" không thuộc về cô.
//
// Nay: mỗi em một dòng, đúng ba cột của cây — mục tiêu năm · cam kết tuần này · việc đạt — và
// CÔ CHỈ CÓ MỘT ĐỘNG TÁC: DUYỆT. Không đặt hộ, không sửa, không xoá (0129/0133: lời hứa là của em).
export async function BangCacEm({
  classId,
  monday,
  weekQ,
  classParam,
}: {
  classId: string;
  monday: string;
  weekQ: string;
  classParam?: string;
}) {
  const t = await getTranslations('wig');
  const tg = await getTranslations('goal');
  const supabase = await createClient();
  const [{data: emRows}, {data: mtRows}, {data: ckRows}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(full_name, email)')
      .eq('class_id', classId)
      .eq('is_active', true),
    supabase
      .from('wigs')
      .select('id, student_id, kind, title, status, target_value, unit')
      .eq('class_id', classId)
      .eq('scope', 'student')
      .eq('period', 'year'),
    supabase
      .from('commitments')
      .select('id, student_id, title, status, verdict, lead_measures(id, title, target_value, lead_progress(student_id, value))')
      .eq('class_id', classId)
      .eq('week_start', monday)
      .not('student_id', 'is', null)
      .order('created_at'),
  ]);

  type MT = {id: string; student_id: string | null; kind: string | null; title: string; status: string; target_value: number; unit: string};
  type CK = {
    id: string;
    student_id: string | null;
    title: string;
    status: string;
    verdict: string | null;
    lead_measures: {id: string; title: string; target_value: number | string; lead_progress: {student_id: string | null; value: number | string | null}[] | null}[] | null;
  };
  const mtTheoEm = new Map<string, MT[]>();
  for (const m of (mtRows ?? []) as MT[]) if (m.student_id) mtTheoEm.set(m.student_id, [...(mtTheoEm.get(m.student_id) ?? []), m]);
  const ckTheoEm = new Map<string, CK[]>();
  for (const c of (ckRows ?? []) as unknown as CK[]) if (c.student_id) ckTheoEm.set(c.student_id, [...(ckTheoEm.get(c.student_id) ?? []), c]);

  const em = ((emRows ?? []) as unknown as {student_id: string; profiles: {full_name: string | null; email: string | null} | null}[])
    .map((e) => ({id: e.student_id, ten: tenHienThi(e.profiles?.full_name, e.profiles?.email)}))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

  const nutDuyet = 'inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30';
  const th = 'px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid';

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-3 font-display text-[15px] font-bold text-navy">{t('studentsThisWeek')}</h2>
      {em.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-grey-mid">{t('studentListEmpty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-navy/[0.03]">
                <th className={th}>{t('colStudent')}</th>
                <th className={th}>{t('colYearGoal')}</th>
                <th className={th}>{t('colCommitment')}</th>
                <th className={`${th} text-right`}>{t('colWorks')}</th>
              </tr>
            </thead>
            <tbody>
              {em.map((e) => {
                const mts = mtTheoEm.get(e.id) ?? [];
                const cks = ckTheoEm.get(e.id) ?? [];
                const viec = cks.flatMap((c) => c.lead_measures ?? []);
                const viecDat = viec.filter((l) => {
                  const dat = (l.lead_progress ?? []).filter((p) => p.student_id === e.id).reduce((s, p) => s + Number(p.value ?? 1), 0);
                  return Number(l.target_value) > 0 && dat >= Number(l.target_value);
                }).length;
                return (
                  <tr key={e.id} className="border-t border-navy/[0.07] align-top">
                    <td className="px-3 py-2.5">
                      <Link href={`/student/${e.id}`} className="text-[13px] font-bold text-navy hover:underline">
                        {e.ten}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {mts.length === 0 ? (
                        <span className="text-[12px] italic text-grey-mid">—</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {mts.map((m) => (
                            <li key={m.id} className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-navy">
                              <span className="min-w-0">{m.title}</span>
                              <span className="text-grey-mid">· {m.target_value} {m.unit}</span>
                              {m.status === 'sent' && (
                                <form action={duyetMucTieu} className="contents">
                                  <input type="hidden" name="wig_id" value={m.id} />
                                  <input type="hidden" name="student_id" value={e.id} />
                                  <button type="submit" className={nutDuyet}>
                                    <Check size={11} strokeWidth={3} />
                                    {tg('approveShort')}
                                  </button>
                                </form>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {cks.length === 0 ? (
                        <span className="text-[12px] italic text-grey-mid">—</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {cks.map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-navy">
                              <span className="min-w-0">{c.title}</span>
                              {c.status === 'sent' ? (
                                <form action={duyetCamKet} className="contents">
                                  {classParam && <input type="hidden" name="class_id" value={classParam} />}
                                  <input type="hidden" name="week" value={weekQ} />
                                  <input type="hidden" name="commitment_id" value={c.id} />
                                  <button type="submit" className={nutDuyet}>
                                    <Check size={11} strokeWidth={3} />
                                    {tg('approveShort')}
                                  </button>
                                </form>
                              ) : c.verdict ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${c.verdict === 'win' ? 'bg-success/15 text-success-dark' : 'bg-status-bad/[0.12] text-status-bad'}`}>
                                  {c.verdict === 'win' ? 'V' : 'X'}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[13px] font-extrabold tabular-nums text-navy">
                      {viec.length > 0 ? `${viecDat}/${viec.length}` : <span className="font-semibold text-grey-mid">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
