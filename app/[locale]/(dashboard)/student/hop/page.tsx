import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Link} from '@/i18n/navigation';
import {isoWeekLabel, mondayOf, shiftWeeks, todayInVN, vnNoon} from '@/lib/dates';
import {OBienBanCuaEm} from '@/components/wig/OBienBanCuaEm';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /student/hop — PHÒNG HỌP WIG, PHẦN CỦA EM
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Cùng một buổi họp với /wig/hop của GVCN, nhìn từ chỗ ngồi của em: lời hứa cả lớp đã hứa tuần
// trước, và HAI Ô CỦA CHÍNH EM. Không có bảng số của cả lớp, không có danh sách bạn nào tick
// mấy lần — buổi họp chiếu bảng ấy lên tường rồi, không cần chép lại vào máy từng em.
//
// TUẦN MẶC ĐỊNH LÀ TUẦN VỪA XONG, đúng như phòng họp của cô: 4DX họp về tuần đã khép lại. Đi
// tuần khác bằng hai mũi tên, y hệt bên kia, để hai màn hình luôn nói về cùng một tuần.
export default async function PhongHopCuaEmPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{hop?: string}>;
}) {
  const {locale} = await params;
  const {hop: hopParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['student']);
  const t = await getTranslations('meeting');
  const supabase = await createClient();

  const {data: ghiDanh} = await supabase
    .from('enrollments')
    .select('class_id, classes(name)')
    .eq('student_id', profile.id)
    .eq('is_active', true)
    .maybeSingle();
  const lop = ghiDanh as unknown as {class_id: string; classes: {name: string} | null} | null;

  if (!lop) {
    return (
      <div className="glass rounded-[20px] p-6 text-center text-[13px] font-semibold text-grey-mid">
        {t('noClassForStudent')}
      </div>
    );
  }

  const macDinh = shiftWeeks(mondayOf(todayInVN()), -1);
  const hopMonday = /^\d{4}-\d{2}-\d{2}$/.test(hopParam ?? '') ? mondayOf(hopParam!) : macDinh;
  const hopLabel = isoWeekLabel(vnNoon(hopMonday));
  const truocLabel = isoWeekLabel(vnNoon(shiftWeeks(hopMonday, -1)));

  // MỘT CÂU cho cả ba thứ cần: dòng của LỚP tuần này (mang dấu chốt), dòng của lớp tuần trước
  // (mang lời hứa), và dòng của chính em. RLS đã lo phần "chỉ thấy dòng của mình": học sinh đọc
  // được dòng lớp (student_id null) và dòng mang chính id mình, không thấy dòng của bạn khác.
  const {data: rows} = await supabase
    .from('wig_meetings')
    .select('student_id, week_label, results, commitments, chot_at')
    .eq('class_id', lop.class_id)
    .in('week_label', [hopLabel, truocLabel]);
  const all = (rows ?? []) as {
    student_id: string | null;
    week_label: string;
    results: string | null;
    commitments: string | null;
    chot_at: string | null;
  }[];
  const dongTuan = all.find((r) => r.student_id === null && r.week_label === hopLabel) ?? null;
  const loiHuaTruoc =
    all.find((r) => r.student_id === null && r.week_label === truocLabel)?.commitments ?? null;
  const cuaEm = all.find((r) => r.student_id === profile.id && r.week_label === hopLabel) ?? null;
  const daChot = Boolean(dongTuan?.chot_at);

  const dm = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  // CHỦ NHẬT của tuần đang họp — không phải thứ Hai tuần sau. shiftWeeks(+1) nhảy đúng 7
  // ngày nên dải hiện ra thành "10/08 → 17/08", tức là tám ngày.
  const chuNhat = new Date(`${hopMonday}T00:00:00Z`);
  chuNhat.setUTCDate(chuNhat.getUTCDate() + 6);
  const chuNhatISO = chuNhat.toISOString().slice(0, 10);
  const link = (m: string) => ({
    pathname: '/student/hop' as const,
    query: m === macDinh ? {} : {hop: m},
  });
  const nut =
    'inline-flex items-center gap-1 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-2 text-[12px] font-extrabold text-navy transition-all hover:border-navy';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/student" className={nut}>
          <ArrowLeft size={14} strokeWidth={2.5} />
          {t('backToBoard')}
        </Link>
        <h1 className="font-display text-[20px] font-bold text-navy">
          {t('roomTitle')} · {lop.classes?.name ?? ''}
        </h1>
      </div>

      <section className="glass flex flex-wrap items-center justify-center gap-2 rounded-[20px] p-3">
        <Link href={link(shiftWeeks(hopMonday, -1))} className={nut} aria-label={t('prevWeek')}>
          <ArrowLeft size={14} strokeWidth={2.5} />
        </Link>
        <span className="text-[13px] font-extrabold text-navy">{t('summarising', {week: hopLabel})}</span>
        <span className="text-[11.5px] font-bold tabular-nums text-grey-mid">
          {dm(hopMonday)} → {dm(chuNhatISO)}
        </span>
        <Link href={link(shiftWeeks(hopMonday, 1))} className={nut} aria-label={t('nextWeek')}>
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </section>

      {/* Lời hứa của cả lớp tuần trước — nhịp mở đầu của một buổi họp WIG, và là thứ duy nhất từ
          buổi họp mà em cần đọc trước khi viết phần của mình. */}
      <div className="flex flex-wrap items-start gap-2 rounded-[14px] border-[1.5px] border-gold-deep/25 bg-gold/[0.12] px-3.5 py-2.5">
        <ArrowRight size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-gold-deep" />
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-gold-text">
            {t('promisedLastWeek', {week: truocLabel})}
          </span>
          <p
            className={`mt-0.5 text-[12.5px] font-semibold leading-relaxed ${
              loiHuaTruoc ? 'text-navy' : 'italic text-grey-mid'
            }`}
          >
            {loiHuaTruoc ?? t('noPromiseLastWeek')}
          </p>
        </div>
      </div>

      <OBienBanCuaEm
        key={hopMonday}
        classId={lop.class_id}
        weekLabel={hopLabel}
        weekStart={hopMonday}
        ketQuaBanDau={cuaEm?.results ?? ''}
        camKetBanDau={cuaEm?.commitments ?? ''}
        khoa={daChot}
      />
    </div>
  );
}
