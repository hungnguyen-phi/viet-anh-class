'use client';

import {useId, useRef, useState, type ChangeEvent} from 'react';
import {inputCls} from '@/components/ui/Field';

// Ô NGÀY KIỂU VIỆT NAM — ngày / tháng / năm, ba ô có nhãn.
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

/** "2027-06-30" → "30/06/2027". Chuỗi rỗng hoặc sai dạng thì trả lại nguyên xi. */
export function ngayVN(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
}

export function ONgayVN({
  name,
  value,
  onChange,
  nhan,
  loi = false,
  chuNgay = 'Ngày',
  chuThang = 'Tháng',
  chuNam = 'Năm',
}: {
  /** Tên trường gửi lên máy chủ — nhận chuỗi yyyy-mm-dd qua ô ẩn. */
  name: string;
  /** ISO yyyy-mm-dd, hoặc '' khi chưa chọn. */
  value: string;
  onChange: (iso: string) => void;
  /** Nhãn của cả nhóm, cho trình đọc màn hình gọi đúng tên từng ô con. */
  nhan: string;
  loi?: boolean;
  chuNgay?: string;
  chuThang?: string;
  chuNam?: string;
}) {
  const id = useId();
  const oThang = useRef<HTMLInputElement>(null);
  const oNam = useRef<HTMLInputElement>(null);
  // BA Ô LÀ NGUỒN THẬT của chữ đang gõ, không phải `value`.
  //
  // `value` chỉ mang ngày ĐÃ ghép được. Nếu ba ô đọc thẳng từ nó thì lúc mới gõ "3" vào ô tháng
  // (chưa thành ngày nào cả) chữ vừa gõ sẽ biến mất ngay dưới tay người đang gõ.
  const [phan, setPhan] = useState(() => taiNgay(value));
  const doi = (k: 'day' | 'month' | 'year') => (e: ChangeEvent<HTMLInputElement>) => {
    const so = e.target.value.replace(/\D/g, '').slice(0, k === 'year' ? 4 : 2);
    const moi = {...phan, [k]: so};
    setPhan(moi);
    // Gõ đủ hai số ngày/tháng thì nhảy sang ô kế — cùng nhịp với ô ngày sinh ở trang hồ sơ.
    if (k === 'day' && so.length === 2) oThang.current?.focus();
    if (k === 'month' && so.length === 2) oNam.current?.focus();
    onChange(ghepNgay(moi.day, moi.month, moi.year));
  };

  const o = `${inputCls} w-full text-center${loi ? ' border-status-bad' : ''}`;
  return (
    <div role="group" aria-labelledby={`${id}-nhan`} className="flex items-center gap-1.5">
      <span id={`${id}-nhan`} className="sr-only">
        {nhan}
      </span>
      <input type="hidden" name={name} value={value} />
      <input
        aria-label={`${nhan} — ${chuNgay}`}
        aria-invalid={loi || undefined}
        inputMode="numeric"
        maxLength={2}
        placeholder={chuNgay}
        value={phan.day}
        onChange={doi('day')}
        className={`${o} max-w-[110px]`}
      />
      <span aria-hidden className="text-sm font-bold text-grey-soft">
        /
      </span>
      <input
        ref={oThang}
        aria-label={`${nhan} — ${chuThang}`}
        aria-invalid={loi || undefined}
        inputMode="numeric"
        maxLength={2}
        placeholder={chuThang}
        value={phan.month}
        onChange={doi('month')}
        className={`${o} max-w-[110px]`}
      />
      <span aria-hidden className="text-sm font-bold text-grey-soft">
        /
      </span>
      <input
        ref={oNam}
        aria-label={`${nhan} — ${chuNam}`}
        aria-invalid={loi || undefined}
        inputMode="numeric"
        maxLength={4}
        placeholder={chuNam}
        value={phan.year}
        onChange={doi('year')}
        className={`${o} max-w-[120px]`}
      />
    </div>
  );
}
