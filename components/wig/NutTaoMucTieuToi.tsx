'use client';

// Nút "Đặt mục tiêu của tôi" trên màn GVCN — mở CHUNG form với màn em, cap='em' nhưng
// student_id là CHÍNH thầy cô (0181). Trong form có ô "Hỗ trợ cho" để nối vào mục tiêu lớp:
// luuMucTieu sẽ gọi noi_wig_len_tren (chi_huong + gop_so nếu cùng đơn vị).
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {btnGold} from '@/components/ui/Field';
import {FormMucTieu3Buoc, type DonViChon, type MucTieuLopChon} from '@/components/student/FormMucTieu';

export function NutTaoMucTieuToi({
  teacherId,
  classId,
  nhanTheoArea,
  donViList,
  mucTieuLop,
}: {
  teacherId: string;
  classId: string;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
  mucTieuLop: MucTieuLopChon[];
}) {
  const t = useTranslations('lopMucTieu');
  const router = useRouter();
  const [mo, setMo] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMo(true)} className={btnGold}>
        <Plus size={16} strokeWidth={2.5} />
        {t('taoMucTieuToi')}
      </button>
      {mo && (
        <FormMucTieu3Buoc
          studentId={teacherId}
          classId={classId}
          laChinhEm={false}
          cap="em"
          laToi
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          mucTieuLop={mucTieuLop}
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
