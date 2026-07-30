'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import type {Database} from '@/lib/database.types';

type Kind = Database['public']['Enums']['homework_kind'];

// Nhãn dùng trong CÂU THÔNG BÁO (không phải nhãn hiển thị trên thẻ — cái đó ở page.tsx).
// Viết thường vì luôn nằm giữa câu: "Đã đăng bài tập môn Toán…".
const TEN_LOAI: Record<Kind, string> = {
  assignment: 'bài tập',
  reminder: 'lời dặn',
  exam: 'thông báo kiểm tra',
};

const NGAY_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Ô Môn giờ gửi lên id của danh mục. Kiểm dạng uuid ngay tại đây để câu lỗi là tiếng Việt dễ
// hiểu, thay vì để Postgres trả 22P02 rồi friendlyError chỉ nói được "Đã xảy ra lỗi".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// yyyy-mm-dd → dd/mm. Trường học Việt Nam đọc ngày trước tháng; chỉ dùng trong câu thông báo
// ngắn nên bỏ năm cho gọn.
function ngayNgan(iso: string): string {
  const [, m, d] = iso.split('-');
  return d && m ? `${d}/${m}` : iso;
}

function homeworkFlash(classId: string, msg: string): never {
  // Giữ ?class= để sau thao tác vẫn ở đúng lớp đang xem (ClassPicker điều hướng bằng tham số này).
  const lop = classId ? `class=${encodeURIComponent(classId)}&` : '';
  redirect(`/homework?${lop}flash=${encodeURIComponent(msg)}`);
}

// State trả về cho useActionState → lỗi hiện ngay cạnh ô, KHÔNG mất nội dung đã soạn.
// Với báo bài thì điều này quan trọng hơn hẳn các form khác: ô nội dung có thể là mấy dòng bài
// tập vừa gõ tay, mất là phải gõ lại từ đầu.
export type HomeworkFields = {
  date: string;
  // ID môn trong danh mục, KHÔNG phải tên môn gõ tay nữa (0069).
  subject_id: string;
  content: string;
  due_date: string;
  kind: string;
};

export type HomeworkState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung
  fieldError?: string; // tên ô lỗi → tô đỏ + hiện lỗi ngay dưới ô đó
  values?: HomeworkFields;
};

function readFields(formData: FormData): HomeworkFields {
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  return {
    date: s('date'),
    subject_id: s('subject_id'),
    content: s('content'),
    due_date: s('due_date'),
    kind: s('kind'),
  };
}

// Loại gửi lên là chuỗi từ <select>; enum trong DB chỉ nhận đúng ba giá trị. Sai thì quy về
// 'assignment' thay vì trả lỗi — người dùng không tự gõ được ô này, sai chỉ xảy ra khi bị sửa tay.
function docLoai(v: string): Kind {
  return v === 'reminder' || v === 'exam' ? v : 'assignment';
}

// Đăng bài mới, hoặc sửa bài đã đăng (có post_id).
//
// Gộp một hàm cho cả hai vì luật hợp lệ y hệt nhau; tách ra chỉ để hai bản kiểm tra lệch nhau
// theo thời gian. Phân biệt bằng post_id rỗng hay không.
export async function savePost(
  _prev: HomeworkState,
  formData: FormData,
): Promise<HomeworkState> {
  // Kiểm quyền LẠI ở action, không tin trang gọi nó. Hiệu trưởng CỐ Ý không có quyền ghi
  // (migration 0061): người chịu trách nhiệm về bài tập của lớp là GVCN.
  const me = await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  const postId = String(formData.get('post_id') ?? '');
  const f = readFields(formData);
  const values = f; // giữ lại mọi ô đã gõ để trả về khi lỗi

  if (!classId) return {ok: false, error: friendlyError(null), values};
  if (!NGAY_ISO.test(f.date))
    return {ok: false, fieldError: 'date', error: 'Hãy chọn ngày báo bài.', values};
  if (!UUID.test(f.subject_id))
    return {ok: false, fieldError: 'subject_id', error: 'Hãy chọn môn học.', values};
  if (!f.content)
    return {ok: false, fieldError: 'content', error: 'Hãy nhập nội dung báo bài.', values};
  if (f.due_date && !NGAY_ISO.test(f.due_date))
    return {ok: false, fieldError: 'due_date', error: 'Hạn nộp không hợp lệ.', values};
  // Chặn ở đây để người dùng thấy câu tiếng Việt đúng chỗ sai. DB cũng chặn (constraint
  // homework_due_after_date) nhưng lỗi từ DB chỉ ra được câu chung chung "Giá trị nhập không hợp lệ".
  if (f.due_date && f.due_date < f.date)
    return {
      ok: false,
      fieldError: 'due_date',
      error: 'Hạn nộp không thể trước ngày báo bài.',
      values,
    };

  const kind = docLoai(f.kind);
  const supabase = await createClient();

  if (postId) {
    // KHÔNG cho đổi class_id: sửa bài là sửa nội dung, chuyển bài sang lớp khác không phải là
    // việc có thật. .select() để phân biệt "RLS chặn / bài đã bị xoá" với "đã lưu xong", và tiện
    // lấy luôn TÊN môn từ danh mục để báo lại cho đúng — mã mới không giữ tên môn trong tay.
    // CHỈ ghi subject_id; cột chữ `subject` cũ cố ý không đụng tới (quyết định E của 0069).
    const {data, error} = await supabase
      .from('homework_posts')
      .update({
        date: f.date,
        subject_id: f.subject_id,
        content: f.content,
        due_date: f.due_date || null,
        kind,
      })
      .eq('id', postId)
      .select('id, subjects(name)');
    if (error) return {ok: false, error: friendlyError(error), values};
    if (!data || data.length === 0)
      return {
        ok: false,
        error: 'Không sửa được — bài này không còn, hoặc bạn không phải giáo viên chủ nhiệm của lớp.',
        values,
      };
    const tenMon = data[0]?.subjects?.name;
    revalidatePath('/[locale]/homework', 'page');
    return {
      ok: true,
      message: `Đã cập nhật ${TEN_LOAI[kind]}${tenMon ? ` môn ${tenMon}` : ''}`,
    };
  }

  const {data, error} = await supabase
    .from('homework_posts')
    .insert({
      class_id: classId,
      date: f.date,
      subject_id: f.subject_id,
      content: f.content,
      due_date: f.due_date || null,
      kind,
      created_by: me.id,
    })
    .select('id, subjects(name)');
  if (error) return {ok: false, error: friendlyError(error), values};
  // Phòng xa: RLS chặn insert thì thường trả 42501 ở nhánh trên, nhưng không báo thành công giả.
  if (!data || data.length === 0)
    return {
      ok: false,
      error: 'Không đăng được — bạn không phải giáo viên chủ nhiệm của lớp này.',
      values,
    };

  const tenMon = data[0]?.subjects?.name;
  revalidatePath('/[locale]/homework', 'page');
  return {
    ok: true,
    message: `Đã đăng ${TEN_LOAI[kind]}${tenMon ? ` môn ${tenMon}` : ''} cho ngày ${ngayNgan(f.date)}`,
  };
}

// Gieo cả bộ môn của cơ sở vào chương trình lớp (class_subjects), để ô chọn môn thôi rỗng.
//
// Không tự làm ngầm khi mở trang: đây là một thao tác GHI, và người bấm phải là người chịu trách
// nhiệm về chương trình của lớp. RPC tự kiểm quyền (GVCN lớp / hiệu trưởng cùng cơ sở / admin) và
// tự bỏ qua môn đã có, nên bấm nhầm hai lần cũng không sao.
export async function seedSubjects(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  if (!classId) homeworkFlash(classId, 'Thiếu thông tin lớp');
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('seed_class_subjects', {p_class: classId});
  revalidatePath('/[locale]/homework', 'page');
  homeworkFlash(
    classId,
    error ? friendlyError(error) : `Đã thêm ${data ?? 0} môn vào chương trình của lớp`,
  );
}

// Xoá hẳn một bài báo. homework_done tham chiếu post_id với on delete cascade → tick của các em
// theo bài đó cũng đi cùng, đúng ý: bài không còn thì lời tự khai cho bài đó cũng vô nghĩa.
export async function deletePost(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!classId || !id) homeworkFlash(classId, 'Thiếu thông tin');
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('homework_posts')
    .delete()
    .eq('id', id)
    .select('id');
  revalidatePath('/[locale]/homework', 'page');
  if (error) homeworkFlash(classId, friendlyError(error));
  homeworkFlash(
    classId,
    (data ?? []).length > 0
      ? 'Đã xoá bài báo'
      : 'Không xoá được — bài không còn, hoặc bạn không có quyền với lớp này.',
  );
}

// Học sinh TỰ đánh dấu đã làm / bỏ đánh dấu.
//
// Chỉ vai 'student' gọi được: đây là lời tự khai của chính em. Phụ huynh và giáo viên cố ý KHÔNG
// đánh dấu hộ được — tick hộ thì con số "còn mấy em chưa đụng tới bài" không còn nghĩa gì.
// Bỏ tick = XOÁ hàng (bảng không có policy UPDATE, xem 0061).
export async function toggleDone(formData: FormData) {
  const me = await requireRole(['student']);
  const classId = String(formData.get('class_id') ?? '');
  const postId = String(formData.get('post_id') ?? '');
  // Trạng thái HIỆN TẠI do trang gửi lên; bấm nút nghĩa là đảo lại trạng thái đó.
  const dangDanhDau = String(formData.get('done') ?? '') === '1';
  if (!postId) homeworkFlash(classId, 'Thiếu thông tin');

  const supabase = await createClient();

  if (dangDanhDau) {
    const {error} = await supabase
      .from('homework_done')
      .delete()
      .eq('post_id', postId)
      .eq('student_id', me.id);
    revalidatePath('/[locale]/homework', 'page');
    homeworkFlash(classId, error ? friendlyError(error) : 'Đã bỏ đánh dấu bài này');
  }

  const {error} = await supabase
    .from('homework_done')
    .insert({post_id: postId, student_id: me.id});
  revalidatePath('/[locale]/homework', 'page');
  // 23505 = đã có hàng rồi. Xảy ra khi em bấm hai lần, hoặc mở app trên hai máy — với người dùng
  // thì kết quả vẫn đúng ("đã đánh dấu"), báo lỗi ở đây chỉ làm em hoang mang.
  if (error && error.code !== '23505') homeworkFlash(classId, friendlyError(error));
  homeworkFlash(classId, 'Đã đánh dấu: em tự ghi nhận là đã làm bài này');
}
