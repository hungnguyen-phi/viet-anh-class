import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassCoverUpload} from '@/components/shell/ClassCoverUpload';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {AttendanceLeaderPicker} from '@/components/roster/AttendanceLeaderPicker';
import {EnrollForm} from './EnrollForm';
import {removeStudent, cancelStudentInvite} from './actions';

type EnrRow = {
  student_id: string;
  is_attendance_leader: boolean;
  profiles: {full_name: string | null; email: string} | null;
};

// Một dòng trong danh sách lớp — gộp hai nguồn:
//  - em ĐÃ có tài khoản (bảng enrollments)
//  - em MỚI được mời, chưa đăng nhập lần nào (bảng pending_user_grants)
// Trước đây chỉ đọc enrollments, nên mời 30 em vẫn thấy danh sách trống — giáo viên không biết
// đã mời ai, đúng như ban giám hiệu phản ánh.
type Row = {
  key: string;
  studentId: string | null; // null = chưa có tài khoản
  name: string;
  email: string;
  isLeader: boolean;
  code: string | null;
  dob: string | null;
  phone: string | null;
  note: string | null;
};

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  // BGH chỉ XEM (danh sách + mở từng em); GVCN/Admin mới quản lý (ghi danh, tổ trưởng, xoá).
  const canManage = profile.role === 'teacher' || profile.role === 'admin';
  const t = await getTranslations('roster');
  const tc = await getTranslations('class');
  const supabase = await createClient();
  // Hai truy vấn độc lập — chạy song song, tránh waterfall.
  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);

  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-txt">{tc('noClass')}</p>
      </div>
    );
  }

  // Ba truy vấn độc lập → chạy song song.
  // student_details chỉ GVCN của lớp + admin đọc được (RLS, migration 0058); hiệu trưởng gọi
  // vẫn hợp lệ nhưng nhận về rỗng — nên các cột thông tin thêm tự động trống với họ.
  const [{data: enrolls}, {data: invited}, {data: details}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, is_attendance_leader, profiles!enrollments_student_id_fkey(full_name, email)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    supabase.from('pending_user_grants').select('email').eq('class_id', myClass.id).eq('role', 'student'),
    supabase
      .from('student_details')
      .select('email, full_name, student_code, date_of_birth, parent_phone, note'),
  ]);

  const byEmail = new Map(
    (details ?? []).map((d) => [d.email.toLowerCase(), d] as const),
  );
  const detailOf = (email: string) => byEmail.get(email.toLowerCase());

  const enrolled: Row[] = ((enrolls ?? []) as unknown as EnrRow[]).map((r) => {
    const email = r.profiles?.email ?? '';
    const d = detailOf(email);
    return {
      key: r.student_id,
      studentId: r.student_id,
      // Tên hiển thị: ưu tiên tên trong hồ sơ, thiếu thì lấy tên GVCN đã điền lúc ghi danh.
      name: r.profiles?.full_name ?? d?.full_name ?? email ?? r.student_id,
      email,
      isLeader: r.is_attendance_leader,
      code: d?.student_code ?? null,
      dob: d?.date_of_birth ?? null,
      phone: d?.parent_phone ?? null,
      note: d?.note ?? null,
    };
  });

  // Em đã có tài khoản thì bỏ khỏi nhóm "chưa đăng nhập" (lời mời có thể còn sót lại sau khi
  // em đã vào lớp — handle_new_user không luôn dọn hàng grant).
  const enrolledEmails = new Set(enrolled.map((r) => r.email.toLowerCase()));
  const pending: Row[] = (invited ?? [])
    .filter((g) => !enrolledEmails.has(g.email.toLowerCase()))
    .map((g) => {
      const d = detailOf(g.email);
      return {
        key: 'invited:' + g.email,
        studentId: null,
        name: d?.full_name ?? g.email,
        email: g.email,
        isLeader: false,
        code: d?.student_code ?? null,
        dob: d?.date_of_birth ?? null,
        phone: d?.parent_phone ?? null,
        note: d?.note ?? null,
      };
    });

  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, 'vi');
  // Em đang học lên trước, em chưa đăng nhập xuống dưới — đọc danh sách lớp thật là phần trên.
  const rows = [...enrolled.sort(byName), ...pending.sort(byName)];
  const leaderId = enrolled.find((r) => r.isLeader)?.studentId ?? null;
  // Chỉ em ĐÃ có tài khoản mới làm tổ trưởng điểm danh được (cần đăng nhập để ghi).
  const candidates = enrolled.map((r) => ({id: r.studentId!, name: r.name, email: r.email || null}));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        <div className="flex items-center gap-2">
          {canManage && <ClassCoverUpload classId={myClass.id} />}
          {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
        </div>
      </div>

      {flash && (
        <div className="rounded-[12px] border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success">
          {flash}
        </div>
      )}

      {/* Ghi danh / chuyển lớp: nhập email học sinh (đã có tài khoản) — chỉ GVCN/Admin */}
      {canManage && (
        <>
          <EnrollForm classId={myClass.id} />
          {/* Tổ trưởng điểm danh gom về MỘT chỗ (trước đây mỗi dòng một nút) */}
          <AttendanceLeaderPicker
            classId={myClass.id}
            students={candidates}
            currentLeaderId={leaderId}
          />
        </>
      )}

      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header */}
        <div className="flex min-w-[900px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
          <span className="w-[22px] flex-none text-[11px] font-extrabold text-grey-mid">#</span>
          <span className="flex-[1.4] text-[11px] font-extrabold uppercase text-grey-mid">
            {t('name')}
          </span>
          <span className="w-[110px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
            Mã HS
          </span>
          <span className="flex-[1.4] text-[11px] font-extrabold uppercase text-grey-mid">
            {t('email')}
          </span>
          <span className="w-[100px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
            Ngày sinh
          </span>
          <span className="w-[110px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
            SĐT phụ huynh
          </span>
          <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">Ghi chú</span>
          <span className="w-[70px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid" />
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="flex min-w-[900px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
          >
            <span className="w-[22px] flex-none text-[12px] font-bold text-grey-mid">{i + 1}</span>
            <span className="flex min-w-0 flex-[1.4] items-center gap-1.5">
              {/* Em đã có tài khoản → mở được trang cá nhân. Em chưa đăng nhập thì chưa có trang. */}
              {r.studentId ? (
                <Link
                  href={`/student/${r.studentId}`}
                  className="truncate text-[13.5px] font-bold text-navy underline-offset-2 transition-colors hover:underline"
                >
                  {r.name}
                </Link>
              ) : (
                <span className="truncate text-[13.5px] font-bold text-navy/70">{r.name}</span>
              )}
              {/* Chỉ là nhãn: đổi tổ trưởng làm ở khối phía trên, không còn nút trên từng dòng */}
              {r.isLeader && (
                <span
                  title={t('attendanceLeader')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
                >
                  ★ {t('attendanceLeader')}
                </span>
              )}
              {!r.studentId && (
                <span
                  title="Đã ghi danh nhưng em chưa đăng nhập lần nào. Em sẽ tự vào lớp ở lần đăng nhập đầu tiên."
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-navy/70"
                >
                  ○ chưa đăng nhập
                </span>
              )}
            </span>
            <span className="w-[110px] flex-none truncate text-[12.5px] font-bold text-navy/70">
              {r.code ?? '—'}
            </span>
            <span className="min-w-0 flex-[1.4] truncate text-[12.5px] font-semibold text-grey-mid">
              {r.email}
            </span>
            <span className="w-[100px] flex-none text-[12.5px] font-semibold text-grey-mid">
              {r.dob ?? '—'}
            </span>
            <span className="w-[110px] flex-none truncate text-[12.5px] font-semibold text-grey-mid">
              {r.phone ?? '—'}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-grey-mid" title={r.note ?? ''}>
              {r.note ?? '—'}
            </span>
            <span className="grid w-[70px] flex-none place-items-center">
              {canManage && r.studentId && (
                <form action={removeStudent}>
                  <input type="hidden" name="classId" value={myClass.id} />
                  <input type="hidden" name="studentId" value={r.studentId} />
                  <ConfirmButton
                    message={t('confirmRemove', {name: r.name})}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                  >
                    ✕
                  </ConfirmButton>
                </form>
              )}
              {canManage && !r.studentId && (
                <form action={cancelStudentInvite}>
                  <input type="hidden" name="classId" value={myClass.id} />
                  <input type="hidden" name="email" value={r.email} />
                  <ConfirmButton
                    message={`Huỷ lời mời ${r.email}?`}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-navy/20 bg-white text-navy/70 transition-all hover:border-navy"
                  >
                    ✕
                  </ConfirmButton>
                </form>
              )}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="border-t border-navy/[0.08] px-[18px] py-8 text-center text-sm text-grey-mid">
            {t('noStudents')}
          </div>
        )}
      </div>

      {/* Bảng cảm xúc 7 ngày ĐÃ DỜI sang trang Điểm danh: check-in cảm xúc CHÍNH LÀ điểm danh
          (student_checkin ghi cả mood_checkins lẫn attendance_records), nên đặt cạnh nhau mới
          đọc được cùng lúc. */}
    </div>
  );
}
