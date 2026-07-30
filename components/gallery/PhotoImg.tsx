'use client';

import {useState} from 'react';
import {ImageOff} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';

// Một tấm ảnh trong album, đọc qua SIGNED URL của bucket riêng tư 'class-photos'.
//
// VÌ SAO PHẢI LÀ CLIENT COMPONENT chỉ để hiện một thẻ <img>: signed URL CÓ HẠN. 0063 đã cảnh báo
// đúng tình huống này — trang để mở qua đêm rồi cuộn xuống là thấy toàn ảnh vỡ, mà người dùng
// không có cách nào biết phải tải lại trang. Bắt onError rồi gọi router.refresh() một lần: máy chủ
// dựng lại trang, ký lại URL mới, ảnh tự hiện. Chỉ thử LẠI MỘT LẦN — nếu ảnh hỏng thật (tệp mồ
// côi, mất quyền) thì refresh vòng lặp sẽ quay server không dứt.
//
// KHÔNG bọc ảnh trong <a href={signedUrl}>: signed URL là VÉ VÀO CỬA chứ không phải thẻ tên — ai
// cầm được đường dẫn đều xem được ảnh trẻ em cho tới khi hết hạn, kể cả người chưa đăng nhập. Thêm
// một cái link là thêm một nút "sao chép địa chỉ ảnh" ngay trong menu chuột phải.
export function PhotoImg({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const router = useRouter();
  const [daThuLai, setDaThuLai] = useState(false);
  const [hong, setHong] = useState(false);

  if (hong) {
    return (
      <div
        role="img"
        aria-label={`${alt} — không tải được`}
        className={`grid place-items-center bg-navy/[0.06] text-navy/40 ${className}`}
      >
        <ImageOff size={18} strokeWidth={2.2} />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- next/image sẽ cache theo URL, mà URL
       ký lại mỗi lần dựng trang nên bộ tối ưu ảnh chỉ toàn trượt cache và tải lại từ đầu. 0063
       nói rõ: dùng <img> thường cho album. */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => {
        if (daThuLai) {
          setHong(true);
          return;
        }
        setDaThuLai(true);
        router.refresh();
      }}
    />
  );
}
