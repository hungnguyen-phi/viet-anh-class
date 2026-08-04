'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';
import {GIOI_HAN_KY_TU} from '@/components/inbox/format';

// Trần độ dài (GIOI_HAN_KY_TU) để ở components/inbox/format.tsx chứ không ở đây: file 'use server'
// chỉ được export hàm async, export một hằng số là hỏng build.

// Chỉ hai bên trong cuộc mới có màn này. Ban giám hiệu/quản trị viên bị requireRole đưa về trang
// nhà của vai họ — cố ý, xem phần "ai không được thấy" trong 0065.
const VAI_DUOC_VAO = ['parent', 'teacher'] as const;

function inboxFlash(threadId: string | null, msg: string): never {
  const q = new URLSearchParams();
  if (threadId) q.set('t', threadId);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/inbox?${q.toString()}`);
}

export type SendState = {
  ok: boolean;
  message?: string; // báo thành công
  error?: string; // lỗi chung
  fieldError?: string; // tên field lỗi → tô đỏ + hiện dưới field
  value?: string; // nội dung đã gõ, trả lại để không mất công viết lại
};

/**
 * Gửi một tin trong cuộc trao đổi.
 *
 * KHÔNG redirect (trả state cho useActionState): mất nguyên đoạn vừa gõ vì một lỗi mạng là điều
 * khó tha thứ nhất ở ô chat — người ta viết mấy dòng tâm sự về con mình chứ không phải điền form.
 *
 * Bốn cột danh tính (sender_id / sender_role / sender_side / created_at) do trigger
 * trg_pt_stamp_message ép lại theo auth.uid(); giá trị gửi lên từ đây bị bỏ. Vẫn phải điền
 * sender_role/sender_side cho ĐỦ KIỂU Insert mà bộ sinh kiểu yêu cầu — chúng là NOT NULL trong
 * lược đồ, bộ sinh kiểu không biết có trigger.
 */
export async function sendMessage(_prev: SendState, formData: FormData): Promise<SendState> {
  const me = await requireRole([...VAI_DUOC_VAO]);
  const threadId = String(formData.get('thread_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const value = body;

  if (!threadId) return {ok: false, error: 'Thiếu cuộc trao đổi.', value};
  if (!body)
    return {ok: false, fieldError: 'body', error: 'Hãy nhập nội dung tin nhắn.', value};
  if (body.length > GIOI_HAN_KY_TU)
    return {
      ok: false,
      fieldError: 'body',
      error: `Tin nhắn dài ${body.length} ký tự, quá mức cho phép (${GIOI_HAN_KY_TU}). Bạn tách làm hai tin giúp nhé.`,
      value,
    };

  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn / cuộc không còn" với "đã gửi xong" — không báo thành công giả.
  const {data, error} = await supabase
    .from('parent_teacher_messages')
    .insert({
      thread_id: threadId,
      body,
      sender_role: me.role,
      sender_side: me.role === 'parent' ? 'parent' : 'school',
    })
    .select('id');

  if (error) {
    // 42501 ở ĐÚNG bảng này gần như chỉ có một nguyên nhân thật: pt_can_write_thread() trả false,
    // tức em đó không còn ghi danh hoạt động ở lớp của cuộc này. 0065 cố ý để quyền ĐỌC rộng hơn
    // quyền GHI đúng một bậc, nên cuộc tự "đóng băng" khi em chuyển lớp. Câu chung chung của
    // friendlyError ("Bạn không có quyền…") không nói được điều đó, mà đây lại là thứ người dùng
    // cần hiểu ngay để khỏi bấm lại mười lần.
    const msg =
      error.code === '42501'
        ? 'Không gửi được: cuộc trao đổi này đã khoá vì em không còn học lớp đó nữa. Hai bên vẫn xem lại được toàn bộ nội dung cũ.'
        : loi(friendlyError(error));
    return {ok: false, error: msg, value};
  }
  if (!data || data.length === 0)
    return {
      ok: false,
      error: 'Không gửi được — cuộc trao đổi không còn hiệu lực, hoặc bạn không còn quyền nhắn ở đây.',
      value,
    };

  revalidatePath('/[locale]/inbox', 'page');
  return {ok: true, message: 'Đã gửi'};
}

/**
 * Mở một cuộc trao đổi mới về một học sinh.
 *
 * Client CHỈ truyền học sinh, KHÔNG truyền lớp: RPC pt_open_thread tự tra lớp đang học từ
 * enrollments (và câu tra đó vẫn đi qua RLS của người gọi). Nhờ vậy không có đường nào dựng một
 * cuộc trỏ sang lớp lạ rồi nhắn vào đó.
 *
 * Hàm này dùng chung cho cả hai bên: phụ huynh mở cuộc về con mình, GVCN mở cuộc với gia đình
 * một em trong lớp. 0065 cho phép cả hai, và WITH CHECK của bảng vẫn là chốt chặn cuối.
 */
export async function openThread(formData: FormData) {
  await requireRole([...VAI_DUOC_VAO]);
  const studentId = String(formData.get('student_id') ?? '');
  if (!studentId) inboxFlash(null, 'Chưa chọn học sinh');

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('pt_open_thread', {p_student: studentId});
  revalidatePath('/[locale]/inbox', 'page');
  if (error) inboxFlash(null, loi(friendlyError(error)));
  if (!data)
    inboxFlash(null, 'Không mở được cuộc trao đổi. Em này có thể chưa thuộc lớp nào đang hoạt động.');

  // Vào thẳng cuộc vừa mở: mở xong mà còn phải tự tìm trong danh sách thì thừa một bước.
  inboxFlash(data, 'Đã mở cuộc trao đổi — bạn viết lời đầu tiên nhé');
}
