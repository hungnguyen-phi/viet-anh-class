'use client';

import {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// Ô CHỌN CÓ KHUNG THẤP, CUỘN ĐƯỢC
// ════════════════════════════════════════════════════════════════════════════
//
// Vì sao không dùng <select>: chiều cao danh sách bung ra của <select> do TRÌNH DUYỆT quyết định,
// CSS không với tới. Mười bốn đơn vị thì Chrome bung một cột dài gần hết màn hình.
// Chủ dự án 13/08/2026: "cái khung chứa dropdown ngắn lại, kéo nhiều hơn cũng được, chứ không
// phải bỏ bớt đơn vị gợi ý" — muốn thế thì phải tự dựng.
//
// Đổi lại phải tự làm những thứ <select> cho không: bàn phím, bấm ra ngoài, Esc, và một ô ẩn mang
// giá trị cho form. Làm đủ ở đây một lần để mọi chỗ dùng lại, đừng chép.
//
// Hàng cao 44px — cùng chuẩn chạm với mọi điều khiển khác (ctl-h, xem components/ui/Field.tsx).

export type MucChon = {ma: string; nhan?: string};

export function ChonCuon({
  id,
  name,
  value,
  onChange,
  danhSach,
  chuaChon,
  loi,
  cuoiDanhSach,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  danhSach: MucChon[];
  /** Chữ hiện khi chưa chọn gì. */
  chuaChon: string;
  loi?: boolean;
  /** Một mục thêm ở cuối, vd "Khác…". Trả về mã riêng để nơi gọi tự xử. */
  cuoiDanhSach?: {ma: string; nhan: string};
}) {
  const [mo, setMo] = useState(false);
  const [conTro, setConTro] = useState(-1);
  const hop = useRef<HTMLDivElement>(null);

  const muc = cuoiDanhSach ? [...danhSach, {ma: cuoiDanhSach.ma, nhan: cuoiDanhSach.nhan}] : danhSach;
  const dangChon = danhSach.find((m) => m.ma === value) ?? null;

  // Bấm ra ngoài hoặc Esc thì đóng. Không bẫy focus: đây không phải hộp thoại, nó chỉ là một danh
  // sách bung ra — bẫy focus ở đây làm người dùng kẹt lại trong một thứ họ chỉ muốn liếc rồi bỏ.
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (hop.current && !hop.current.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false);
    };
    document.addEventListener('mousedown', ngoai);
    document.addEventListener('keydown', phim);
    return () => {
      document.removeEventListener('mousedown', ngoai);
      document.removeEventListener('keydown', phim);
    };
  }, [mo]);

  const chon = (ma: string) => {
    onChange(ma);
    setMo(false);
  };

  return (
    <div ref={hop} className="relative">
      {/* Giá trị đi theo form qua ô ẩn — nơi gọi không phải tự dựng thêm gì. */}
      <input type="hidden" name={name} value={value} />

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={mo}
        onClick={() => {
          setMo((x) => !x);
          setConTro(muc.findIndex((m) => m.ma === value));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            if (!mo) setMo(true);
            else setConTro((i) => Math.min(i + 1, muc.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setConTro((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && mo && conTro >= 0) {
            e.preventDefault();
            chon(muc[conTro].ma);
          }
        }}
        className={`ctl-h flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-[12px] border-[1.5px] bg-white px-3 text-sm font-semibold text-navy transition-colors ${
          loi ? 'border-status-bad' : 'border-navy/15 focus:border-navy'
        }`}
      >
        <span className={`min-w-0 flex-1 truncate text-left ${dangChon ? '' : 'text-grey-mid'}`}>
          {dangChon ? dangChon.nhan ?? dangChon.ma : chuaChon}
        </span>
        <ChevronDown size={16} strokeWidth={2.5} className="shrink-0 text-grey-mid" />
      </button>

      {mo && (
        // KHUNG THẤP, CUỘN. 216px ≈ bốn hàng rưỡi — đủ để thấy còn nữa mà cuộn, không phủ hết form.
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-[216px] w-full overflow-y-auto rounded-[12px] bg-white py-1 shadow-pop ring-1 ring-navy/10"
        >
          {muc.map((m, i) => (
            <button
              key={m.ma}
              type="button"
              role="option"
              aria-selected={m.ma === value}
              onClick={() => chon(m.ma)}
              onMouseEnter={() => setConTro(i)}
              className={`flex h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm font-semibold transition-colors ${
                i === conTro ? 'bg-navy/[0.06]' : ''
              } ${m.ma === value ? 'text-navy' : 'text-navy/80'}`}
            >
              <span className="min-w-0 flex-1 truncate">{m.nhan ?? m.ma}</span>
              {m.ma === value && <Check size={14} strokeWidth={2.5} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
