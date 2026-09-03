'use client';

// Nút "Đặt mục tiêu cho trường" (màn /truong, admin/BGH) — mở CHUNG form với màn em/lớp,
// cap='truong' (admin tạo là duyệt luôn — duyet_duoc_chu_the).
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {btnGold} from '@/components/ui/Field';
import {FormMucTieu3Buoc, type DonViChon} from '@/components/student/FormMucTieu';

export function NutTaoMucTieuTruong({
  campusId,
  nhanTheoArea,
  donViList,
}: {
  campusId: string;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
}) {
  const t = useTranslations('truongWig');
  const router = useRouter();
  const [mo, setMo] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMo(true)} className={btnGold}>
        <Plus size={15} strokeWidth={2.8} />
        {t('taoNut')}
      </button>
      {mo && (
        <FormMucTieu3Buoc
          studentId=""
          classId=""
          laChinhEm={false}
          cap="truong"
          campusId={campusId}
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          onClose={() => setMo(false)}
          onDone={() => {
            setMo(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
