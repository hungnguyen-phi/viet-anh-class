import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {CalendarDays, Users} from 'lucide-react';
import {NutDoiTrang} from '@/components/ui/NutDoiTrang';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {isValidDayVN, ngayVN, shiftWeeks, todayInVN, weekDaysVN} from '@/lib/dates';
import {AttendanceTable} from '@/components/attendance/AttendanceTable';
import {ChonNgayDiemDanh} from '@/components/attendance/ChonNgayDiemDanh';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';

type EnrRow = {
  student_id: string;
  profiles: {id: string; full_name: string | null; email: string | null} | null;
};

const nutTuan =
  'inline-flex h-[42px] items-center gap-1 rounded-[10px] border-[1.5px] border-navy/15 bg-navy/[0.02] px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; date?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, date: dateParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  // Phụ huynh không có việc gì ở trang điểm danh lớp → về báo cáo con mình.
  if (profile.role === 'parent') redirect('/report');
  const t = await getTranslations('attendance');
  const supabase = await createClient();
  const {myClass, classes: accessible} = await getClassContext(supabase, profile, classParam);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  // Học sinh chỉ vào được trang điểm danh KHI là tổ trưởng điểm danh (PRD §6.2 màn 3).
  // Học sinh thường → về trang cá nhân, không thấy dữ liệu cả lớp.
  if (profile.role === 'student') {
    const {data: myEnr} = await supabase
      .from('enrollments')
      .select('is_attendance_leader')
      .eq('class_id', myClass.id)
      .eq('student_id', profile.id)
      .maybeSingle();
    if (!myEnr?.is_attendance_leader) redirect('/student');
  }

  // Ngày hôm nay theo giờ VN — TÍNH TẠI CHỖ, không hỏi máy chủ CSDL.
  //
  // Trước đây gọi rpc('app_today'), tốn một vòng mạng (đo được 60–197 ms) chỉ để hỏi hôm nay là
  // ngày mấy. Và chính mã này đã dùng todayInVN() làm phương án dự phòng ngay dòng dưới — tức là
  // đã tin nó đúng rồi. lib/dates.ts tính bằng Intl với múi giờ Asia/Ho_Chi_Minh nên không phụ
  // thuộc giờ máy chủ (máy chủ chạy UTC, lệch 7 tiếng).
  const realToday = todayInVN();

  const [{data: enrolls}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(id, full_name, email)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
  ]);
  // XEM NGÀY NÀO CŨNG ĐƯỢC — bảng này chỉ để NHÌN (0127: em tự check-in, cô không ghi thay), nên
  // không còn lý do khoá "7 ngày gần nhất" như thời cô còn sửa được điểm danh. Đi theo tuần: thứ
  // Hai → Chủ nhật của tuần chứa ngày đang xem, hai nút lùi/tiến tuần, và một ô lịch cho ngày lẻ.
  // Tổ trưởng điểm danh (học sinh) thì chỉ có hôm nay: RLS mood_checkins không cho em đọc ngày
  // khác của bạn, bày nút ra là bày một bảng trống.
  const xemDuocNgayKhac = profile.role !== 'student';

  // Ngày đang xem. Ngày sai dạng hay ở tương lai → hôm nay, nói một câu.
  let today = realToday;
  let dateNotice: string | null = null;
  if (dateParam) {
    if (!isValidDayVN(dateParam)) {
      dateNotice = 'Ngày không hợp lệ — đang hiển thị hôm nay.';
    } else if (dateParam > realToday) {
      dateNotice = 'Chưa tới ngày ấy — đang hiển thị hôm nay.';
    } else if (xemDuocNgayKhac) {
      today = dateParam;
    }
  }
  const tuan = weekDaysVN(today);
  const tuanTruoc = shiftWeeks(tuan[0], -1);
  const tuanSau = shiftWeeks(tuan[0], 1);
  // Tuần sau chỉ có nghĩa khi ít nhất thứ Hai của nó đã tới.
  const coTuanSau = tuanSau <= realToday;
  const duongNgay = (d: string) => ({
    pathname: '/attendance' as const,
    query: {...(classParam ? {class: classParam} : {}), date: d},
  });

  const students = ((enrolls ?? []) as unknown as EnrRow[])
    // TÊN, KHÔNG PHẢI UUID. Em chưa khai tên thì trước đây bảng in nguyên
    // "7f801b90-4de0-434e-ba24-be600a315fc9" ra giữa danh sách lớp — nhìn thấy trên production
    // 15/08/2026. Dùng đúng phép dự phòng dùng chung của dự án: tên → phần trước @ của email.
    .map((e) => ({id: e.student_id, name: tenHienThi(e.profiles?.full_name, e.profiles?.email)}))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  // Đợt 2: CẢM XÚC VÀ GIỜ CHECK-IN của hôm nay (16/08/2026).
  //
  // Không đọc attendance_records nữa: từ 0127 bản ghi ấy SINH RA TỪ cú check-in, nên nó là bản
  // sao của thứ ngay dưới đây — và bảng của cô thì cần đúng hai thứ em thật sự làm: bấm lúc mấy
  // giờ, và hôm nay thấy thế nào.
  const {data: moods} = await supabase
    .from('mood_checkins')
    .select('student_id, mood, buoi, created_at')
    .eq('class_id', myClass.id)
    .eq('date', today);

  const dong = students.map((st) => {
    const sang = (moods ?? []).find((m) => m.student_id === st.id && m.buoi !== 'chieu');
    const chieu = (moods ?? []).find((m) => m.student_id === st.id && m.buoi === 'chieu');
    return {
      id: st.id,
      name: st.name,
      moodSang: sang?.mood ?? null,
      gioSang: sang?.created_at ?? null,
      moodChieu: chieu?.mood ?? null,
      gioChieu: chieu?.created_at ?? null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-[22px] font-bold text-navy">
            {t('title')} · {myClass.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-txt">
            <CalendarDays size={14} strokeWidth={2.2} className="text-grey-mid" />
            {today === realToday ? t('todayLabel') : t('viewingDay')}: <b className="text-navy">{ngayVN(today)}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-txt">
            <Users size={14} strokeWidth={2.2} className="text-grey-mid" />
            {t('sizeLabel')}: <b className="text-navy">{students.length}</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Quản trị/BGH thấy bộ chọn KỂ CẢ khi chỉ có một lớp: nó là chỗ duy nhất trên màn hình
            nói rõ mình đang đứng ở lớp nào. Giáo viên chỉ có lớp mình thì giấu đi cho gọn. */}
        {(accessible.length > 1 || profile.role === 'admin' || profile.role === 'principal') && (
          <ClassPicker classes={accessible} current={myClass.id} />
        )}
        <ClassOwnerNote classId={myClass.id} viewerId={profile.id} viewerRole={profile.role} />
        </div>
      </div>

      {/* Thanh tuần: ← tuần trước · T2…CN (ngày/tháng) · tuần sau → · ô lịch. Ngày trước, tháng
          sau — người Việt đọc 11/8, không đọc 08-11. */}
      {xemDuocNgayKhac && (
        <div className="flex flex-wrap items-center gap-1.5">
          <NutDoiTrang href={duongNgay(tuanTruoc)} className={nutTuan} ariaLabel={t('prevWeek')}>
            ← {t('prevWeek')}
          </NutDoiTrang>
          {tuan.map((d, i) => {
            const active = d === today;
            const isToday = d === realToday;
            const dow = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i];
            // Ngày chưa tới: chữ mờ, không bấm — tuần đang xem vẫn đủ bảy ô cho mắt bám.
            if (d > realToday) {
              return (
                <span
                  key={d}
                  className="inline-flex flex-col items-center rounded-[10px] border-[1.5px] border-navy/[0.08] px-2.5 py-1.5 text-[11px] font-extrabold leading-tight text-grey-soft"
                >
                  <span>{dow}</span>
                  <span className="text-[10px] font-bold">{ngayVN(d).slice(0, 5)}</span>
                </span>
              );
            }
            return (
              <NutDoiTrang
                key={d}
                href={duongNgay(d)}
                className={`inline-flex flex-col items-center rounded-[10px] px-2.5 py-1.5 text-[11px] font-extrabold leading-tight transition-all ${
                  active
                    ? 'btn-gold border border-transparent'
                    : 'border-[1.5px] border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
                }`}
              >
                <span>{isToday ? t('todayLabel') : dow}</span>
                <span className="text-[10px] font-bold opacity-70">{ngayVN(d).slice(0, 5)}</span>
              </NutDoiTrang>
            );
          })}
          {coTuanSau ? (
            <NutDoiTrang href={duongNgay(tuanSau)} className={nutTuan} ariaLabel={t('nextWeek')}>
              {t('nextWeek')} →
            </NutDoiTrang>
          ) : (
            <span className={`${nutTuan} cursor-not-allowed opacity-40`}>{t('nextWeek')} →</span>
          )}
          <span className="ml-1">
            <ChonNgayDiemDanh ngay={today} toiDa={realToday} classParam={classParam} />
          </span>
        </div>
      )}

      {dateNotice && (
        <p className="rounded-[10px] bg-gold/15 px-3 py-2 text-[12.5px] font-semibold text-gold-text">
          {dateNotice}
        </p>
      )}
      {/* key ép remount khi đổi lớp/ngày → xoá sạch state pending, tránh ghi
          điểm danh của lớp này sang lớp khác (nhiễm chéo dữ liệu). */}
      <AttendanceTable
        key={`${myClass.id}-${today}`}
        classId={myClass.id}
        today={today}
        students={dong}
      />

    </div>
  );
}
