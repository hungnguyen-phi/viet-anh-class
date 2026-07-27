'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {PencilLine} from 'lucide-react';
import {createEditRequest} from '@/app/[locale]/(dashboard)/student/actions';

// CHỈ CÒN MỘT LOẠI yêu cầu (0046): xin đổi tên lead measure.
//
// Vì sao rút xuống 1: 0046 cho học sinh tự tick / gỡ tick / tick bù cả tuần, nên undo_tick và
// add_tick thành vô nghĩa. change_target thì mục tiêu là cam kết chốt trong buổi họp WIG, sửa ở
// đó chứ không qua đơn từ. Còn tên việc là thứ em muốn viết cho khớp việc thật của mình
// ("Buổi học / tutor" → "Buổi tutor Toán") mà lead_measures chỉ có lm_manage nên tự sửa không được.
//
// `message` chính là TÊN MỚI — không phải ghi chú tự do. Nhờ vậy GVCN bấm duyệt là áp được luôn,
// không phải đọc văn xuôi rồi tự gõ lại.
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
  const [leadId, setLeadId] = useState(leads[0]?.id ?? '');
  const [newTitle, setNewTitle] = useState('');

  // Không có lead measure nào thì không có gì để đổi tên → không hiện nút.
  if (leads.length === 0) return null;

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
          <input type="hidden" name="kind" value="rename_lead" />
          <input type="hidden" name="ref_id" value={leadId} />

          <div className="text-[12px] font-extrabold text-navy">{t('requestRenameTitle')}</div>

          <div className="flex flex-wrap gap-2">
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

            <label className="min-w-[170px] flex-1">
              <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('requestNewName')}
              </span>
              {/* name="message" vì cột message CHÍNH LÀ tên mới (0046) → GVCN duyệt là áp thẳng */}
              <input
                name="message"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                maxLength={200}
                placeholder={t('requestPh_rename_lead')}
                className={`${selectCls} w-full`}
              />
            </label>
          </div>

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
