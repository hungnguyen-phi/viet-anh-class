'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowRightLeft, X} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {cancelTransfer, requestTransfer} from './actions';

export type LopDich = {id: string; name: string; school_year: string; campus_name: string; gvcn: string | null};
export type DeNghiDangCho = {id: string; toClassName: string};

const nutNho =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const inp =
  'w-full min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';

// DỜI MỘT EM SANG LỚP KHÁC.
//
// Với quản trị viên: bấm là chuyển ngay. Với giáo viên chủ nhiệm: bấm là GỬI ĐỀ NGHỊ, và em vẫn ở
// lớp này cho tới khi lớp bên kia duyệt — nên nút và câu xác nhận phải nói đúng hai chuyện khác
// nhau ấy, không dùng chung một chữ "Chuyển" cho cả hai.
export function TransferControl({
  classId,
  studentId,
  studentName,
  targets,
  pending,
  laAdmin,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  targets: LopDich[];
  /** Đề nghị đang chờ của chính em này, nếu có. */
  pending?: DeNghiDangCho;
  laAdmin: boolean;
}) {
  const t = useTranslations('roster');
  const [mo, setMo] = useState(false);
  const [toClassId, setToClassId] = useState('');

  // Đang chờ duyệt: KHÔNG bày nút dời nữa (một em chỉ có một đề nghị), chỉ hiện đang chờ ai và cho
  // rút lại. Bày cả hai là mời người ta bấm một cái sẽ báo lỗi.
  if (pending) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-warn/[0.14] px-2 py-0.5 text-[10.5px] font-extrabold text-navy">
          {t('transferWaiting', {class: pending.toClassName})}
        </span>
        <form action={cancelTransfer}>
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="requestId" value={pending.id} />
          <SubmitButton className={nutNho} wrapClass="contents" label={t('transferCancelFor', {name: studentName})}>
            {t('transferCancel')}
          </SubmitButton>
        </form>
      </span>
    );
  }

  if (!mo) {
    return (
      <button type="button" onClick={() => setMo(true)} className={nutNho} title={t('transferTitle')}>
        <ArrowRightLeft size={12} strokeWidth={2.6} />
        {t('transfer')}
      </button>
    );
  }

  return (
    <form action={requestTransfer} className="flex w-full flex-wrap items-end gap-1.5">
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="studentId" value={studentId} />
      <label className="min-w-[180px] flex-1">
        <span className="mb-0.5 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
          {t('transferTo')}
        </span>
        <select
          name="toClassId"
          required
          value={toClassId}
          onChange={(e) => setToClassId(e.target.value)}
          aria-label={t('transferToFor', {name: studentName})}
          className={`cursor-pointer ${inp}`}
        >
          <option value="" disabled>
            {t('transferPick')}
          </option>
          {targets
            .filter((c) => c.id !== classId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.school_year}
                {c.gvcn ? ` · ${c.gvcn}` : ''}
              </option>
            ))}
        </select>
      </label>
      <input
        name="note"
        placeholder={t('transferNote')}
        aria-label={t('transferNote')}
        className={`${inp} min-w-[140px] flex-1`}
      />
      {/* Quản trị chuyển thẳng nên phải hỏi lại: không có ai duyệt để chặn nhầm lẫn.
          Giáo viên chỉ gửi đề nghị — chưa có gì xảy ra với em, nên không cần hỏi. */}
      {laAdmin ? (
        <ConfirmButton
          message={t('transferConfirmAdmin', {name: studentName})}
          className={`${nutNho} border-navy bg-navy text-white hover:brightness-110`}
          label={t('transferSubmitFor', {name: studentName})}
        >
          {t('transferMoveNow')}
        </ConfirmButton>
      ) : (
        <SubmitButton
          className={`${nutNho} border-navy bg-navy text-white hover:brightness-110`}
          wrapClass="contents"
          label={t('transferSubmitFor', {name: studentName})}
        >
          {t('transferSend')}
        </SubmitButton>
      )}
      <button type="button" onClick={() => setMo(false)} className={nutNho} aria-label={t('transferClose')}>
        <X size={12} strokeWidth={2.6} />
      </button>
    </form>
  );
}
