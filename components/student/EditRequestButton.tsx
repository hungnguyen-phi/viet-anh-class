'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {PencilLine} from 'lucide-react';
import {createEditRequest} from '@/app/[locale]/(dashboard)/student/actions';

// 5 loại yêu cầu (0045). 'other' không cần chọn việc cụ thể.
const KINDS = ['undo_tick', 'add_tick', 'change_target', 'rename_lead', 'other'] as const;
type Kind = (typeof KINDS)[number];
const NEEDS_LEAD: Kind[] = ['undo_tick', 'add_tick', 'change_target', 'rename_lead'];

// Học sinh (hoặc PH) gửi "Xin sửa" → GVCN duyệt.
// Bản cũ nhồi mọi thứ vào MỘT dropdown nên mỗi dòng lặp lại "Xin gỡ tick: <tên việc>" —
// đọc rất rối và cũng chỉ làm được đúng một loại yêu cầu. Nay tách hai select: LOẠI yêu cầu và
// VIỆC nào, nên tên việc hiện trần, không lặp tiền tố.
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
  const [kind, setKind] = useState<Kind>('undo_tick');
  const [leadId, setLeadId] = useState(leads[0]?.id ?? '');

  const needsLead = NEEDS_LEAD.includes(kind) && leads.length > 0;
  // Không chọn được việc (lớp chưa có lead measure tuần này) → gửi dạng 'other' cho khỏi
  // tạo yêu cầu trỏ vào hư không.
  const effectiveKind: Kind = NEEDS_LEAD.includes(kind) && leads.length === 0 ? 'other' : kind;

  const selectCls =
    'cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy';

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
        <form action={createEditRequest} className="glass flex flex-col gap-2 rounded-[16px] p-3.5">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="kind" value={effectiveKind} />
          <input type="hidden" name="ref_id" value={needsLead ? leadId : ''} />

          <div className="text-[12px] font-extrabold text-navy">{t('requestEditTitle')}</div>

          <div className="flex flex-wrap gap-2">
            <label className="min-w-[150px] flex-1">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('requestKind')}
              </span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className={`${selectCls} w-full`}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`requestKind_${k}`)}
                  </option>
                ))}
              </select>
            </label>

            {needsLead && (
              <label className="min-w-[170px] flex-1">
                <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                  {t('requestWhich')}
                </span>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className={`${selectCls} w-full`}
                >
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <textarea
            name="message"
            rows={2}
            placeholder={
              kind === 'add_tick'
                ? t('requestPh_add_tick')
                : kind === 'rename_lead'
                  ? t('requestPh_rename_lead')
                  : kind === 'change_target'
                    ? t('requestPh_change_target')
                    : t('requestEditPlaceholder')
            }
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
