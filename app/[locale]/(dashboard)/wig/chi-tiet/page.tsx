import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {Link} from '@/i18n/navigation';
import {isValidDayVN, mondayOf, todayInVN, weekFromMonday} from '@/lib/dates';
import {WeekNav} from '@/components/wig/WeekNav';
import {ChiTietTuan} from '@/components/wig/ChiTietTuan';
import {TuongWig, type MucTieuTrenTuong} from '@/components/wig/TuongWig';
import {ChinhNhip} from '@/components/wig/ChinhNhip';
import {Flash} from '@/components/ui/Flash';

// /wig/chi-tiet — "em nào làm tới đâu, quên hôm nào".
//
// Tách khỏi /wig vì hai màn trả lời hai câu hỏi khác nhau và dùng vào hai lúc khác nhau: /wig là
// thứ mở ra hằng ngày để liếc, màn này là thứ mở ra khi cần gọi tên một em. Nhét chung thì trang
// hằng ngày dài thêm một bảng ba mươi dòng mà chín ngày trong mười không ai đọc.
export default async function ChiTietPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; week?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, week: weekParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('wig');
  const supabase = await createClient();
  const {myClass} = await getClassContext(supabase, profile, classParam);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  const thisMonday = mondayOf(todayInVN());
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam as string) : thisMonday;
  const wk = weekFromMonday(monday);
  const laTuanNay = monday === thisMonday;
  const weekQ = laTuanNay ? '' : monday;

  // Dữ liệu cho BỨC TƯỜNG WIG — trận đánh của lớp, mục tiêu của từng em, và sĩ số để nói được
  // "bao nhiêu em đã đặt". Ba câu chạy song song vì không câu nào cần kết quả của câu kia.
  const [{data: wigLop}, {data: mucTieuRows}, {count: siSo}, {data: thangRows}] = await Promise.all([
    supabase
      .from('wigs')
      .select('id, title, target_value, baseline, unit')
      .eq('class_id', myClass.id)
      .eq('scope', 'class')
      .eq('period', 'year'),
    supabase
      .from('wigs')
      .select(
        'id, student_id, kind, status, set_by, measure_by, title, baseline, target_value, unit, end_date, achieved_at, source_wig_id, profiles!wigs_student_id_fkey(full_name)',
      )
      .eq('class_id', myClass.id)
      .eq('scope', 'student')
      .eq('period', 'year'),
    supabase
      .from('enrollments')
      .select('student_id', {count: 'exact', head: true})
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    // Mốc THÁNG cho khối chỉnh nhịp. Hỏi cả lớp một lần rồi gom theo cha ở JS — rẻ hơn nhiều so
    // với bốn câu, mỗi câu một mục tiêu năm.
    supabase
      .from('wigs')
      .select('id, parent_wig_id, period_label, target_value')
      .eq('class_id', myClass.id)
      .eq('scope', 'class')
      .eq('period', 'month')
      .order('period_label'),
  ]);

  const thangTheoNam = new Map<string, {id: string; period_label: string | null; target_value: number}[]>();
  for (const m of (thangRows ?? []) as {
    id: string;
    parent_wig_id: string | null;
    period_label: string | null;
    target_value: number;
  }[]) {
    if (!m.parent_wig_id) continue;
    thangTheoNam.set(m.parent_wig_id, [...(thangTheoNam.get(m.parent_wig_id) ?? []), m]);
  }

  const mucTieu: MucTieuTrenTuong[] = (
    (mucTieuRows ?? []) as unknown as (Omit<MucTieuTrenTuong, 'ten'> & {
      profiles: {full_name: string | null} | null;
    })[]
  )
    .map((m) => ({...m, ten: m.profiles?.full_name ?? '—'}))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={{
            pathname: '/wig',
            query: {...(classParam ? {class: classParam} : {}), ...(weekQ ? {week: weekQ} : {})},
          }}
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-2 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          {t('backToWig')}
        </Link>
        <h1 className="font-display text-[20px] font-bold text-navy">
          {t('detailTitle')} · {myClass.name}
        </h1>
      </div>

      <Flash />

      <WeekNav
        monday={monday}
        thisMonday={thisMonday}
        label={wk.label}
        start={wk.start}
        end={wk.end}
        classParam={classParam}
        basePath="/wig/chi-tiet"
      />

      <ChiTietTuan classId={myClass.id} weekStart={monday} />

      {/* Khối "tạo WIG cá nhân cho cả lớp" từng đứng ở đây: nó chia mục tiêu của lớp cho sĩ số
          rồi ghi con số ấy xuống bản ghi của từng em. Bỏ ở 0100 — thay bằng bức tường dưới đây,
          nơi mục tiêu của em là khoảng cách của chính em và cô duyệt ngay tại chỗ. */}
      <TuongWig wigLop={wigLop ?? []} mucTieu={mucTieu} siSo={siSo ?? 0} />

      {/* Chỉnh nhịp — app rải đều 12 tháng khi cô khai mục tiêu năm; đây là chỗ kéo lại cho khớp
          năm học thật (hạ tháng Tết, hạ tháng thi). Đóng sẵn: mỗi năm mở một hai lần. */}
      {(wigLop ?? []).map((w) => {
        const ds = (thangTheoNam.get(w.id) ?? []).map((m) => ({
          id: m.id,
          label: m.period_label ?? '',
          target: Number(m.target_value),
        }));
        if (ds.length === 0) return null;
        return (
          <ChinhNhip
            key={w.id}
            namId={w.id}
            tieuDe={w.title ?? ''}
            can={Number(w.target_value) - Number(w.baseline ?? 0)}
            unit={w.unit}
            thang={ds}
          />
        );
      })}
    </div>
  );
}
