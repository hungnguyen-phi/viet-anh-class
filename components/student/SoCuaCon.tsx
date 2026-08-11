'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, BookOpen, CheckCircle2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold} from '@/components/ui/Field';
import {luuSoCuaCon, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';

// SỔ CỦA CON — cuốn sổ THUỘC VỀ HỌC SINH, không phải hồ sơ của giáo viên.
//
// Đó là toàn bộ lý do nó có tác dụng trong Leader in Me, và là chỗ duy nhất trong cả mô hình mà
// người lớn KHÔNG ghi được. Mục tiêu thì cô đặt hộ được; cuốn sổ thì không — một cuốn sổ ai cũng
// viết được thì không còn là sổ của em nữa. Chính sách rls_write_student_reflections (0100) chặn
// ở tầng CSDL, đây chỉ là cửa.
export function SoCuaCon({
  classId,
  banDau,
  laChinhEm,
}: {
  classId: string;
  banDau: string;
  laChinhEm: boolean;
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuSoCuaCon, {ok: false});

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-navy">
          <BookOpen size={16} strokeWidth={2.5} />
          {t('journal')}
        </h2>
        <span className="text-[11.5px] font-semibold text-grey-mid">{t('journalHint')}</span>
      </div>

      {state.error && (
        <p className="mb-2.5 inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mb-2.5 inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      {laChinhEm ? (
        <form action={formAction} className="flex flex-col gap-2.5">
          <input type="hidden" name="class_id" value={classId} />
          <textarea
            name="body"
            rows={3}
            defaultValue={banDau}
            maxLength={2000}
            placeholder={t('journalPlaceholder')}
            className="w-full resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-colors focus:border-navy"
          />
          <div>
            <SubmitButton className={btnGold} wrapClass="contents">
              {t('journalSave')}
            </SubmitButton>
          </div>
        </form>
      ) : banDau ? (
        // Người lớn ĐỌC được — phụ huynh và cô cần thấy em đang nghĩ gì để mà đồng hành. Chỉ là
        // không có ô nhập nào cho họ.
        <p className="whitespace-pre-wrap text-[13px] font-semibold leading-relaxed text-navy">{banDau}</p>
      ) : (
        <p className="text-[12.5px] italic text-grey-mid">{t('journalEmpty')}</p>
      )}
    </section>
  );
}
