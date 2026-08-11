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

  // Ba câu truy vấn từng đứng ở đây (sĩ số · em nào đã có WIG tuần · mục tiêu năm của lớp) chỉ
  // phục vụ khối tạo WIG cá nhân hàng loạt. Khối ấy đi rồi thì chúng thành ba vòng mạng không ai
  // đọc kết quả — xoá cùng lúc, đừng để lại.

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
          rồi ghi con số ấy xuống bản ghi của từng em. Bỏ cùng đợt 0100 — mục tiêu của em nay là
          khoảng cách của chính em, đặt trong tiết đặt mục tiêu 2–3 lần một năm, không suy ra từ
          một phép chia. Xem docs/MO_HINH_WIG.md §1. */}
    </div>
  );
}
