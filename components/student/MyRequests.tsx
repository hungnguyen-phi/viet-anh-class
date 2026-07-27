import {getTranslations} from 'next-intl/server';
import {Clock3} from 'lucide-react';
import {updateEditRequest, withdrawEditRequest} from '@/app/[locale]/(dashboard)/student/actions';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {kindLabel} from './RequestInbox';

export type MyRequest = {
  id: string;
  kind: string;
  ref_id: string | null;
  message: string | null;
  leadTitle: string | null;
};

// Học sinh (hoặc PH): yêu cầu-sửa CỦA MÌNH đang chờ GVCN. Sửa lời nhắn hoặc rút lại — chỉ khi
// còn 'pending' (RLS er_requester_update/er_requester_delete, 0040). GVCN vẫn là người duyệt
// đổi target; đây chỉ là để không bế tắc khi gửi sai (0035 chỉ cho 1 pending mỗi lead measure).
export async function MyRequests({
  studentId,
  requests,
}: {
  studentId: string;
  requests: MyRequest[];
}) {
  const t = await getTranslations('student');
  if (requests.length === 0) return null;

  return (
    <section className="glass mt-3 rounded-[20px] border border-gold/40 p-[18px]">
      <div className="flex items-center gap-2 font-display text-[15px] font-bold text-navy">
        <Clock3 size={16} strokeWidth={2.5} className="text-gold-deep" />
        {t('myRequests')} ({requests.length})
      </div>
      <p className="mt-1 text-[12px] font-semibold text-grey-mid">{t('requestPendingHint')}</p>
      <div className="mt-3 flex flex-col gap-2">
        {requests.map((r) => (
          <div key={r.id} className="rounded-[12px] border-[1.5px] border-navy/10 bg-white/50 p-2.5">
            <div className="text-[12.5px] font-bold text-navy">
              {kindLabel(t, r.kind)}
              {r.leadTitle && (
                <span className="ml-1.5 font-semibold text-grey-mid">· {r.leadTitle}</span>
              )}
            </div>
            <form action={updateEditRequest} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="student_id" value={studentId} />
              <input type="hidden" name="request_id" value={r.id} />
              <textarea
                name="message"
                rows={2}
                defaultValue={r.message ?? ''}
                placeholder={t('requestEditPlaceholder')}
                className="min-h-[52px] min-w-0 flex-1 resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy"
              />
              <button
                type="submit"
                className="btn-gold h-10 shrink-0 cursor-pointer rounded-[10px] px-4 text-[12.5px] font-extrabold"
              >
                {t('requestSend')}
              </button>
            </form>
            <form action={withdrawEditRequest} className="mt-2">
              <input type="hidden" name="student_id" value={studentId} />
              <input type="hidden" name="request_id" value={r.id} />
              <ConfirmButton
                message={t('requestWithdrawConfirm')}
                className="cursor-pointer rounded-[9px] border-[1.5px] border-[rgba(192,57,43,0.3)] bg-[rgba(192,57,43,0.12)] px-2.5 py-1.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.2)] active:translate-y-px"
              >
                {t('requestWithdraw')}
              </ConfirmButton>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
