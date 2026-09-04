'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';

// BA MỤC, MỘT THANH CHỌN — thay cho một cột thẻ trôi tuột từ trên xuống dưới.
//
// Chủ dự án 16/08/2026: "giao diện đúng chỉ có các khối trôi tuột từ trên xuống dưới mà không có
// sắp xếp bố cục nào khác". Trang quản trị gom mười thứ khác hẳn nhau về nhịp dùng: người dùng
// (mỗi ngày), cơ cấu trường (đầu năm), cài đặt (vài lần một năm). Trước đây tất cả xếp dọc, và thứ
// dùng mỗi ngày phải chen giữa những thứ dùng mỗi năm.
//
// Ba mảnh đều được dựng sẵn từ máy chủ và cùng chảy về (mỗi mảnh vẫn có Suspense riêng ở trang);
// đổi mục chỉ ẩn/hiện, không tải lại — nên bấm là thấy ngay, và trạng thái đang mở bên trong
// (cây cơ sở đang bung, ô tìm đang gõ) không mất khi qua lại. Mục đang chọn nhớ trong phiên.
type Muc = 'nguoi' | 'truong' | 'khac';
const KHOA_NHO = 'admin.muc';

export function MucQuanTri({
  nguoi,
  truong,
  khac,
}: {
  nguoi: ReactNode;
  truong: ReactNode;
  khac: ReactNode;
}) {
  const t = useTranslations('admin');
  const [muc, setMuc] = useState<Muc>('nguoi');

  useEffect(() => {
    const nho = window.sessionStorage.getItem(KHOA_NHO);
    if (nho === 'nguoi' || nho === 'truong' || nho === 'khac') setMuc(nho);
  }, []);
  const chon = (m: Muc) => {
    setMuc(m);
    window.sessionStorage.setItem(KHOA_NHO, m);
  };

  const MUC: {key: Muc; nhan: string}[] = [
    {key: 'nguoi', nhan: t('mucNguoi')},
    {key: 'truong', nhan: t('mucTruong')},
    {key: 'khac', nhan: t('mucKhac')},
  ];

  return (
    <>
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {MUC.map((m) => {
          const on = m.key === muc;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => chon(m.key)}
              className={`inline-flex h-11 cursor-pointer items-center rounded-full px-4 text-[13px] font-extrabold transition-all ${
                on
                  ? 'bg-navy text-white'
                  : 'border-[1.5px] border-navy/15 bg-white/60 text-navy hover:border-navy'
              }`}
            >
              {m.nhan}
            </button>
          );
        })}
      </div>
      {/* Không dùng thuộc tính hidden: lớp `flex` của Tailwind thắng display:none của trình duyệt. */}
      <div role="tabpanel" className={muc === 'nguoi' ? 'flex flex-col gap-4' : 'hidden'}>
        {nguoi}
      </div>
      <div role="tabpanel" className={muc === 'truong' ? 'flex flex-col gap-4' : 'hidden'}>
        {truong}
      </div>
      <div role="tabpanel" className={muc === 'khac' ? 'flex flex-col gap-4' : 'hidden'}>
        {khac}
      </div>
    </>
  );
}
