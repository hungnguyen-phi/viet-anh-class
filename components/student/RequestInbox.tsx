import {getTranslations} from 'next-intl/server';
import {Inbox} from 'lucide-react';
import {resolveEditRequest} from '@/app/[locale]/(dashboard)/student/yeu-cau-actions';
import {SubmitButton} from '@/components/ui/SubmitButton';

// next-intl NÉM LỖI khi key không tồn tại → map tường minh, mã lạ thì về "việc khác".
const KIND_KEYS = ['undo_tick', 'add_tick', 'change_target', 'rename_lead', 'other'] as const;
export function kindLabel(t: (k: string) => string, kind: string): string {
  return t(`requestKind_${(KIND_KEYS as readonly string[]).includes(kind) ? kind : 'other'}`);
}

export type EditRequest = {
  id: string;
  kind: string;
  ref_id: string | null;
  message: string | null;
  requesterName: string | null;
  createdAt: string;
};

// GVCN/Admin: danh sách yêu cầu-sửa đang chờ của học sinh + Duyệt/Từ chối (idempotent ở server action).
export async function RequestInbox({
  studentId,
  requests,
}: {
  studentId: string;
  requests: EditRequest[];
}) {
  const t = await getTranslations('student');
  if (requests.length === 0) return null;

  const btn =
    'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] px-2.5 text-[11.5px] font-extrabold transition-all';

  return (
    <section className="glass rounded-[20px] border border-gold/40 p-[18px]">
      <div className="flex items-center gap-2 font-display text-[15px] font-bold text-navy">
        <Inbox size={16} strokeWidth={2.5} className="text-gold-deep" />
        {t('requestInbox')} ({requests.length})
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 bg-white/50 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-navy">
                {r.requesterName ?? '—'}
                {/* Nhãn theo loại yêu cầu (0045 có 5 loại). undo_tick tô đỏ vì nó XOÁ dữ liệu. */}
                <span
                  className={`ml-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                    r.kind === 'undo_tick'
                      ? 'bg-status-bad/[0.12] text-status-bad'
                      : 'bg-navy/[0.08] text-navy'
                  }`}
                >
                  {kindLabel(t, r.kind)}
                </span>
              </div>
              {/* Với rename_lead thì message là TÊN MỚI → hiện có mũi tên cho GVCN thấy rõ đang duyệt gì */}
              {r.message && (
                <div className="truncate text-[12px] font-semibold text-grey-mid">
                  {r.kind === 'rename_lead' ? `→ ${r.message}` : r.message}
                </div>
              )}
            </div>
            <span className="flex items-center gap-1.5">
              {/* rename_lead: duyệt là ĐỔI TÊN luôn (message chính là tên mới, 0046).
                  undo_tick vẫn giữ nhánh apply cho các yêu cầu cũ còn tồn trong DB. */}
              {(r.kind === 'rename_lead' || r.kind === 'undo_tick') && r.ref_id && (
                <form action={resolveEditRequest}>
                  <input type="hidden" name="student_id" value={studentId} />
                  <input type="hidden" name="request_id" value={r.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <input type="hidden" name="apply" value="1" />
                  <SubmitButton className={`${btn} btn-gold`}>
                    {r.kind === 'rename_lead' ? t('approveRename') : t('approveApply')}
                  </SubmitButton>
                </form>
              )}
              <form action={resolveEditRequest}>
                <input type="hidden" name="student_id" value={studentId} />
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="decision" value="approved" />
                <SubmitButton className={`${btn} bg-navy text-white hover:bg-navy-700`}>{t('approve')}</SubmitButton>
              </form>
              <form action={resolveEditRequest}>
                <input type="hidden" name="student_id" value={studentId} />
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="decision" value="rejected" />
                <SubmitButton className={`${btn} border-[1.5px] border-navy/20 bg-white text-navy hover:border-navy`}>{t('reject')}</SubmitButton>
              </form>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
