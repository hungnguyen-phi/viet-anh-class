'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Lock, PencilLine} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost} from '@/components/ui/Field';
import {ghiSoDo} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// SỐ ĐO NGOÀI APP — một ô, một nút, một dòng lịch sử (0108)
// ════════════════════════════════════════════════════════════════════════════
//
// Chỗ này chỉ hiện với mục tiêu `measure_by='manual'`: cân nặng, chiều cao, điểm trung bình môn.
// App không có cách nào đếm chúng, nên tới 0108 thẻ mục tiêu chỉ có đúng một nút "Đánh dấu ĐÃ
// ĐẠT" — một bit cho cả một năm học. Em cao thêm 3cm giữa kỳ thì không chỗ nào ghi, và buổi họp
// WIG không có gì để cầm ngoài câu "chưa đạt".
//
// BA LUẬT, và cả ba đều lộ ra màn hình chứ không nằm im trong mã:
//
//   · Ai cũng ghi được — em ghi, cô ghi, không có bước duyệt. Nên phải NÓI RA ai ghi lần gần nhất.
//     Đây là số TỰ KHAI, không phải phép đo của máy; bày một con số tự khai mà giấu nguồn thì đúng
//     là cái tội §5.0 mà 0101/0107 vừa đi dọn ở chỗ khác.
//   · Mỗi tuần một dòng — ghi lại trong tuần là sửa đè, không đẻ dòng thứ hai.
//   · Lớp họp chốt tuần là khoá. Khoá thật ở RLS; ở đây chỉ nói trước, để em khỏi gõ xong mới bị
//     từ chối.
export function OSoDo({
  wigId,
  unit,
  soHienTai,
  nguoiGhi,
  ghiLuc,
  moKhoa,
  canGhi,
  laCuaLop = false,
}: {
  wigId: string;
  unit: string;
  /** Số của tuần này, null nếu tuần này chưa ai ghi. */
  soHienTai: number | null;
  /** 'student' | 'teacher' — ai ghi con số đang hiện. */
  nguoiGhi: string | null;
  ghiLuc: string | null;
  /** Tuần chưa bị buổi họp chốt. */
  moKhoa: boolean;
  canGhi: boolean;
  /** Mục tiêu của LỚP — đổi chữ, vì "Số của bạn tuần này" là câu nói với học sinh. */
  laCuaLop?: boolean;
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState(ghiSoDo, {ok: false});

  const co = soHienTai !== null;

  // KHÔNG GHI ĐƯỢC (đã chốt, hoặc người đọc là phụ huynh/BGH): chỉ bày con số. Bày một ô nhập rồi
  // để nó báo lỗi khi bấm là mời người ta gõ vào chỗ không nhận.
  if (!canGhi || !moKhoa) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-grey-mid">
        {!moKhoa && <Lock size={12} strokeWidth={2.5} className="shrink-0" />}
        <span>{t('readingNow')}</span>
        <span className="text-[13px] font-extrabold tabular-nums text-navy">
          {co ? `${soHienTai} ${unit}` : '—'}
        </span>
        {co && nguoiGhi && (
          <span className="text-[11px] font-semibold text-grey-mid">
            · {t(nguoiGhi === 'student' ? 'readingByStudent' : 'readingByTeacher')}
            {ghiLuc ? ` ${ghiLuc}` : ''}
          </span>
        )}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="wig_id" value={wigId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`sd-${wigId}`} className="text-[12px] font-bold text-grey-mid">
          {t(laCuaLop ? 'readingAskClass' : 'readingAsk')}
        </label>
        <input
          id={`sd-${wigId}`}
          name="gia_tri"
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          defaultValue={co ? String(soHienTai) : ''}
          className={`h-9 w-[92px] rounded-[10px] border-[1.5px] bg-white px-2.5 text-[13px] font-extrabold tabular-nums text-navy ${
            state.fieldError === 'gia_tri' ? 'border-status-bad' : 'border-navy/20'
          }`}
        />
        <span className="text-[12px] font-bold text-grey-mid">{unit}</span>
        <SubmitButton className={btnGhost} wrapClass="contents">
          <PencilLine size={13} strokeWidth={2.5} />
          {t('readingSave')}
        </SubmitButton>
      </div>

      {/* AI GHI CON SỐ ĐANG HIỆN. Không phải chú thích trang trí: em nhìn thấy 34kg mà không biết
          ai điền thì không biết nên tin hay nên sửa. */}
      {co && nguoiGhi && (
        <p className="text-[11px] font-semibold text-grey-mid">
          {t(nguoiGhi === 'student' ? 'readingByStudent' : 'readingByTeacher')}
          {ghiLuc ? ` ${ghiLuc}` : ''}
        </p>
      )}

      {state.error && (
        <p className="inline-flex items-start gap-1.5 text-[11.5px] font-bold text-status-bad">
          <AlertCircle size={12} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  );
}
