'use client';

import {useEffect, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {danhDauDaXem} from '@/app/[locale]/(dashboard)/notifications/actions';

// MỞ TRANG THÔNG BÁO LÀ TẮT SỐ TRÊN CHUÔNG.
//
// Trước 12/08/2026 số chỉ tắt khi bấm đúng nút "Đánh dấu đã đọc hết". Người dùng vào đọc hết rồi
// đi ra, con số vàng vẫn còn — nó thôi mang nghĩa "có cái mới" và thành vết bẩn dính vĩnh viễn.
//
// VÌ SAO LÀ MỘT COMPONENT CLIENT CHỨ KHÔNG PHẢI MỘT DÒNG TRONG SERVER COMPONENT:
// layout (chỗ đếm số) và page dựng SONG SONG. Ghi CSDL trong lúc page render thì layout đã đếm
// xong từ trước, số vẫn hiện cho tới lần chuyển trang sau — tức bấm vào vẫn không tắt, đúng cái
// đang phải sửa. Chạy sau khi trang đã lên, rồi router.refresh() để layout đếm lại, thì tắt ngay.
//
// KHÔNG dựng gì ra màn hình.
export function DaXem({soChuaDoc}: {soChuaDoc: number}) {
  const router = useRouter();
  // React 18+ chạy effect hai lần ở chế độ dev (StrictMode), và mỗi lần là một câu UPDATE. Câu ấy
  // idempotent nên không sai dữ liệu, nhưng vẫn là một vòng mạng thừa cộng một lần refresh thừa.
  const daChay = useRef(false);

  useEffect(() => {
    // Không còn cái nào chưa đọc thì thôi — đừng bắt mỗi lần mở trang phải đi một vòng CSDL và
    // dựng lại cả layout để đổi số 0 thành số 0.
    if (soChuaDoc === 0 || daChay.current) return;
    daChay.current = true;
    void danhDauDaXem().then((r) => {
      if (r?.ok) router.refresh();
    });
  }, [soChuaDoc, router]);

  return null;
}
