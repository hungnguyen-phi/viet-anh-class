'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Users2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost} from '@/components/ui/Field';
import {ghepBuddyTuan, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// BẠN ĐỒNG HÀNH — ghép cho tuần tới, ngay trong phòng họp (0104)
// ════════════════════════════════════════════════════════════════════════════
//
// Đứng ở /wig/hop vì đây đúng là lúc cô đang nhìn về TUẦN TỚI (`dich`) — cùng màn với "cam kết
// tuần sau". Nhịp thứ Sáu chỉ là quy ước vận hành: cô họp cuối tuần, tiện tay ghép cặp luôn cho
// tuần sắp tới. App không ép giờ nào — bấm được bất cứ lúc nào, ghép lại thì THAY toàn bộ.
export function BanDongHanh({
  classId,
  weekStart,
  weekLabel,
  capHienCo,
}: {
  classId: string;
  /** Thứ Hai của tuần cần ghép — mặc định là tuần TỚI, không phải tuần đang họp về. */
  weekStart: string;
  weekLabel: string;
  capHienCo: {ten: string; banTen: string}[];
}) {
  const t = useTranslations('meeting');
  const [state, formAction] = useActionState<MucTieuState, FormData>(ghepBuddyTuan, {ok: false});

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-navy">
          <Users2 size={16} strokeWidth={2.5} />
          {t('buddyPairTitle')}
        </h2>
        <span className="text-[11.5px] font-semibold text-grey-mid">{weekLabel}</span>
      </div>

      {capHienCo.length > 0 ? (
        <div className="mb-3 flex flex-col gap-1">
          {capHienCo.map((c) => (
            <p key={c.ten} className="text-[12.5px] font-semibold text-navy">
              {c.ten} <span className="text-grey-mid">↔</span> {c.banTen}
            </p>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-[12.5px] italic text-grey-mid">{t('buddyPairEmpty')}</p>
      )}

      {state.error && <p className="mb-2 text-[12px] font-bold text-status-bad">{state.error}</p>}
      {state.ok && state.message && (
        <p className="mb-2 text-[12px] font-bold text-success-dark">{state.message}</p>
      )}

      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="week_start" value={weekStart} />
        <SubmitButton className={btnGhost} wrapClass="contents">
          {capHienCo.length > 0 ? t('buddyPairRedo') : t('buddyPairGo')}
        </SubmitButton>
      </form>
    </section>
  );
}
