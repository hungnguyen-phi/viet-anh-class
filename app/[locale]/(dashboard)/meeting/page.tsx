import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getClassContext} from '@/lib/queries';
import {mondayOf, todayInVN, weekFromMonday} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassMeetingSection} from '@/components/wig/ClassMeetingSection';

// ════════════════════════════════════════════════════════════════════════════
// /meeting — BIÊN BẢN HỌP WIG TUẦN, xem theo lớp.
//
// Nhịp họp WIG đã được gộp vào /wig (ClassMeetingSection) để giáo viên chủ nhiệm không phải nhảy
// trang — thanh nav của họ vì thế không còn tab "Họp WIG". Trang này vẫn giữ, vì hai lối vào còn
// dùng nó: mục lục màn hình ở /admin, và ban giám hiệu (vai principal KHÔNG vào được /wig nhưng
// vẫn được ĐỌC biên bản của lớp).
//
// Trước đây trang này VẼ LẠI toàn bộ danh sách biên bản bằng JSX riêng — bản sao thứ hai của
// đúng thứ ClassMeetingSection đã vẽ. Hai bản đã bắt đầu trôi khỏi nhau: bản trong /wig có ô
// "ngày chốt tick", bản ở đây không. Nay dùng chung một component, còn trang chỉ giữ phần vỏ
// (tiêu đề + bộ chọn lớp) mà /wig không có.
// ════════════════════════════════════════════════════════════════════════════

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  // BGH chỉ XEM biên bản + panel; GVCN/Admin mới ghi/sửa/xoá.
  const canManage = profile.role === 'teacher' || profile.role === 'admin';
  const t = await getTranslations('meeting');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  const {myClass, classes: accessible} = await getClassContext(supabase, profile, classParam);
  // Tuần hiện tại theo lịch VN. Trang này không có nút ← → như /wig (nó là lối vào phụ cho BGH),
  // nhưng vẫn phải đưa NGÀY xuống để bảng điểm họp lọc theo ngày thay vì theo nhãn kỳ gõ tay.
  const wk = weekFromMonday(mondayOf(todayInVN()));

  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm font-semibold text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      <ClassMeetingSection
        classId={myClass.id}
        weekLabel={wk.label}
        weekStart={wk.start}
        weekEnd={wk.end}
        tuTrang="meeting"
        canManage={canManage}
        classParam={classParam}
        tickLockDow={myClass.tick_lock_dow}
      />
    </div>
  );
}
