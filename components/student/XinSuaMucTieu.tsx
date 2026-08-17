'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {PencilLine} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold} from '@/components/ui/Field';
import {createEditRequest} from '@/app/[locale]/(dashboard)/student/actions';

// XIN CÔ SỬA / XOÁ MỤC TIÊU NĂM ĐÃ DUYỆT.
//
// Chủ dự án 16/08/2026: "khi cô duyệt rồi thì đóng băng lại, cần sửa thì xin cô duyệt, xóa cũng
// phải xin duyệt". Nút nhỏ, mở một ô chữ: em viết muốn đổi gì / vì sao muốn bỏ — đi vào cùng hộp
// yêu cầu-sửa cô vẫn xử lý (edit_requests, kind 'other', ref_id = mục tiêu).
export function XinSuaMucTieu({studentId, classId, wigId, title}: {studentId: string; classId: string; wigId: string; title: string}) {
  const t = useTranslations('goal');
  const [mo, setMo] = useState(false);
  if (!mo)
    return (
      <button type="button" onClick={() => setMo(true)} className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[12px] font-extrabold text-navy underline">
        <PencilLine size={12} strokeWidth={2.5} />
        {t('askEdit')}
      </button>
    );
  return (
    <form action={createEditRequest} className="flex basis-full flex-col gap-2 rounded-[12px] border-[1.5px] border-navy/10 bg-white p-3">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="kind" value="other" />
      <input type="hidden" name="ref_id" value={wigId} />
      <label htmlFor={`xs-${wigId}`} className="text-[12px] font-extrabold text-navy">
        {t('askEditWhat', {title})}
      </label>
      <textarea
        id={`xs-${wigId}`}
        name="message"
        rows={2}
        required
        maxLength={400}
        placeholder={t('askEditPlaceholder')}
        className="w-full resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy"
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className={btnGold} wrapClass="contents">
          {t('askSend')}
        </SubmitButton>
        <button type="button" onClick={() => setMo(false)} className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline">
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
