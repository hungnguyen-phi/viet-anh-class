'use client';

// Nút "Đặt mục tiêu cho lớp" trên màn GVCN — mở CHUNG form với màn em, nhưng cap='lop' (gửi BGH
// duyệt). PA2 thiết kế "GVCN gửi mục tiêu lớp → BGH duyệt" nhưng bỏ dở phần tạo; đây là chỗ nối lại.
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {btnGold} from '@/components/ui/Field';
import {FormMucTieu3Buoc, type DonViChon} from '@/components/student/FormMucTieu';

export function NutTaoMucTieuLop({
  classId,
  nhanTheoArea,
  donViList,
  areaPreset,
}: {
  classId: string;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
  /** Lĩnh vực mở sẵn (khi bấm từ một ô lĩnh vực cụ thể). */
  areaPreset?: string;
}) {
  const t = useTranslations('lopMucTieu');
  const router = useRouter();
  const [mo, setMo] = useState(false);
  return (
    <>
      <button type="button" data-kiem="nut-tao-muc-tieu-lop" onClick={() => setMo(true)} className={btnGold}>
        <Plus size={15} strokeWidth={2.8} />
        {t('taoMucTieuLop')}
      </button>
      {mo && (
        <FormMucTieu3Buoc
          studentId=""
          classId={classId}
          laChinhEm={false}
          cap="lop"
          areaPreset={areaPreset}
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
