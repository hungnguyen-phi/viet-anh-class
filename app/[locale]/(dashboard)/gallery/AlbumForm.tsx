'use client';

import {useTranslations} from 'next-intl';
import {useActionState, useEffect, useState, type KeyboardEvent} from 'react';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, inputCls, btnGold} from '@/components/ui/Field';
import {createAlbum, type AlbumState} from './actions';

// Tạo album mới. `today` tính ở SERVER rồi truyền xuống — client tự new Date() sẽ lệch múi giờ
// (máy chủ UTC vs giờ VN) và gây lệch hydration, đúng bẫy đã gặp ở WigCreateForm.
export function AlbumForm({classId, today}: {classId: string; today: string}) {
  const t = useTranslations('gallery');
  const [state, formAction] = useActionState<AlbumState, FormData>(createAlbum, {ok: false});

  // Input CONTROLLED → React không xoá nội dung khi submit; gõ xong mà lỗi vẫn còn nguyên chữ.
  const [v, setV] = useState({title: '', event_date: today, description: ''});
  const set = (k: keyof typeof v) => (e: {target: {value: string}}) =>
    setV((p) => ({...p, [k]: e.target.value}));

  useEffect(() => {
    if (state.ok) setV({title: '', event_date: today, description: ''});
  }, [state, today]);

  // Ctrl/⌘+Enter gửi nhanh (form nhiều ô) — giống EnrollForm.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  };

  return (
    <form action={formAction} onKeyDown={onKeyDown} className="glass rounded-[16px] p-3" noValidate>
      <input type="hidden" name="class_id" value={classId} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.4fr_auto_1.6fr_auto]">
        <Field
          label={t('fTitle')}
          htmlFor="album-title"
          error={state.fieldError === 'title' ? state.error : null}
        >
          <input
            id="album-title"
            name="title"
            value={v.title}
            onChange={set('title')}
            placeholder={t('phTitle')}
            aria-invalid={state.fieldError === 'title'}
            className={ctlWithBorder(state.fieldError === 'title')}
          />
        </Field>

        {/* <input type="date"> chỉ bị cấm cho NGÀY SINH (thứ tự dd/mm chạy theo ngôn ngữ trình
            duyệt, 09/03 dễ bị hiểu sai). Ngày sự kiện luôn nằm quanh hôm nay và người nhập tự đối
            chiếu được ngay, nên ô lịch của trình duyệt là lựa chọn tốt hơn ba ô rời. */}
        <Field
          label={t('fDate')}
          htmlFor="album-date"
          error={state.fieldError === 'event_date' ? state.error : null}
        >
          <input
            id="album-date"
            name="event_date"
            type="date"
            value={v.event_date}
            onChange={set('event_date')}
            aria-invalid={state.fieldError === 'event_date'}
            className={ctlWithBorder(state.fieldError === 'event_date')}
          />
        </Field>

        <Field label={t('fDesc')} htmlFor="album-desc">
          <input
            id="album-desc"
            name="description"
            value={v.description}
            onChange={set('description')}
            placeholder={t('phDesc')}
            className={inputCls}
          />
        </Field>

        <div className="flex items-end">
          <SubmitButton className={btnGold} wrapClass="contents">
            {t('createAlbum')}
          </SubmitButton>
        </div>
      </div>

      {state.error && !state.fieldError && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-than font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-than font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}

      <p className="mt-2 text-chu-thich italic text-grey-mid">
        {t('dateHint')}
      </p>
    </form>
  );
}
