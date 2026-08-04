'use client';

import {useSearchParams} from 'next/navigation';
import {FlashToast} from './FlashToast';

// Hộp thông báo sau một thao tác — TỰ ĐỌC địa chỉ, không cần trang truyền gì xuống.
//
// Trước đây mỗi trang phải tự khai `flash?: string` trong searchParams rồi tự viết
// `{flash && <FlashToast message={flash} />}`. Mười bốn trang, mười bốn bản chép tay — và khi
// thêm đường báo HỎNG (?flash_err=) thì phải sửa đủ mười bốn chỗ, sót một chỗ là chỗ đó lặng lẽ
// giữ nguyên hành vi cũ: báo thất bại bằng hộp xanh có dấu tích.
//
// Một component tự đọc thì không có chỗ nào để sót.
export function Flash() {
  const sp = useSearchParams();
  const loi = sp.get('flash_err');
  const ok = sp.get('flash');
  if (loi) return <FlashToast message={loi} kind="err" />;
  if (ok) return <FlashToast message={ok} />;
  return null;
}
