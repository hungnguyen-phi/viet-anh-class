import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {Lock, CalendarDays, Users} from 'lucide-react';
import {NutDoiTrang} from '@/components/ui/NutDoiTrang';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {todayInVN} from '@/lib/dates';
import {AttendanceTable} from '@/components/attendance/AttendanceTable';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';

type EnrRow = {
  student_id: string;
  profiles: {id: string; full_name: string | null; email: string | null} | null;
};

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
  // ĐIỂM DANH LÀ VIỆC CỦA EM (0127). GVCN và tổ trưởng THÔI ghi — em tự check-in mới là điểm
  // danh, ai không check-in thì mặc định vắng. Chữa một ngày ghi nhầm là việc của ban giám hiệu.
  // Cửa sổ bù 7 ngày nay thuộc về BGH/Admin, không còn của GVCN.
  const canBackfill = profile.role === 'principal' || profile.role === 'admin';
  const days: string[] = [];
  const base = new Date(realToday + 'T00:00:00Z');
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  // Quản trị viên được sửa điểm danh của BẤT KỲ ngày nào trong quá khứ — RLS
  // (rls_all_attendance_records) vốn đã cho phép, nhưng giao diện trước đây chỉ dựng đúng 7 nút
  // ngày nên không có cách nào đi xa hơn. Người thử vai quản trị đã báo đúng chỗ này: "bấm vào
  // ngày trước đó nhưng không mở được gì".
  const canPickAnyDate = profile.role === 'admin';

  // Ngày đang xem + LÝ DO nếu không nhận được ?date=.
  // Trước đây ngày ngoài phạm vi bị âm thầm thay bằng hôm nay: người dùng thấy màn hình đổi về
  // hôm nay mà không hiểu vì sao, tưởng tính năng hỏng. Nay nói rõ.
  let today = realToday;
  let dateNotice: string | null = null;
  if (dateParam) {
    const looksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam);
    if (!looksLikeDate) {
      dateNotice = 'Ngày không hợp lệ — đang hiển thị hôm nay.';
    } else if (dateParam > realToday) {
      dateNotice = 'Không điểm danh cho ngày trong tương lai — đang hiển thị hôm nay.';
    } else if (canPickAnyDate || days.includes(dateParam)) {
      today = dateParam;
    } else if (canBackfill) {
      dateNotice =
        'Giáo viên chỉ sửa được điểm danh trong 7 ngày gần nhất. Ngày cũ hơn cần quản trị viên — đang hiển thị hôm nay.';
    } else {
      dateNotice = 'Bạn chỉ điểm danh được ngày hôm nay — đang hiển thị hôm nay.';
    }
  }

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

  // CHỈ BGH VÀ ADMIN SỬA ĐƯỢC (0127). Tổ trưởng vẫn vào được màn này — nhưng để NHÌN ai chưa
  // check-in mà đi nhắc, đúng một việc ấy. GVCN cũng chỉ đọc: bảng này là gương của việc các em
  // đã làm, không phải chỗ cô làm thay.
  //
  // RLS mới là thứ chặn thật; cờ này chỉ để giao diện đừng bày ra những nút bấm vào sẽ báo lỗi.
  const canEdit = profile.role === 'principal' || profile.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display text-[22px] font-bold text-navy">
            {t('title')} · {myClass.name}
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-txt">
            <CalendarDays size={14} strokeWidth={2.2} className="text-grey-mid" />
            {t('todayLabel')}: <b className="text-navy">{today}</b>
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
          {!canBackfill && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-status-bad"
              style={{backgroundColor: 'rgba(192,57,43,0.12)'}}
            >
              <Lock size={12} strokeWidth={2.5} />
              {t('lockedPast')}
            </span>
          )}
        </div>
      </div>

      {/* GVCN/Admin: chọn ngày để bổ sung/sửa điểm danh trong 7 ngày gần nhất */}
      {canBackfill && (
        <div className="flex flex-wrap items-center gap-1.5">
          {days.map((d) => {
            const active = d === today;
            const isToday = d === realToday;
            const label = new Date(d + 'T00:00:00Z');
            const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][label.getUTCDay()];
            // NutDoiTrang chứ không phải <Link>: đổi ngày phải chạy lại truy vấn điểm danh, và
            // người thử 08/2026 báo "bấm lùi rất chậm, như kiểu nút không ăn" — nút giờ mờ đi
            // ngay khi bấm thay vì đứng im chờ server.
            return (
              <NutDoiTrang
                key={d}
                href={{pathname: '/attendance', query: {...(classParam ? {class: classParam} : {}), date: d}}}
                className={`inline-flex flex-col items-center rounded-[10px] px-2.5 py-1.5 text-[11px] font-extrabold leading-tight transition-all ${
                  active
                    ? 'btn-gold border border-transparent'
                    : 'border-[1.5px] border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
                }`}
              >
                <span>{isToday ? t('todayLabel') : dow}</span>
                <span className="text-[10px] font-bold opacity-70">{d.slice(5)}</span>
              </NutDoiTrang>
            );
          })}

          {/* Người thử tưởng "chỉ hiện 7 ngày" là lỗi — nó là luật, nói thẳng ra thì hết hiểu lầm. */}
          {!canPickAnyDate && (
            <span className="self-center pl-1 text-[11px] font-semibold italic text-grey-mid">
              Chỉ sửa được 7 ngày gần nhất — ngày cũ hơn nhờ quản trị viên.
            </span>
          )}

          {/* Quản trị viên: chọn ngày bất kỳ. Form GET → chỉ đổi ?date= trên URL, không cần
              server action. Giữ luôn ?class= để không nhảy sang lớp khác khi đang xem một lớp. */}
          {canPickAnyDate && (
            <form method="get" className="ml-1 flex items-center gap-1.5">
              {classParam && <input type="hidden" name="class" value={classParam} />}
              <label
                htmlFor="pick-date"
                className="text-[11px] font-extrabold uppercase tracking-wide text-navy/70"
              >
                Ngày khác
              </label>
              <input
                id="pick-date"
                type="date"
                name="date"
                defaultValue={today}
                max={realToday}
                className="h-9 rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2 text-[12.5px] font-bold text-navy outline-none focus:border-navy"
              />
              <button
                type="submit"
                className="h-9 cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12px] font-extrabold text-navy transition-colors hover:border-navy"
              >
                Xem
              </button>
            </form>
          )}
        </div>
      )}

      {dateNotice && (
        <p className="rounded-[10px] bg-gold/15 px-3 py-2 text-[12.5px] font-semibold text-gold-text">
          {dateNotice}
        </p>
      )}
      {canEdit && (
        <p className="text-xs italic text-grey-mid">{t('tickAllHint')}</p>
      )}
      {/* key ép remount khi đổi lớp/ngày → xoá sạch state pending, tránh ghi
          điểm danh của lớp này sang lớp khác (nhiễm chéo dữ liệu). */}
      <AttendanceTable
        key={`${myClass.id}-${today}`}
        classId={myClass.id}
        today={today}
        students={dong}
      />

      {/* BẢNG CẢM XÚC ĐÃ BỎ KHỎI MÀN GIÁO VIÊN (quyết định chủ dự án).
          Giáo viên nhìn TRẠNG THÁI ĐIỂM DANH — có mặt / muộn / vắng / có phép — chứ không nhìn
          cảm xúc từng em. Cảm xúc chỉ còn ở màn quản trị, dưới dạng biểu đồ.
          Không xoá component ClassMoodBoard: nó vẫn dùng được nếu sau này đổi ý. */}
    </div>
  );
}
