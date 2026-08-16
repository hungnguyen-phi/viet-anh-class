'use client';

import {LichVN} from '@/components/ui/LichVN';
export {ngayVN} from '@/lib/dates';

// Ô NGÀY KIỂU VIỆT NAM — từ 16/08/2026 là LỊCH BẤM CHỌN (LichVN), không còn ba ô gõ số.
//
// Chủ dự án: "phải nhập ngày/tháng/năm thay vì có cái lịch rồi chọn không sướng hơn à?". Giữ
// nguyên tên hàm và props (name/value/onChange/nhan) nên ba nơi gọi không đổi; hai hàm taiNgay /
// ghepNgay giữ lại cho chỗ nào còn ghép ngày tay.
//
// (Ghi chú cũ, vẫn đúng về LÝ DO không dùng <input type="date">:)
//
// VÌ SAO KHÔNG DÙNG <input type="date">: thứ tự hiện ra của ô đó chạy theo ngôn ngữ của TRÌNH
// DUYỆT chứ không theo ngôn ngữ của trang. Chrome cài tiếng Anh — mặc định của gần như mọi máy
// ở trường — hiện `mm/dd/yyyy`, và một học sinh lớp 6 đọc "06/30/2027" thì không có cách nào
// biết đó là ngày 30 tháng 6. Dự án đã chốt luật này cho ngày sinh từ lâu (lib/dob.ts); hạn của
// mục tiêu là chỗ thứ hai trẻ con phải tự gõ một cái ngày, nên nó theo cùng luật.
//
// Giá trị gửi đi vẫn là `yyyy-mm-dd` qua một ô ẩn mang đúng `name` cũ — máy chủ không phải đổi gì.

const p2 = (n: number) => String(n).padStart(2, '0');

/** "2027-06-30" → {day:'30', month:'6', year:'2027'} */
export function taiNgay(iso: string): {day: string; month: string; year: string} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return {day: '', month: '', year: ''};
  return {day: String(Number(m[3])), month: String(Number(m[2])), year: m[1]};
}

/** Ba phần → ISO, hoặc '' nếu chưa đủ / không có thật (31/02 là gõ sai, không phải 1/3). */
export function ghepNgay(day: string, month: string, year: string): string {
  const dd = Number(day);
  const mm = Number(month);
  const yy = Number(year);
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return '';
  if (mm < 1 || mm > 12) return '';
  const soNgay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (dd < 1 || dd > soNgay) return '';
  return `${yy}-${p2(mm)}-${p2(dd)}`;
}

export function ONgayVN({
  name,
  value,
  onChange,
  nhan,
  loi = false,
  min,
  max,
}: {
  /** Tên trường gửi lên máy chủ — nhận chuỗi yyyy-mm-dd qua ô ẩn. */
  name: string;
  /** ISO yyyy-mm-dd, hoặc '' khi chưa chọn. */
  value: string;
  onChange: (iso: string) => void;
  /** Nhãn của cả nhóm, cho trình đọc màn hình gọi đúng tên. */
  nhan: string;
  loi?: boolean;
  min?: string;
  max?: string;
  /** @deprecated ba nhãn ô cũ — lịch không còn ba ô, giữ để nơi gọi cũ không vỡ kiểu. */
  chuNgay?: string;
  chuThang?: string;
  chuNam?: string;
}) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <LichVN value={value} onChange={onChange} nhan={nhan} loi={loi} min={min} max={max} />
    </>
  );
}
