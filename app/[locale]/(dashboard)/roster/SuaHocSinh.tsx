'use client';

import {useActionState, useEffect, useRef, useState} from 'react';
import {AlertCircle, CheckCircle2, Pencil, X} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {capNhatHocSinh} from './actions';
import {OThongTinHocSinh, baOTuIso, type ThongTinHS} from './OThongTinHocSinh';

// ════════════════════════════════════════════════════════════════════════════
// SỬA THÔNG TIN MỘT EM, NGAY TRÊN DÒNG CỦA EM ẤY.
// ════════════════════════════════════════════════════════════════════════════
//
// Danh sách lớp trước đây chỉ có THÊM và XOÁ. Gõ nhầm một chữ trong tên, hay phụ huynh đổi số
// điện thoại, thì cách duy nhất là xoá em ra rồi ghi danh lại — mà xoá em đã có tài khoản là đụng
// tới điểm danh, WIG, biên bản họp của em ấy. Nên thực tế là không ai sửa, và thông tin sai nằm
// lại vĩnh viễn.
//
// Bảng mở ra tại chỗ chứ không phải một trang riêng: sửa xong nhìn thấy ngay dòng vừa sửa, đúng
// kiểu form "Thêm việc" của WIG. Dùng lại đúng lối bấm-ra-ngoài-thì-đóng của TaoWigMenu.
//
// KHÔNG có ô email. Email là DANH TÍNH — khoá của student_details, của pending_user_grants, và là
// thứ nối em với tài khoản khi em đăng nhập lần đầu. Sửa nó tức là một người khác; đường đúng là
// huỷ lời mời rồi ghi danh lại. Bày ra một ô email sửa được ở đây là mời người ta làm hỏng.
export function SuaHocSinh({
  classId,
  email,
  ten,
  chiTiet,
}: {
  classId: string;
  email: string;
  ten: string;
  chiTiet: {
    full_name: string | null;
    student_code: string | null;
    date_of_birth: string | null;
    parent_phone: string | null;
    note: string | null;
  };
}) {
  const [mo, setMo] = useState(false);
  const hopRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(capNhatHocSinh, {ok: false});

  const banDau = (): ThongTinHS => ({
    full_name: chiTiet.full_name ?? '',
    student_code: chiTiet.student_code ?? '',
    ...baOTuIso(chiTiet.date_of_birth),
    parent_phone: chiTiet.parent_phone ?? '',
    note: chiTiet.note ?? '',
  });
  const [v, setV] = useState<ThongTinHS>(banDau);

  // Mở lại thì nạp lại từ dữ liệu ĐANG có trên trang, không giữ nội dung gõ dở của lần trước:
  // lần trước có thể người ta bấm ra ngoài để BỎ, mở lại mà thấy chữ cũ là tưởng đã lưu rồi.
  useEffect(() => {
    if (mo) setV(banDau());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mo, chiTiet.full_name, chiTiet.student_code, chiTiet.date_of_birth, chiTiet.parent_phone, chiTiet.note]);

  // Lưu xong thì đóng — trang đã revalidate nên dòng bên dưới hiện ngay giá trị mới.
  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state.ok]);

  useEffect(() => {
    if (!mo) return;
    const raNgoai = (e: MouseEvent) => {
      if (hopRef.current && !hopRef.current.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false);
    };
    document.addEventListener('mousedown', raNgoai);
    window.addEventListener('keydown', phim);
    return () => {
      document.removeEventListener('mousedown', raNgoai);
      window.removeEventListener('keydown', phim);
    };
  }, [mo]);

  const idTien = `sua-${email.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div className="relative" ref={hopRef}>
      <button
        type="button"
        onClick={() => setMo((x) => !x)}
        aria-expanded={mo}
        title={`Sửa thông tin ${ten}`}
        className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-navy/20 bg-white text-navy/70 transition-all hover:border-navy hover:text-navy"
      >
        <Pencil size={13} strokeWidth={2.5} />
        <span className="sr-only">Sửa thông tin {ten}</span>
      </button>

      {mo && (
        // right-0 để bảng không tràn khỏi mép phải — nút này nằm ở cột cuối của dòng.
        <div className="absolute right-0 z-30 mt-1.5 w-[300px] rounded-[16px] border-[1.5px] border-gold/60 bg-white p-3 shadow-[0_18px_40px_rgba(11,31,59,0.18)]">
          <div className="mb-2 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[13.5px] font-bold text-navy">Sửa thông tin học sinh</h2>
              {/* Email hiện ra nhưng KHÔNG sửa được — người dùng phải biết mình đang sửa hồ sơ của ai. */}
              <p className="truncate text-[11.5px] font-semibold text-grey-mid" title={email}>
                {email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMo(false)}
              aria-label="Đóng"
              className="grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-navy/15 bg-white text-grey-mid transition-all hover:border-navy hover:text-navy"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>

          <form action={formAction} className="grid grid-cols-1 gap-2.5" noValidate>
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="email" value={email} />

            <OThongTinHocSinh
              idTien={idTien}
              v={v}
              setV={setV}
              ghiChuRong={false}
              loiNgaySinh={state.fieldError === 'date_of_birth' ? state.error : null}
            />

            {state.error && !state.fieldError && (
              <p className="inline-flex items-start gap-1.5 text-[12.5px] font-bold text-status-bad">
                <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.error}
              </p>
            )}
            {state.ok && state.message && (
              <p className="inline-flex items-start gap-1.5 text-[12.5px] font-bold text-success-dark">
                <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.message}
              </p>
            )}


            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMo(false)}
                className="cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy"
              >
                Huỷ
              </button>
              <SubmitButton
                className="btn-gold cursor-pointer rounded-[10px] px-3 py-1.5 text-[12.5px] font-extrabold"
                wrapClass="contents"
              >
                Lưu
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
