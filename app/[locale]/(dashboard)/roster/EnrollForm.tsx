'use client';

import {useActionState, useEffect, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle, Plus} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost} from '@/components/ui/Field';
import {enrollStudent} from './actions';
import {OThongTinHocSinh, THONG_TIN_RONG, type ThongTinHS} from './OThongTinHocSinh';

// Form ghi danh học sinh — validation INLINE (useActionState): lỗi hiện cạnh field,
// giữ nguyên nội dung đã gõ, báo thành công ngay, gửi nhanh bằng Ctrl/⌘+Enter.
//
// Vì sao có 6 trường chứ không chỉ email: ban giám hiệu phản ánh "chỉ có tên học sinh và mail…
// có thể ghi thêm các thông tin khác". Với một ô email thì không phân biệt được hai em trùng
// tên, và tệ hơn là em chưa đăng nhập lần đầu thì không hiện dòng nào trong danh sách. Nay điền
// được ngay lúc ghi danh, kể cả khi em chưa có tài khoản (lưu theo email — xem migration 0058).
//
// Chỉ EMAIL bắt buộc. Năm trường còn lại điền tới đâu thì tới, bổ sung sau vẫn được — và từ nay
// sửa lại được ngay trên từng dòng danh sách (SuaHocSinh), không phải xoá đi ghi danh lại.
//
// Năm ô thông tin nằm trong OThongTinHocSinh, dùng chung với form sửa: hai bản chép tay là hai
// cơ hội trôi khỏi nhau.
export function EnrollForm({classId}: {classId: string}) {
  const t = useTranslations('roster');
  const [state, formAction] = useActionState(enrollStudent, {ok: false});

  // Input controlled → không bị React reset khi submit; giữ nội dung khi có lỗi.
  const [email, setEmail] = useState('');
  const [v, setV] = useState<ThongTinHS>(THONG_TIN_RONG);

  // FORM NÀY MẶC ĐỊNH ĐÓNG (16/08/2026).
  //
  // Chủ dự án: "cái form ghi danh này có thể thu gọn, ẩn, đóng băng khi xong, đừng có hiện trơ
  // trơ ra". Ghi danh là việc làm vài lần đầu năm; để một biểu mẫu sáu ô mở sẵn trên đầu danh
  // sách nghĩa là mỗi ngày ai vào xem lớp cũng phải cuộn qua nó.
  //
  // Xong một em thì GẤP LẠI, không giữ mở: cú gấp ấy chính là câu "đã xong" — rõ hơn một dòng
  // chữ báo thành công nằm dưới một biểu mẫu vẫn còn nguyên đó.
  const [mo, setMo] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setEmail('');
      setV(THONG_TIN_RONG);
      setMo(false);
    }
  }, [state]);

  // Ctrl/⌘+Enter gửi nhanh.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLFormElement).requestSubmit();
    }
  };

  const lbl = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
  const inp =
    'w-full px-3 rounded-[10px] border-[1.5px] bg-white py-2 text-sm font-semibold text-navy outline-none';
  const emailBorder =
    state.fieldError === 'email'
      ? 'border-status-bad focus:border-status-bad'
      : 'border-navy/15 focus:border-navy';

  if (!mo) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMo(true)} className={btnGhost}>
          <Plus size={15} strokeWidth={2.8} />
          {t('enrollOpen')}
        </button>
        {state.ok && state.message && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-success-dark">
            <CheckCircle2 size={14} strokeWidth={2.5} />
            {state.message}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} onKeyDown={onKeyDown} className="glass rounded-[16px] p-3" noValidate>
      <input type="hidden" name="class_id" value={classId} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className={lbl} htmlFor="enroll-email">
            {t('enrollLabel')} <span className="text-status-bad">*</span>
          </label>
          <input
            id="enroll-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hs01@student.truongvietanh.com"
            aria-invalid={state.fieldError === 'email'}
            className={`${inp} ${emailBorder}`}
          />
          {state.fieldError === 'email' && state.error && (
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
              <AlertCircle size={12} strokeWidth={2.5} />
              {state.error}
            </p>
          )}
        </div>

        <OThongTinHocSinh
          idTien="enroll"
          v={v}
          setV={setV}
          loiNgaySinh={state.fieldError === 'date_of_birth' ? state.error : null}
        />

        <div className="flex items-end">
          <SubmitButton
            className="btn-gold h-11 w-full cursor-pointer rounded-[10px] px-4 text-sm font-extrabold"
            wrapClass="contents"
          >
            + {t('enroll')}
          </SubmitButton>
        </div>
      </div>


      <button
        type="button"
        onClick={() => setMo(false)}
        className="mt-2 inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline"
      >
        {t('enrollClose')}
      </button>

      {/* Lỗi chung (không gắn field cụ thể) */}
      {state.error && !state.fieldError && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công inline */}
      {state.ok && state.message && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}
