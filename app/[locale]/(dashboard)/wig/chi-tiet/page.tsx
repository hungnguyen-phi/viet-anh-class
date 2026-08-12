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
import {TuongWig} from '@/components/wig/TuongWig';
import type {EmTrongLop} from '@/components/wig/DanhSachDatHo';
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
  const [{data: wigLop}, {data: mucTieuRows}, {data: emRows}, {data: thangRows}] = await Promise.all([
    supabase
      .from('wigs')
      .select('id, title, area, target_value, baseline, unit')
      .eq('class_id', myClass.id)
      .eq('scope', 'class')
      .eq('period', 'year'),
    supabase
      .from('wigs')
      .select(
        'id, student_id, kind, status, set_by, measure_by, title, baseline, target_value, unit, end_date, created_at, achieved_at, source_wig_id, lead_measures(title, target_value, active_weekdays)',
      )
      .eq('class_id', myClass.id)
      .eq('scope', 'student')
      .eq('period', 'year'),
    // CẢ LỚP, không chỉ những em đã đặt. Câu hỏi thật của cô là "còn ai chưa" — xem ghi chú đầu
    // components/wig/DanhSachDatHo.tsx.
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(full_name)')
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

  // Mục tiêu HỌC TẬP của từng em, gom theo student_id. `lead_measures` là mảng vì PostgREST trả
  // quan hệ 1-nhiều; trigger chan_viec_thu_hai (0100) đảm bảo tối đa một phần tử.
  type HangMucTieu = {
    id: string;
    student_id: string | null;
    kind: string | null;
    status: string;
    set_by: string | null;
    title: string;
    baseline: number | null;
    target_value: number;
    unit: string;
    end_date: string;
    created_at: string;
    achieved_at: string | null;
    source_wig_id: string | null;
    lead_measures: {title: string; target_value: number; active_weekdays: number[] | null}[] | null;
  };

  const theoEm = new Map<string, EmTrongLop['mucTieu']>();
  for (const m of (mucTieuRows ?? []) as unknown as HangMucTieu[]) {
    if (!m.student_id || m.kind !== 'academic') continue;
    theoEm.set(m.student_id, {
      id: m.id,
      status: m.status,
      set_by: m.set_by,
      title: m.title,
      baseline: m.baseline,
      target_value: m.target_value,
      unit: m.unit,
      end_date: m.end_date,
      achieved_at: m.achieved_at,
      source_wig_id: m.source_wig_id,
      viec: m.lead_measures?.[0] ?? null,
    });
  }

  const danhSach: EmTrongLop[] = (
    (emRows ?? []) as unknown as {
      student_id: string;
      profiles: {full_name: string | null} | null;
    }[]
  )
    .map((e) => ({
      id: e.student_id,
      ten: e.profiles?.full_name ?? '—',
      mucTieu: theoEm.get(e.student_id) ?? null,
    }))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

  const wigLopChon = (wigLop ?? []).map((w) => ({
    id: w.id,
    area: w.area as string,
    title: w.title ?? '',
  }));

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
      <TuongWig
        classId={myClass.id}
        wigLop={wigLop ?? []}
        wigLopChon={wigLopChon}
        danhSach={danhSach}
        dayShort={t.raw('dayShort') as string[]}
      />

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
