'use client';

import {useEffect} from 'react';

// ════════════════════════════════════════════════════════════════════════════
// CON LĂN CHUỘT KHÔNG ĐƯỢC ĐỔI SỐ TRONG Ô ĐANG NHẬP.
// ════════════════════════════════════════════════════════════════════════════
//
// <input type="number"> khi ĐANG được chọn thì mọi cú lăn chuột đi qua nó đều cộng hoặc trừ giá
// trị. Form ở đây dài hơn màn hình, nên thao tác tự nhiên nhất — gõ số rồi lăn xuống để bấm Lưu —
// lại chính là thao tác sửa số vừa gõ. Chủ dự án gặp đúng cảnh ấy trên form thêm việc: "chỗ mục
// tiêu số tự nhiên nó lag xong nó hiển thị lên 5.1 mà tôi chưa ấn".
//
// Nguy ở chỗ nó ÂM THẦM. Không có gì nhấp nháy, không có câu báo nào, và số mới vẫn hợp lệ nên
// server nhận bình thường. Trên ô mục tiêu thì sai một con số; trên ô ĐIỂM của học sinh
// (ScoreColumnForm, GradeManager) thì là điểm bị sửa mà không ai biết mình vừa sửa.
//
// VÌ SAO MỘT CHỖ CHẶN CHUNG, KHÔNG PHẢI onWheel TRÊN TỪNG Ô:
// app đang có 20 ô số ở 11 file, và hai trong số đó (StudentWigSetup, ClassStudentWigSetup) là
// SERVER COMPONENT — không gắn được hàm xử lý sự kiện, React ném lỗi ngay. Gắn tay từng ô nghĩa
// là 18 chỗ được che, 2 chỗ hở, và ô số nào viết sau này cũng hở cho tới khi có người nhớ ra.
// Bắt ở giai đoạn CAPTURE trên document thì mọi ô số đều được che, kể cả ô chưa tồn tại.
//
// Chỉ chặn khi ô số ĐANG được chọn — đúng điều kiện sinh ra hành vi ấy. Trang vẫn cuộn như
// thường, và phím mũi tên vẫn tăng giảm được: người muốn đổi số bằng bàn phím thì không bị cản.
export function KhoaLanChuotTrenSo() {
  useEffect(() => {
    const chan = (e: WheelEvent) => {
      const el = document.activeElement as HTMLInputElement | null;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'number') return;
      if (e.target !== el) return; // lăn ở chỗ khác trên trang thì kệ, trang cứ cuộn
      // preventDefault chặn cả việc đổi số LẪN việc cuộn tại chỗ đó, nên phải tự cuộn thay:
      // không thì con lăn "chết" khi con trỏ đi ngang ô số, đọc thành trang bị treo.
      e.preventDefault();
      window.scrollBy({top: e.deltaY, behavior: 'instant' as ScrollBehavior});
    };
    // capture + passive:false — passive mặc định của sự kiện wheel là true, mà passive thì
    // preventDefault bị bỏ qua LẶNG LẼ: không lỗi, không cảnh báo, chỉ là không có tác dụng.
    document.addEventListener('wheel', chan, {capture: true, passive: false});
    return () => document.removeEventListener('wheel', chan, {capture: true});
  }, []);
  return null;
}
