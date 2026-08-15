'use client';

import {useEffect, useState} from 'react';
import {useRouter} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/client';

// ════════════════════════════════════════════════════════════════════════════════════════════
// MÀN CỦA EM NGHE PHÒNG HỌP MỞ RA — không phải đợi em tự tải lại trang
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án tả nguyên văn: "khi giáo viên ấn họp, TẤT CẢ MÀN HÌNH CỦA CÁC EM đều hiện phòng họp".
//
// Từ 0130 tới nay chỉ có MỘT nửa của câu ấy chạy: cô bấm thì cơ sở dữ liệu ghi đúng, màn của cô
// đổi đúng, và màn của em cũng hiện đúng lời mời — NHƯNG chỉ sau khi em tải lại trang. Màn của em
// là server component, không ai nghe gì cả; chỉ màn của cô (PhongHop) mới có đăng ký realtime.
//
// Nên ngoài đời nó đọc thành "bấm mà không ăn": cô bấm, ngẩng lên nhìn ba mươi cái điện thoại, và
// không cái nào nhúc nhích. Chính chủ dự án gặp đúng cảnh ấy (15/08/2026).
//
// ĐI QUA postgres_changes, KHÔNG QUA BROADCAST — cùng lý do đã ghi ở 0130 và 0111: kênh broadcast
// của Supabase thì ai đăng nhập cũng vào được nếu đoán trúng tên kênh, mà đây là dữ liệu của trẻ
// con. postgres_changes chạy qua đúng RLS đã dựng.
//
// Nghe rồi làm gì: `router.refresh()`. Không tự dựng lại trạng thái trong trình duyệt — trang này
// tính ra lời mời từ nhiều mảnh (phòng đang mở của tuần nào, em đã bấm tham gia chưa, tuần đã chốt
// chưa), và chép lại phép tính ấy ở phía client là dựng nguồn sự thật thứ hai để rồi lệch nhau.
// Một lượt refresh là server tính lại đúng một lần, bằng đúng mã đang chạy.
export function NghePhongHop({classId}: {classId: string}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    if (!classId) return;
    const kenh = supabase
      .channel(`phong-hop-em-${classId}`)
      .on(
        'postgres_changes',
        // Nghe cả INSERT lẫn UPDATE: lần đầu cô mở phòng của một tuần là INSERT, những lần sau là
        // UPDATE (mo_phong_hop dùng insert … on conflict do update). Nghe thiếu một loại thì buổi
        // họp thứ hai của cùng tuần ấy im lặng.
        {event: '*', schema: 'public', table: 'wig_meetings', filter: `class_id=eq.${classId}`},
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kenh);
    };
  }, [supabase, router, classId]);

  return null;
}
