'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {parseDob} from '@/lib/dob';

// Đặt tổ trưởng điểm danh cho lớp. ĐỘC QUYỀN: mỗi lớp đúng 1 em.
//
// Bản cũ (setAttendanceLeader) chỉ bật/tắt cờ của MỘT em và không gỡ người cũ → lớp có thể có
// nhiều tổ trưởng cùng lúc, mà cờ này mở RLS att_leader_insert/update cho em đó ghi điểm danh
// cả lớp. Nay đặt em mới thì tự gỡ em cũ.
//
// studentId = null → gỡ hẳn, lớp không có tổ trưởng.
// Trả về state thay vì redirect: client cần biết pending/lỗi để hiện spinner (trước đây bấm xong
// im 5 giây, người dùng tưởng nút không ăn).
export async function assignAttendanceLeader(
  classId: string,
  studentId: string | null,
): Promise<{ok: boolean; error?: string}> {
  // KHÔNG mở cho ban giám hiệu, khác với mọi việc khác trong file này (0094 mở cho họ ghi danh,
  // sửa thông tin, cho rời lớp). Trưởng điểm danh là một vai TRONG LỚP, do người dạy lớp ấy
  // chọn — và luật dưới CSDL cũng chỉ cho GVCN ghi vào cột này. Mở ở đây mà dưới vẫn chặn thì
  // BGH bấm xong nhận đúng một câu "không có quyền", tệ hơn là không thấy nút.
  await requireRole(['teacher', 'admin']);
  if (!classId) return {ok: false, error: 'Thiếu lớp'};
  const supabase = await createClient();

  // Gỡ mọi người đang giữ cờ trong lớp trước. Không atomic với bước sau, nhưng cờ này chỉ ảnh
  // hưởng link "Điểm danh" và RLS att_leader_* của HÔM NAY → khoảng trống vài trăm ms vô hại.
  const clear = await supabase
    .from('enrollments')
    .update({is_attendance_leader: false})
    .eq('class_id', classId)
    .eq('is_active', true)
    .eq('is_attendance_leader', true);
  if (clear.error) return {ok: false, error: (friendlyError(clear.error))};

  if (studentId) {
    // .select() để phân biệt "RLS chặn / em đã rời lớp" với "đã đổi xong" — không báo thành công giả.
    const {data, error} = await supabase
      .from('enrollments')
      .update({is_attendance_leader: true})
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .select('student_id');
    if (error) return {ok: false, error: (friendlyError(error))};
    if (!data || data.length === 0)
      return {ok: false, error: 'Không đặt được — em này không còn trong lớp, hoặc bạn không có quyền.'};
  }

  revalidatePath('/[locale]/roster', 'page');
  revalidatePath('/[locale]/attendance', 'page');
  return {ok: true};
}

function rosterFlash(classId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/roster?class=${encodeURIComponent(classId)}&${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// State trả về cho useActionState → hiện lỗi/thành công INLINE (không redirect, giữ nguyên email đã gõ).
export type EnrollState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung (server/DB)
  fieldError?: string; // tên field lỗi để tô đỏ + hiện dưới field
  values?: StudentFields;
};

// Thông tin nhận diện học sinh, điền ngay lúc ghi danh (bảng student_details, migration 0058).
// Chỉ `email` bắt buộc — phần còn lại điền được tới đâu thì tới, bổ sung sau vẫn được.
//
// Ngày sinh nhận vào dưới dạng BA Ô RỜI (ngày / tháng / năm), không phải một chuỗi.
export type StudentFields = {
  email: string;
  full_name?: string;
  student_code?: string;
  dob_day?: string;
  dob_month?: string;
  dob_year?: string;
  parent_phone?: string;
  note?: string;
};

function readStudentFields(formData: FormData): StudentFields {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  return {
    email: s('email'),
    full_name: s('full_name'),
    student_code: s('student_code'),
    dob_day: s('dob_day'),
    dob_month: s('dob_month'),
    dob_year: s('dob_year'),
    parent_phone: s('parent_phone'),
    note: s('note'),
  };
}

// Ghi/cập nhật thông tin nhận diện. Khoá theo email nên gọi được cả khi em CHƯA có tài khoản.
// Chỉ ghi khi có ít nhất một trường ngoài email — tránh tạo dòng rỗng vô nghĩa.
// Lỗi ở đây KHÔNG làm hỏng việc ghi danh: ghi danh mới là việc chính, thông tin thêm là phụ.
async function saveStudentDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  f: StudentFields,
  dobIso: string | null,
  meId: string,
): Promise<void> {
  if (!f.full_name && !f.student_code && !dobIso && !f.parent_phone && !f.note) return;
  await supabase.from('student_details').upsert(
    {
      email: f.email.toLowerCase(),
      full_name: f.full_name || null,
      student_code: f.student_code || null,
      date_of_birth: dobIso,
      parent_phone: f.parent_phone || null,
      note: f.note || null,
      created_by: meId,
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'email'},
  );
}

// initial state {ok:false} định nghĩa trong client form ('use server' chỉ export async function).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ghi danh học sinh (theo email) vào lớp — cũng dùng để CHUYỂN LỚP (tắt lớp cũ).
// INLINE validation (useActionState): lỗi hiện cạnh field, giữ nguyên email, báo thành công ngay.
export async function enrollStudent(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('class_id') ?? '');
  const fields = readStudentFields(formData);
  const email = fields.email;
  // Giữ lại MỌI ô đã gõ để trả về khi có lỗi (không mất công điền lại 6 trường).
  const values = fields;

  if (!classId) return {ok: false, error: (friendlyError(null)), values};
  if (!email) return {ok: false, fieldError: 'email', error: 'Hãy nhập email học sinh.', values};
  if (!EMAIL_RE.test(email))
    return {ok: false, fieldError: 'email', error: 'Email không hợp lệ (vd hs01@student.truongvietanh.com).', values};

  // Chặn ngày sinh sai TRƯỚC khi ghi danh: nếu để lọt xuống dưới thì em vẫn vào lớp nhưng ngày
  // sinh bị bỏ trắng lặng lẽ, giáo viên không biết mà điền lại.
  const dob = parseDob({day: fields.dob_day, month: fields.dob_month, year: fields.dob_year});
  if (dob.error) return {ok: false, fieldError: 'date_of_birth', error: dob.error, values};

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('enroll_student_by_email', {p_class: classId, p_email: email});
  if (error) return {ok: false, error: (friendlyError(error)), values};

  // Chưa có tài khoản → KHÔNG còn là ngõ cụt.
  //
  // Trước đây chỗ này chỉ báo "không tìm thấy… yêu cầu em đăng nhập trước" rồi dừng, khiến giáo
  // viên phải chờ từng em tự đăng nhập mới lập được danh sách lớp — luồng ngược hẳn với thực tế
  // đầu năm học. Nay ghi một lời mời: em đó đăng nhập lần đầu là trigger handle_new_user tự gán
  // vai học sinh và ĐƯA THẲNG vào đúng lớp này, giáo viên không phải quay lại làm gì thêm.
  if (data === 'not_found') {
    const {data: inv, error: invErr} = await supabase.rpc('invite_student_to_class', {
      p_class: classId,
      p_email: email,
    });
    if (invErr) return {ok: false, error: (friendlyError(invErr)), values};
    if (inv === 'invited') {
      // Lưu thông tin SAU khi có lời mời: RLS của student_details cho phép GVCN ghi khi email đó
      // đã được mời vào lớp mình — nên thứ tự này bắt buộc, đảo lại là bị chặn.
      await saveStudentDetails(supabase, fields, dob.iso, me.id);
      revalidatePath('/[locale]/roster', 'page');
      return {
        ok: true,
        message: `${email} chưa có tài khoản — đã lưu lời mời${fields.full_name ? ` cho ${fields.full_name}` : ''} vào lớp này. Em sẽ có tên trong danh sách ngay bây giờ, và tự vào lớp khi đăng nhập lần đầu.`,
      };
    }
    if (inv === 'other_role')
      return {
        ok: false,
        fieldError: 'email',
        error: `${email} đang được mời với một vai khác (giáo viên/phụ huynh…). Nhờ quản trị viên xử lý trước để tránh gán nhầm vai.`,
        values,
      };
    if (inv === 'forbidden')
      return {
        ok: false,
        error: 'Bạn không phải giáo viên chủ nhiệm của lớp này nên không mời được học sinh vào đây.',
        values,
      };
    return {
      ok: false,
      fieldError: 'email',
      error: `Email ${email} không hợp lệ.`,
      values,
    };
  }

  await saveStudentDetails(supabase, fields, dob.iso, me.id);
  revalidatePath('/[locale]/roster', 'page');
  return {ok: true, message: `Đã ghi danh ${fields.full_name || email} vào lớp`};
}

// ── SỬA THÔNG TIN MỘT EM ĐÃ CÓ TRONG DANH SÁCH ────────────────────────────────────────────
//
// Trước bản này danh sách lớp chỉ có THÊM và XOÁ. Gõ nhầm một chữ trong tên, hay phụ huynh đổi
// số điện thoại, thì cách duy nhất là xoá em ra rồi ghi danh lại — mà xoá em đã có tài khoản là
// đụng tới điểm danh, WIG, biên bản họp của em ấy. Không ai làm thế, nên thực tế là thông tin sai
// nằm lại vĩnh viễn.
//
// GHI ĐÈ CẢ Ô TRỐNG, khác hẳn saveStudentDetails ở trên. Hàm kia bỏ qua khi mọi ô đều trống vì nó
// phục vụ lúc TẠO (không tạo dòng rỗng vô nghĩa); còn ở đây xoá trắng một ô là Ý ĐỊNH — xoá ghi
// chú cũ, gỡ số điện thoại chép nhầm. Không ghi đè thì người dùng bấm Lưu, màn hình báo đã lưu,
// mà giá trị cũ vẫn còn.
//
// EMAIL KHÔNG SỬA ĐƯỢC ở đây, cố ý: email là DANH TÍNH — nó là khoá của student_details, của
// pending_user_grants, và là thứ nối em với tài khoản khi em đăng nhập lần đầu. Đổi email tức là
// một người khác, nên đường đúng là huỷ lời mời rồi ghi danh lại đúng địa chỉ.
//
// Không có bước phê duyệt nào: người sửa chính là GVCN của lớp, và RLS của student_details
// (migration 0058) đã chặn đúng vòng ấy — GVCN chỉ chạm được vào em trong lớp mình hoặc em mình
// vừa mời. Một hàng dữ liệu duy nhất, khoá theo email, nên quản trị viên mở lên là thấy ngay bản
// vừa sửa; không có bản sao thứ hai để hai bên lệch nhau.
export async function capNhatHocSinh(_prev: EnrollState, formData: FormData): Promise<EnrollState> {
  await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('class_id') ?? '');
  const fields = readStudentFields(formData);
  const email = fields.email.toLowerCase();
  const values = fields;

  if (!email) return {ok: false, error: 'Thiếu email học sinh.', values};

  const dob = parseDob({day: fields.dob_day, month: fields.dob_month, year: fields.dob_year});
  if (dob.error) return {ok: false, fieldError: 'date_of_birth', error: dob.error, values};

  const supabase = await createClient();
  // upsert chứ không update: em được ghi danh từ trước bản 0058 thì CHƯA có hàng nào trong
  // student_details, và một update lặng lẽ không khớp dòng nào sẽ báo "đã lưu" cho một việc
  // không xảy ra.
  const {data, error} = await supabase
    .from('student_details')
    .upsert(
      {
        email,
        full_name: fields.full_name || null,
        student_code: fields.student_code || null,
        date_of_birth: dob.iso,
        parent_phone: fields.parent_phone || null,
        note: fields.note || null,
        updated_at: new Date().toISOString(),
      },
      {onConflict: 'email'},
    )
    .select('email');
  if (error) return {ok: false, error: friendlyError(error), values};
  // RLS chặn thì upsert trả 0 dòng mà error vẫn null — không kiểm là báo thành công giả.
  if (!data || data.length === 0)
    return {ok: false, error: 'Không sửa được — em này không thuộc lớp bạn chủ nhiệm.', values};

  revalidatePath('/[locale]/roster', 'page');
  // Quản trị viên nhìn cùng một hàng dữ liệu ấy; không gọi thì trang họ đang mở còn bản cũ.
  revalidatePath('/[locale]/admin', 'page');
  if (classId) revalidatePath('/[locale]/attendance', 'page');
  return {ok: true, message: `Đã lưu thông tin ${fields.full_name || email}`};
}

// Huỷ lời mời của em CHƯA đăng nhập lần nào.
//
// Khác removeStudent: em này chưa có tài khoản nên không có gì trong `enrollments` để tắt —
// thứ cần xoá là hàng trong `pending_user_grants`. Không có nút này thì gõ sai một email là
// dòng "chưa đăng nhập" đó nằm lại trong danh sách lớp vĩnh viễn.
//
// Thông tin đã điền (student_details) thì GIỮ LẠI, không xoá theo: nếu chỉ gõ sai lớp rồi mời
// lại đúng lớp, giáo viên không phải điền lại 5 trường.
export async function cancelStudentInvite(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('classId') ?? '');
  const email = String(formData.get('email') ?? '').trim();
  if (!classId || !email) rosterFlash(classId, 'Thiếu thông tin');
  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn / không có dòng nào" với "đã xoá xong" — không báo
  // thành công giả.
  const {data, error} = await supabase
    .from('pending_user_grants')
    .delete()
    .eq('class_id', classId)
    .ilike('email', email)
    .select('email');
  revalidatePath('/[locale]/roster', 'page');
  if (error) rosterFlash(classId, loi(friendlyError(error)));
  rosterFlash(
    classId,
    (data ?? []).length > 0
      ? `Đã huỷ lời mời ${email}`
      : 'Không huỷ được — lời mời không còn, hoặc bạn không có quyền với lớp này.',
  );
}

// Cho học sinh rời lớp (is_active=false) — không xoá dữ liệu.
export async function removeStudent(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('classId') ?? '');
  const studentId = String(formData.get('studentId') ?? '');
  if (!classId || !studentId) rosterFlash(classId, 'Thiếu thông tin');
  const supabase = await createClient();
  const {error} = await supabase.rpc('unenroll_student', {p_class: classId, p_student: studentId});
  revalidatePath('/[locale]/roster', 'page');
  rosterFlash(classId, error ? loi(friendlyError(error)) : 'Đã cho học sinh rời lớp');
}

// ── DỜI HỌC SINH SANG LỚP KHÁC ────────────────────────────────────────────────────────────
//
// Luật nằm dưới CSDL (migration 0089), không nằm ở đây: GVCN lớp hiện tại đề nghị, GVCN lớp đích
// duyệt, trong lúc chờ em vẫn ở lớp cũ, quản trị chuyển thẳng. Đặt luật ở RPC vì đây là quyền —
// kiểm ở tầng giao diện thì ai gọi thẳng API là đi vòng qua được.

export async function requestTransfer(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('classId') ?? '');
  const studentId = String(formData.get('studentId') ?? '');
  const toClass = String(formData.get('toClassId') ?? '');
  const note = String(formData.get('note') ?? '').trim() || undefined;
  if (!classId || !studentId || !toClass) rosterFlash(classId, loi('Thiếu thông tin'));

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('request_class_transfer', {
    p_student: studentId,
    p_to_class: toClass,
    p_note: note,
  });
  revalidatePath('/[locale]/roster', 'page');
  if (error) rosterFlash(classId, loi(friendlyError(error)));
  rosterFlash(
    classId,
    data === 'moved'
      ? 'Đã chuyển em sang lớp mới.'
      : data === 'exists'
        ? loi('Em này đã có một đề nghị dời lớp đang chờ duyệt.')
        : 'Đã gửi đề nghị. Em vẫn ở lớp này cho tới khi lớp bên kia duyệt.',
  );
}

export async function decideTransfer(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('classId') ?? '');
  const requestId = String(formData.get('requestId') ?? '');
  const approve = String(formData.get('approve') ?? '') === 'true';
  if (!requestId) rosterFlash(classId, loi('Thiếu đề nghị'));

  const supabase = await createClient();
  const {error} = await supabase.rpc('decide_class_transfer', {
    p_request: requestId,
    p_approve: approve,
  });
  revalidatePath('/[locale]/roster', 'page');
  rosterFlash(
    classId,
    error
      ? loi(friendlyError(error))
      : approve
        ? 'Đã duyệt — em đã vào lớp này.'
        : 'Đã từ chối đề nghị.',
  );
}

export async function cancelTransfer(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const classId = String(formData.get('classId') ?? '');
  const requestId = String(formData.get('requestId') ?? '');
  if (!requestId) rosterFlash(classId, loi('Thiếu đề nghị'));
  const supabase = await createClient();
  const {error} = await supabase.rpc('cancel_class_transfer', {p_request: requestId});
  revalidatePath('/[locale]/roster', 'page');
  rosterFlash(classId, error ? loi(friendlyError(error)) : 'Đã rút lại đề nghị.');
}
