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
import {ClassStudentWigSetup} from '@/components/wig/ClassStudentWigSetup';
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

  // Sĩ số + số em đã có việc RIÊNG của tuần này — cho khối cuối trang.
  const [{data: enrolled}, {data: readyWigs}] = await Promise.all([
    supabase.from('enrollments').select('student_id').eq('class_id', myClass.id).eq('is_active', true),
    supabase
      .from('wigs')
      .select('student_id')
      .eq('class_id', myClass.id)
      .eq('scope', 'student')
      .eq('period', 'week')
      .eq('period_label', wk.label),
  ]);

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

      {/* Việc RIÊNG của từng em. Chuyển từ /wig sang đây: nó là chuyện quản lý theo em, cùng họ
          với mọi thứ trên màn này, và trên trang hằng ngày thì nó chiếm một khối lớn cho một thao
          tác mỗi tuần bấm nhiều nhất một lần. */}
      <ClassStudentWigSetup
        classId={myClass.id}
        weekLabel={wk.label}
        weekStart={monday}
        laTuanNay={laTuanNay}
        studentCount={(enrolled ?? []).length}
        readyCount={new Set((readyWigs ?? []).map((w) => w.student_id)).size}
      />
    </div>
  );
}
