'use client';

// NÚT + POPUP "MỤC TIÊU CỦA LỚP VÀ TRƯỜNG" (chốt 04/09): hai khu này ít đụng tới hằng ngày nên
// thu vào một popup mở từ đầu trang /wig — trang chính chỉ còn Mục tiêu của tôi + Các em.
// Nội dung do server render sẵn (children); mở lại sau redirect bằng query ?bang=lop.
import {useState} from 'react';
import {CalendarDays, Landmark} from 'lucide-react';
import {useRouter, usePathname, useSearchParams} from 'next/navigation';
import {Popup} from '@/components/ui/Popup';

export function PopupLopTruong({
  nhan,
  tieuDe,
  moBanDau = false,
  icon = 'lop',
  giong = 'trang',
  tenBang = 'lop',
  hd,
  children,
}: {
  nhan: string;
  tieuDe: string;
  moBanDau?: boolean;
  /** data-hd cho tour hướng dẫn chỉ vào nút. */
  hd?: string;
  /** Biểu tượng trên nút: 'lop' (toà nhà) hay 'hop' (lịch). */
  icon?: 'lop' | 'hop';
  /** Giọng nút: 'trang' viền navy, 'vang' nền gold — để hai nút cạnh nhau không giống nhau (04/09). */
  giong?: 'trang' | 'vang';
  /** Giá trị ?bang= để mở lại sau redirect (lop | hop). */
  tenBang?: string;
  children: React.ReactNode;
}) {
  const [mo, setMo] = useState(moBanDau);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const dong = () => {
    setMo(false);
    // Rửa ?bang=lop khỏi URL để refresh/back không tự bung lại popup.
    if (sp.get('bang') === tenBang) {
      const q = new URLSearchParams(sp.toString());
      q.delete('bang');
      router.replace(`${pathname}${q.size ? `?${q}` : ''}`, {scroll: false});
    }
  };

  return (
    <>
      <button
        type="button"
        data-hd={hd}
        onClick={() => setMo(true)}
        className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[12px] px-3 text-than font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
          giong === 'vang'
            ? 'bg-gold text-navy shadow-sm hover:brightness-95'
            : 'border-[1.5px] border-navy/20 bg-white text-navy hover:border-navy'
        }`}
      >
        {icon === 'hop' ? <CalendarDays size={14} strokeWidth={2.5} /> : <Landmark size={14} strokeWidth={2.5} />}
        {nhan}
      </button>
      {mo && (
        <Popup title={tieuDe} onClose={dong} width="max-w-[760px]">
          <div className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto pr-1">{children}</div>
        </Popup>
      )}
    </>
  );
}
