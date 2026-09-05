'use client';

// FORM TẠI CHỖ — bọc một server action trả state ({ok, error, message, fieldError}) bằng
// useActionState: bấm là lưu, TRANG ĐỨNG YÊN, lỗi hiện ngay dưới nút, không redirect + flash.
//
// Vì sao: dưới tải, action đi đường redirect trả "Connection closed" → màn lỗi trong khi CSDL đã
// ghi, người dùng bấm lại → trùng (audit 04/09). Với thao tác nhỏ (chấm, ghi số, nối, xoá…) đường
// state là đủ: revalidatePath trong action làm mới số, còn UI chỉ cần biết ok/lỗi.
//
// Hai kiểu dùng:
//   <FormTaiCho action={ghiSoTaiCho}>…hidden + input + <NutGui>…</FormTaiCho>
//   <FormTaiCho action={xoaTaiCho} xacNhan="Xoá thật chứ?" nhanXacNhan="Xoá" nguyHiem>…</FormTaiCho>
// `xacNhan` mở hộp xác nhận (cùng lớp áo với XacNhanForm) trước khi gửi thật.
import {createContext, useActionState, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {danhDauVuaGhi} from '@/components/shell/LamMoiKhiDoi';
import {useTranslations} from 'next-intl';
import {useFormStatus} from 'react-dom';
import {Loader2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';

export type TrangThaiForm = {ok: boolean; message?: string; error?: string; fieldError?: string};
const BAN_DAU: TrangThaiForm = {ok: false};
// Server Component không truyền được hàm (children dạng render-prop) sang client → thẻ server dùng
// <ONhap>/<LoiO> đọc state qua context thay vì `{(state) => …}`.
const NguCanh = createContext<TrangThaiForm>(BAN_DAU);
export const useTrangThaiForm = () => useContext(NguCanh);

export function FormTaiCho({
  action,
  className,
  children,
  onOk,
  anThanhCong = false,
  xacNhan,
  nhanXacNhan,
  nguyHiem = false,
  hd,
}: {
  action: (prev: TrangThaiForm, formData: FormData) => Promise<TrangThaiForm>;
  className?: string;
  /** data-hd trên <form> cho tour hướng dẫn. */
  hd?: string;
  /** Nội dung form; nhận `state` để tự hiện lỗi cạnh ô (fieldError). */
  children: ReactNode | ((state: TrangThaiForm) => ReactNode);
  /** Gọi khi lưu xong — đóng popup, dọn ô… */
  onOk?: (message?: string) => void;
  /** Không hiện dòng "Đã lưu" (khi thẻ tự thay đổi là đủ). */
  anThanhCong?: boolean;
  /** Câu hỏi xác nhận trước khi gửi (thay window.confirm). */
  xacNhan?: string;
  nhanXacNhan?: string;
  nguyHiem?: boolean;
}) {
  const tc = useTranslations('common');
  const [state, formAction] = useActionState(action, BAN_DAU);
  const formRef = useRef<HTMLFormElement>(null);
  const [hoi, setHoi] = useState(false);
  const daXacNhan = useRef(false);
  // Mỗi lần state đổi (kể cả ok lần hai) đều báo lên — dùng số thứ tự thay vì so object.
  const lanOk = useRef(0);
  const [hienOk, setHienOk] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    lanOk.current += 1;
    danhDauVuaGhi(); // LamMoiKhiDoi bỏ qua echo realtime của chính cú ghi này (action đã revalidate)
    onOk?.(state.message);
    if (!anThanhCong) {
      setHienOk(true);
      const h = setTimeout(() => setHienOk(false), 2500);
      return () => clearTimeout(h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (!xacNhan) return;
    if (daXacNhan.current) {
      daXacNhan.current = false;
      return;
    }
    e.preventDefault();
    setHoi(true);
  };
  const dongY = () => {
    setHoi(false);
    daXacNhan.current = true;
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={onSubmit} className={className} data-hd={hd}>
        <NguCanh.Provider value={state}>{typeof children === 'function' ? children(state) : children}</NguCanh.Provider>
        {state.error && !state.fieldError && (
          <p role="alert" className="w-full text-chu-thich font-bold text-status-bad">
            {state.error}
          </p>
        )}
        {hienOk && state.message && (
          <p role="status" className="w-full text-chu-thich font-semibold text-success-dark">
            {state.message}
          </p>
        )}
      </form>
      {hoi && xacNhan && (
        <Popup title={nhanXacNhan ?? tc('xacNhan')} onClose={() => setHoi(false)} width="max-w-[400px]">
          <p className="text-noi-dung font-semibold leading-relaxed text-navy">{xacNhan}</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setHoi(false)}
              className="min-h-[44px] cursor-pointer rounded-[12px] border-[1.5px] border-navy/20 bg-white px-4 text-than font-extrabold text-navy transition-colors hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {tc('thoi')}
            </button>
            <button
              type="button"
              onClick={dongY}
              autoFocus
              className={`min-h-[44px] cursor-pointer rounded-[12px] px-4 text-than font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                nguyHiem ? 'bg-status-bad text-white hover:bg-status-bad/90' : 'bg-navy text-white hover:bg-navy/90'
              }`}
            >
              {nhanXacNhan ?? tc('dongY')}
            </button>
          </div>
        </Popup>
      )}
    </>
  );
}

/** Nút gửi cho FormTaiCho — khoá + xoay khi đang gửi (useFormStatus), vùng chạm ≥ 44 px. */
export function NutGui({
  className,
  children,
  name,
  value,
  label,
  hd,
}: {
  className?: string;
  children: ReactNode;
  name?: string;
  value?: string;
  label?: string;
  /** data-hd cho tour hướng dẫn. */
  hd?: string;
}) {
  const {pending} = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      data-hd={hd}
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      className={`relative inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
    >
      <span className={`inline-flex items-center gap-1.5 ${pending ? 'invisible' : ''}`}>{children}</span>
      {pending && <Loader2 size={16} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />}
    </button>
  );
}

/** Ô nhập cho thẻ server: viền đỏ khi fieldError trùng `name`. as = input | select | textarea. */
export function ONhap({
  as = 'input',
  className = '',
  children,
  ...rest
}: {as?: 'input' | 'select' | 'textarea'; className?: string; children?: ReactNode; name: string} & Record<string, unknown>) {
  const st = useTrangThaiForm();
  const vien = st.fieldError === rest.name ? 'border-status-bad' : 'border-navy/20';
  const cls = `${className} ${vien}`;
  if (as === 'select') return <select className={cls} {...rest}>{children}</select>;
  if (as === 'textarea') return <textarea className={cls} {...rest} />;
  return <input className={cls} {...rest} />;
}

/** Dòng lỗi của một ô (fieldError === ten) — đặt ngay dưới ô trong thẻ server. */
export function LoiO({ten, className = 'w-full text-chu-thich font-bold text-status-bad'}: {ten: string; className?: string}) {
  const st = useTrangThaiForm();
  if (st.fieldError !== ten || !st.error) return null;
  return <p role="alert" className={className}>{st.error}</p>;
}
