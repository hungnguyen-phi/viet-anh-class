'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Plus} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {datCamKetLop, type CamKetLopState} from '@/app/[locale]/(dashboard)/wig/actions';

// ĐẶT CAM KẾT CỦA LỚP — ngay trên trang WIG, tuần nào cũng được (chưa chốt).
// Chưa có cam kết nào thì form mở sẵn; có rồi thì gấp sau nút "+ Thêm cam kết" (như bên em).
export function DatCamKetLop({
  classId,
  weekStart,
  daCo,
  namHienCo,
}: {
  classId: string;
  weekStart: string;
  daCo: number;
  namHienCo: {id: string; title: string}[];
}) {
  const t = useTranslations('meeting');
  const tw = useTranslations('wig');
  const tg = useTranslations('goal');
  const [state, formAction] = useActionState<CamKetLopState, FormData>(datCamKetLop, {ok: false});
  const [mo, setMo] = useState(daCo === 0);
  // Ô chữ phải do state giữ: React dọn trắng form sau MỖI lần gửi, kể cả khi máy chủ trả lỗi —
  // để ô không kiểm soát thì gõ xong, nhận một câu lỗi, và thấy chữ mình vừa gõ biến mất.
  const [oTitle, setOTitle] = useState('');
  useEffect(() => {
    // Dọn tay khi lưu xong: khối này chỉ bị ẩn chứ không gỡ khỏi cây, nên state sống tiếp —
    // không dọn thì lần mở sau còn nguyên câu cam kết của tuần trước.
    if (state.ok) { setMo(false); setOTitle(''); }
  }, [state.ok]);
  if (daCo >= 2 || namHienCo.length === 0) return null;
  if (!mo)
    return (
      <button type="button" onClick={() => setMo(true)} className={`${btnGhost} w-fit`}>
        <Plus size={13} strokeWidth={2.6} />
        {t('addCommitment')}
      </button>
    );
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[14px] border-[1.5px] border-navy/10 p-3">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="week_start" value={weekStart} />
      <div className="grid gap-2.5 sm:grid-cols-[1.2fr_2fr]">
        {namHienCo.length === 1 ? (
          <input type="hidden" name="wig_id" value={namHienCo[0].id} />
        ) : (
          <Field label={tw('parentYear')} htmlFor="dckl-wig" error={state.fieldError === 'wig_id' ? state.error : null}>
            <select id="dckl-wig" name="wig_id" defaultValue={namHienCo[0]?.id} className={selectCls}>
              {namHienCo.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={daCo === 0 ? t('commitmentOne') : t('commitmentNo', {n: daCo + 1})} htmlFor="dckl-title" error={state.fieldError === 'title' ? state.error : null}>
          <input id="dckl-title" name="title" maxLength={160} value={oTitle} onChange={(e) => setOTitle(e.target.value)} placeholder={t('commitmentPlaceholder')} className={ctlWithBorder(state.fieldError === 'title')} />
        </Field>
      </div>
      {state.error && !state.fieldError && (
        <p className="inline-flex items-start gap-1.5 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className={btnGold} wrapClass="contents">
          {tg('save')}
        </SubmitButton>
        {daCo > 0 && (
          <button type="button" onClick={() => setMo(false)} className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline">
            {tg('cancel')}
          </button>
        )}
      </div>
    </form>
  );
}
