'use client';

// NÚT + POPUP "MỤC TIÊU CỦA LỚP VÀ TRƯỜNG" (chốt 04/09): hai khu này ít đụng tới hằng ngày nên
// thu vào một popup mở từ đầu trang /wig — trang chính chỉ còn Mục tiêu của tôi + Các em.
// Nội dung do server render sẵn (children); mở lại sau redirect bằng query ?bang=lop.
import {useState} from 'react';
import {Landmark} from 'lucide-react';
import {useRouter, usePathname, useSearchParams} from 'next/navigation';
import {Popup} from '@/components/ui/Popup';

export function PopupLopTruong({
  nhan,
  tieuDe,
  moBanDau = false,
  children,
}: {
  nhan: string;
  tieuDe: string;
  moBanDau?: boolean;
  children: React.ReactNode;
}) {
  const [mo, setMo] = useState(moBanDau);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const dong = () => {
    setMo(false);
    // Rửa ?bang=lop khỏi URL để refresh/back không tự bung lại popup.
    if (sp.get('bang')) {
      const q = new URLSearchParams(sp.toString());
      q.delete('bang');
      router.replace(`${pathname}${q.size ? `?${q}` : ''}`, {scroll: false});
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
      >
        <Landmark size={14} strokeWidth={2.5} />
        {nhan}
      </button>
      {mo && (
        <Popup title={tieuDe} onClose={dong} width="max-w-[760px]">
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">{children}</div>
        </Popup>
      )}
    </>
  );
}
