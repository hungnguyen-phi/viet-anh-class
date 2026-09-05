'use client';

// Bút chì SỬA mục tiêu CỦA CHÍNH thầy cô (05/09/2026). Trước đây thẻ "Mục tiêu của tôi" không
// có đường sửa/xoá — gõ sai tên hay đặt thử là kẹt luôn. Mở lại đúng form 3 bước với dangSua,
// laToi; trong hộp Sửa có nút Xoá (RLS quyết: chỉ chủ mục tiêu).
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Pencil} from 'lucide-react';
import {FormMucTieu3Buoc, type DonViChon, type DangSuaMt} from '@/components/student/FormMucTieu';
import type {MucTieuV} from '@/components/wig/kieu-wig';

export function SuaMucTieuToi({
  goal,
  teacherId,
  classId,
  nhanTheoArea,
  donViList,
}: {
  /** Hàng muc_tieu_v rút gọn (MT_COLS) — đủ các cột form Sửa cần; cast như wig/page.tsx vẫn làm. */
  goal: MucTieuV;
  teacherId: string;
  classId: string;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
}) {
  const t = useTranslations('mucTieu');
  const router = useRouter();
  const [sua, setSua] = useState(false);
  return (
    <>
      <button
        type="button"
        data-hd="gv-sua"
        onClick={() => setSua(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-navy transition-colors hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>
      {sua && (
        <FormMucTieu3Buoc
          studentId={teacherId}
          classId={classId}
          laChinhEm={false}
          cap="em"
          laToi
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          dangSua={goal as unknown as DangSuaMt}
          onClose={() => setSua(false)}
          onDone={() => {
            setSua(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
