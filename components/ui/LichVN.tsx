'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {CalendarDays, ChevronLeft, ChevronRight} from 'lucide-react';
import {ngayVN} from '@/lib/dates';

// LỊCH BẤM CHỌN — kiểu Việt, không phụ thuộc ngôn ngữ trình duyệt.
//
// Chủ dự án 16/08/2026: "bây giờ lại phải nhập ngày/tháng/năm thay vì có cái lịch rồi chọn không
// sướng hơn à?". Đúng. Ba ô gõ số sinh ra để tránh <input type="date"> (nó hiện mm/dd/yyyy trên
// máy cài tiếng Anh — lib/dob.ts), nhưng tránh bằng cách bắt người ta gõ là chữa cái sai này bằng
// cái mệt khác. Lịch này tự vẽ: T2→CN, tháng/năm chọn được, chữ tiếng Việt, hiện dd/mm/yyyy — và
// vẫn trả về ISO 'yyyy-mm-dd' như cũ nên máy chủ không đổi gì.
//
// Không dùng thư viện: một lưới 6×7 và hai <select> — thêm một gói cho việc ấy là thêm 30 KB cho
// mọi lần mở trang trên đường truyền của trường.
const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const THANG = ['Th 1', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'Th 8', 'Th 9', 'Th 10', 'Th 11', 'Th 12'];
const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;

export function LichVN({
  value,
  onChange,
  nhan,
  min,
  max,
  loi = false,
  placeholder = 'Chọn ngày',
  className = '',
}: {
  /** ISO yyyy-mm-dd hoặc '' */
  value: string;
  onChange: (iso: string) => void;
  /** Tên cho trình đọc màn hình. */
  nhan: string;
  /** ISO — ngày sớm nhất / muộn nhất chọn được (kể cả hai đầu). */
  min?: string;
  max?: string;
  loi?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [mo, setMo] = useState(false);
  const goc = useRef<HTMLDivElement>(null);
  const homNay = new Date();
  const [thang, setThang] = useState(() => {
    const m = /^(\d{4})-(\d{2})/.exec(value);
    return m ? {y: Number(m[1]), m: Number(m[2])} : {y: homNay.getFullYear(), m: homNay.getMonth() + 1};
  });

  // Bấm ra ngoài / Esc thì đóng — không có lớp phủ toàn màn, để lịch nằm được trong mọi form.
  useEffect(() => {
    if (!mo) return;
    const ra = (e: MouseEvent) => {
      if (goc.current && !goc.current.contains(e.target as Node)) setMo(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false);
    };
    document.addEventListener('mousedown', ra);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', ra);
      document.removeEventListener('keydown', esc);
    };
  }, [mo]);

  const namMin = min ? Number(min.slice(0, 4)) : homNay.getFullYear() - 30;
  const namMax = max ? Number(max.slice(0, 4)) : homNay.getFullYear() + 5;
  const cacNam: number[] = [];
  for (let y = namMin; y <= namMax; y++) cacNam.push(y);

  // Lưới: ngày đầu tháng rơi vào thứ mấy (T2 = 0), tháng có bao nhiêu ngày.
  const dauThang = new Date(Date.UTC(thang.y, thang.m - 1, 1)).getUTCDay(); // 0=CN
  const lech = (dauThang + 6) % 7;
  const soNgay = new Date(Date.UTC(thang.y, thang.m, 0)).getUTCDate();
  const oLuoi: (number | null)[] = [...Array<null>(lech).fill(null), ...Array.from({length: soNgay}, (_, i) => i + 1)];
  while (oLuoi.length % 7 !== 0) oLuoi.push(null);

  const chonDuoc = (d: string) => (!min || d >= min) && (!max || d <= max);
  const doiThang = (delta: number) => {
    let m = thang.m + delta;
    let y = thang.y;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setThang({y, m});
  };
  const homNayIso = iso(homNay.getFullYear(), homNay.getMonth() + 1, homNay.getDate());

  return (
    <div ref={goc} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mo}
        aria-label={nhan}
        onClick={() => setMo((v) => !v)}
        className={`inline-flex h-11 min-w-[150px] cursor-pointer items-center gap-2 rounded-[10px] border-[1.5px] bg-white px-3 text-[13.5px] font-bold text-navy outline-none transition-colors focus:border-navy ${
          loi ? 'border-status-bad' : 'border-navy/15'
        }`}
      >
        <CalendarDays size={15} strokeWidth={2.4} className="shrink-0 text-grey-mid" />
        {value ? ngayVN(value) : <span className="font-semibold text-grey-soft">{placeholder}</span>}
      </button>

      {mo && (
        <div
          role="dialog"
          aria-labelledby={`${id}-tieu-de`}
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[290px] rounded-[16px] border-[1.5px] border-navy/10 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(38,39,93,0.35)]"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => doiThang(-1)}
              aria-label="Tháng trước"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-[8px] text-navy hover:bg-navy/[0.06]"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <span id={`${id}-tieu-de`} className="sr-only">
              {nhan}
            </span>
            <select
              aria-label="Tháng"
              value={thang.m}
              onChange={(e) => setThang({...thang, m: Number(e.target.value)})}
              className="h-8 flex-1 cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-1.5 text-[12.5px] font-bold text-navy outline-none focus:border-navy"
            >
              {THANG.map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
            <select
              aria-label="Năm"
              value={thang.y}
              onChange={(e) => setThang({...thang, y: Number(e.target.value)})}
              className="h-8 flex-1 cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-1.5 text-[12.5px] font-bold text-navy outline-none focus:border-navy"
            >
              {cacNam.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => doiThang(1)}
              aria-label="Tháng sau"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-[8px] text-navy hover:bg-navy/[0.06]"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {THU.map((t) => (
              <span key={t} className="py-1 text-center text-[10.5px] font-extrabold uppercase text-grey-mid">
                {t}
              </span>
            ))}
            {oLuoi.map((d, i) => {
              if (d === null) return <span key={`o-${i}`} />;
              const isoNgay = iso(thang.y, thang.m, d);
              const chon = isoNgay === value;
              const duoc = chonDuoc(isoNgay);
              return (
                <button
                  key={isoNgay}
                  type="button"
                  disabled={!duoc}
                  aria-pressed={chon}
                  aria-label={ngayVN(isoNgay)}
                  onClick={() => {
                    onChange(isoNgay);
                    setMo(false);
                  }}
                  className={`h-9 rounded-[8px] text-[13px] font-bold tabular-nums transition-colors ${
                    chon
                      ? 'bg-navy text-white'
                      : duoc
                        ? `cursor-pointer text-navy hover:bg-navy/[0.08] ${isoNgay === homNayIso ? 'ring-[1.5px] ring-gold-deep' : ''}`
                        : 'cursor-not-allowed text-grey-soft/60'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
