'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {PencilLine} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold} from '@/components/ui/Field';
import {Popup} from '@/components/ui/Popup';
import {createEditRequest, withdrawEditRequest} from '@/app/[locale]/(dashboard)/student/actions';

// XIN THẦY CÔ SỬA / XOÁ MỤC TIÊU NĂM ĐÃ DUYỆT.
//
// Chủ dự án 16/08/2026: "khi cô duyệt rồi thì đóng băng lại, cần sửa thì xin cô duyệt, xóa cũng
// phải xin duyệt". Sửa lại 19/08/2026 theo hai góp ý:
//   1. "bỏ chữ xin sửa, chỉ còn 1 cái bút nhỏ ở góc" — nút thu về MỘT cái bút treo góc thẻ,
//      không chiếm một dòng riêng; tên thật vẫn có cho trình đọc màn hình (aria-label).
//   2. "xin cho cụ thể hơn, chứ ko phải chỉ 1 lời nhắn là xong, phải đủ thông tin thì gv mới
//      duyệt được" — thay ô chữ tự do bằng form có cấu trúc: XIN SỬA (đích mới / tên mới, kèm
//      lý do) hoặc XIN XOÁ (lý do). createEditRequest ghép các ô thành một câu đọc được trong
//      hộp yêu cầu của thầy cô (edit_requests, kind 'other', ref_id = mục tiêu).
export function XinSuaMucTieu({
  studentId,
  classId,
  wigId,
  title,
  unit,
  targetValue,
  yeuCauCho,
}: {
  studentId: string;
  classId: string;
  wigId: string;
  title: string;
  unit: string;
  targetValue: number;
  /** Yêu cầu sửa/xoá của chính em CÒN CHỜ DUYỆT trên mục tiêu này — có thì bút mở ra đường
      "Thôi xin…" (rút lại, withdrawEditRequest) thay vì form gửi lần hai (20/08/2026). */
  yeuCauCho: {id: string; loai: 'sua' | 'xoa'} | null;
}) {
  const t = useTranslations('goal');
  const [mo, setMo] = useState(false);
  const [loai, setLoai] = useState<'sua' | 'xoa'>('sua');
  const oChu =
    'w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy placeholder:text-grey-mid';

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('askEdit')}
        title={t('askEdit')}
        className="absolute right-2.5 top-2.5 grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy"
      >
        <PencilLine size={14} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('askEditWhat', {title})} onClose={() => setMo(false)} width="max-w-[480px]">
          {yeuCauCho ? (
            // ĐÃ CÓ YÊU CẦU CHỜ DUYỆT → không bày form gửi lần hai (unique index 0035 sẽ nuốt
            // im, em lại tưởng gửi được). Lối duy nhất: THÔI XIN — rút lại rồi muốn thì xin mới.
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-semibold leading-relaxed text-navy">
                {t(yeuCauCho.loai === 'xoa' ? 'reqPendingNoteDelete' : 'reqPendingNoteEdit')}
              </p>
              <form action={withdrawEditRequest} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="student_id" value={studentId} />
                <input type="hidden" name="request_id" value={yeuCauCho.id} />
                <SubmitButton className={btnGold} wrapClass="contents">
                  {t(yeuCauCho.loai === 'xoa' ? 'reqWithdrawDelete' : 'reqWithdrawEdit')}
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setMo(false)}
                  className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline"
                >
                  {t('cancel')}
                </button>
              </form>
            </div>
          ) : (
          <form action={createEditRequest} className="flex flex-col gap-3">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="kind" value="other" />
            <input type="hidden" name="ref_id" value={wigId} />

            {/* SỬA hay XOÁ — hai lối rẽ, chọn trước rồi mới hiện các ô của lối ấy. */}
            <div className="flex items-center gap-2">
              {(['sua', 'xoa'] as const).map((v) => (
                <label
                  key={v}
                  className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[12.5px] font-extrabold ${
                    loai === v
                      ? v === 'xoa'
                        ? 'border-status-bad bg-status-bad/[0.08] text-status-bad'
                        : 'border-navy bg-navy/[0.05] text-navy'
                      : 'border-navy/15 text-grey-mid'
                  }`}
                >
                  <input
                    type="radio"
                    name="yeu_cau"
                    value={v}
                    checked={loai === v}
                    onChange={() => setLoai(v)}
                    className="sr-only"
                  />
                  {t(v === 'sua' ? 'reqEdit' : 'reqDelete')}
                </label>
              ))}
            </div>

            {loai === 'sua' && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
                    {t('newTargetLabel', {n: targetValue, unit})}
                  </span>
                  <input type="number" step="any" min="0" name="dich_moi" inputMode="decimal" className={oChu} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
                    {t('newTitleLabel')}
                  </span>
                  <input type="text" name="ten_moi" maxLength={120} className={oChu} />
                </label>
              </>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('whyLabel')}
              </span>
              <textarea
                name="ly_do"
                rows={2}
                required
                maxLength={300}
                // Ví dụ ăn theo ĐÍCH THẬT của mục tiêu (19/08/2026: "1000 lead" mà ví dụ nói
                // "5 bài" là lạc đề) — câu mẫu nhắc đúng con số và đơn vị em đang nhìn.
                placeholder={t('askEditPlaceholder', {n: targetValue, unit})}
                className={`${oChu} resize-y`}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('askSend')}
              </SubmitButton>
              <button
                type="button"
                onClick={() => setMo(false)}
                className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
          )}
        </Popup>
      )}
    </>
  );
}
