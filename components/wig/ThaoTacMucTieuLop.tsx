'use client';

// Hàng nút dưới mỗi thẻ MỤC TIÊU CỦA LỚP: Sửa (mở lại form 3 cột mốc, cap='lop') · Đóng · Xoá.
// PA2 có form tạo nhưng quên nút sửa/đóng cho mục tiêu lớp — cô lỡ gõ sai thì không chữa được.
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {Pencil} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {FormMucTieu3Buoc, type DonViChon, type DangSuaMt, type BuocChon} from '@/components/student/FormMucTieu';
import {dongMucTieuLop} from '@/app/[locale]/(dashboard)/wig/lop-actions';

export function ThaoTacMucTieuLop({
  goal,
  classId,
  weekQ,
  nhanTheoArea,
  donViList,
  buocDangSua = [],
}: {
  goal: DangSuaMt;
  classId: string;
  weekQ: string;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
  buocDangSua?: BuocChon[];
}) {
  const t = useTranslations('mucTieu');
  const router = useRouter();
  const [sua, setSua] = useState(false);

  return (
    <div className="mt-1.5 flex items-center gap-3 border-t border-navy/[0.06] pt-2">
      {/* Sửa = chỉ icon bút (tinh gọn). Xoá nằm TRONG hộp Sửa, không đặt riêng ở thẻ. */}
      <button
        type="button"
        onClick={() => setSua(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="grid h-7 w-7 cursor-pointer place-items-center rounded-[8px] text-navy transition-colors hover:bg-navy/[0.06]"
      >
        <Pencil size={14} strokeWidth={2.5} />
      </button>

      <form action={dongMucTieuLop}>
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="week" value={weekQ} />
        <input type="hidden" name="muc_tieu_id" value={goal?.id ?? ''} />
        <SubmitButton
          className="inline-flex min-h-[26px] items-center text-[12px] font-extrabold text-grey-mid underline hover:text-navy"
          wrapClass="contents"
        >
          {t('dongNgan')}
        </SubmitButton>
      </form>

      {sua && (
        <FormMucTieu3Buoc
          studentId=""
          classId={classId}
          laChinhEm={false}
          cap="lop"
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          dangSua={goal}
          buocDangSua={buocDangSua}
          onClose={() => setSua(false)}
          onDone={() => {
            setSua(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
