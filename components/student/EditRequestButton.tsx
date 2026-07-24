'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {PencilLine} from 'lucide-react';
import {createEditRequest} from '@/app/[locale]/(dashboard)/student/actions';

// Học sinh (hoặc PH) gửi "Xin sửa" → GVCN duyệt. Chọn lead cụ thể → GVCN duyệt & gỡ tick 1 chạm.
export function EditRequestButton({
  studentId,
  classId,
  leads,
}: {
  studentId: string;
  classId: string;
  leads: {id: string; title: string}[];
}) {
  const t = useTranslations('student');
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-navy/20 bg-white/60 px-3 py-1.5 text-[12px] font-extrabold text-navy transition-colors hover:border-navy"
        >
          <PencilLine size={13} strokeWidth={2.5} />
          {t('requestEdit')}
        </button>
      ) : (
        <form
          action={createEditRequest}
          className="glass flex flex-col gap-2 rounded-[16px] p-3.5"
        >
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          {/* Chọn lead → kind=undo_tick + ref_id để GVCN duyệt & gỡ tick nhanh; không chọn → other */}
          <input type="hidden" name="kind" value={leadId ? 'undo_tick' : 'other'} />
          <input type="hidden" name="ref_id" value={leadId} />
          <div className="text-[12px] font-extrabold text-navy">{t('requestEditTitle')}</div>
          {leads.length > 0 && (
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy"
            >
              <option value="">{t('requestEditGeneral')}</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {t('requestUndoTick')}: {l.title}
                </option>
              ))}
            </select>
          )}
          <textarea
            name="message"
            rows={2}
            placeholder={t('requestEditPlaceholder')}
            className="min-h-[52px] resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-gold h-10 cursor-pointer rounded-[10px] px-4 text-[12.5px] font-extrabold"
            >
              {t('requestSend')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy hover:border-navy"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
