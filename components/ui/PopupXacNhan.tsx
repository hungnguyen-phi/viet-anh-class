'use client';

// HỘP XÁC NHẬN dùng chung — thay window.confirm (hộp hệ thống lệch bản sắc, nút OK/Cancel không dịch).
// Dùng bọc quanh một <form action=…>: bấm nút mở hộp → hộp hỏi → "Đồng ý" mới submit form thật.
//
//   <XacNhanForm action={xoaGiDo} hoi={t('xoaHoi')} nhanDongY={t('xoa')} nguyHiem>
//     <input type="hidden" … />
//     <button type="submit">Xóa</button>          ← nút thường; XacNhanForm chặn submit đầu, mở hộp
//   </XacNhanForm>
import {useRef, useState, type FormEvent, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {Popup} from '@/components/ui/Popup';

export function XacNhanForm({
  action,
  hoi,
  nhanDongY,
  nguyHiem = false,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hoi: string;
  nhanDongY?: string;
  nguyHiem?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  const [mo, setMo] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const daXacNhan = useRef(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (daXacNhan.current) {
      daXacNhan.current = false;
      return; // lượt submit thật sau khi bấm Đồng ý
    }
    e.preventDefault();
    setMo(true);
  };

  const dongY = () => {
    setMo(false);
    daXacNhan.current = true;
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={action} onSubmit={onSubmit} className={className}>
        {children}
      </form>
      {mo && (
        <Popup title={nhanDongY ?? t('xacNhan')} onClose={() => setMo(false)} width="max-w-[400px]">
          <p className="text-[14px] font-semibold leading-relaxed text-navy">{hoi}</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setMo(false)}
              className="min-h-[44px] cursor-pointer rounded-[12px] border-[1.5px] border-navy/20 bg-white px-4 text-[13px] font-extrabold text-navy transition-colors hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {t('thoi')}
            </button>
            <button
              type="button"
              onClick={dongY}
              autoFocus
              className={`min-h-[44px] cursor-pointer rounded-[12px] px-4 text-[13px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                nguyHiem ? 'bg-status-bad text-white hover:bg-status-bad/90' : 'bg-navy text-white hover:bg-navy/90'
              }`}
            >
              {nhanDongY ?? t('dongY')}
            </button>
          </div>
        </Popup>
      )}
    </>
  );
}
