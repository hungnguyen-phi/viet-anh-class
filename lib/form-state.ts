// Kiểu trạng thái chung cho mọi form/nút đi đường useActionState (không redirect).
// ok=true → thành công (message tuỳ chọn); ok=false → error (+ fieldError trỏ đúng ô nếu có).
export type TrangThaiForm = {ok: boolean; message?: string; error?: string; fieldError?: string};
export const FORM_BAN_DAU: TrangThaiForm = {ok: false};
