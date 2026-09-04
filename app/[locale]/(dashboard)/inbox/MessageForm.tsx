'use client';

import {useActionState, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Send} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {GIOI_HAN_KY_TU} from '@/components/inbox/format';
import {sendMessage} from './actions';

const labelCls = 'mb-1 block text-nhan font-extrabold uppercase tracking-wide text-grey-mid';
const areaBase =
  'w-full min-h-[92px] resize-y rounded-[8px] border-[1.5px] bg-white px-3 py-2.5 text-sm font-semibold text-navy outline-none transition-colors';

/**
 * Ô soạn tin.
 *
 * Nội dung là state CÓ KIỂM SOÁT (controlled) — React sẽ không tự xoá khi submit, nên gặp lỗi
 * mạng thì đoạn vừa viết vẫn còn nguyên. Gửi xong mới xoá.
 */
export function MessageForm({threadId, laPhuHuynh}: {threadId: string; laPhuHuynh: boolean}) {
  const t = useTranslations('inbox');
  const [state, formAction] = useActionState(sendMessage, {ok: false});
  const formRef = useRef<HTMLFormElement>(null);
  const [body, setBody] = useState('');

  // Gửi thành công → xoá ô. Server đã revalidate nên tin mới xuất hiện ở trên ngay.
  useEffect(() => {
    if (state.ok) setBody('');
  }, [state]);

  // Ctrl/⌘ + Enter gửi nhanh. KHÔNG dùng Enter trần: đây là ô nhiều dòng, người ta xuống hàng
  // giữa chừng là chuyện thường — Enter mà gửi luôn thì tin đi khi mới viết được nửa câu, mà tin
  // đã gửi thì không rút lại được (bảng không có policy UPDATE/DELETE).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const qua = body.length > GIOI_HAN_KY_TU;
  const coLoi = qua || state.fieldError === 'body';
  const conLai = GIOI_HAN_KY_TU - body.length;

  return (
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={onKeyDown}
      className="glass rounded-[16px] p-3"
      noValidate
    >
      <input type="hidden" name="thread_id" value={threadId} />

      <label className={labelCls} htmlFor="pt-body">
        {laPhuHuynh ? t('composeParent') : t('composeTeacher')}
      </label>
      <textarea
        id="pt-body"
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-invalid={coLoi}
        aria-describedby="pt-body-hint"
        placeholder={
          laPhuHuynh
            ? t('phParent')
            : t('phTeacher')
        }
        className={`${areaBase} ${
          coLoi ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy'
        }`}
      />

      <p id="pt-body-hint" className="mt-1 text-chu-thich font-semibold text-grey-mid">
        {t('sentIsFinal')}{' '}
        <span className={qua ? 'font-extrabold text-status-bad' : undefined}>
          {qua ? t('charsOver', {n: -conLai}) : t('charsLeft', {n: conLai})}
        </span>
      </p>

      {state.error && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-than font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-3">
        <SubmitButton
          className="btn-gold ctl-h inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] px-4 text-than font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-60"
          wrapClass="inline-flex items-center gap-1.5"
        >
          <Send size={14} strokeWidth={2.5} />
          {t('send')}
        </SubmitButton>
        <span className="text-chu-thich font-semibold text-grey-mid">Ctrl/⌘ + Enter</span>
      </div>
    </form>
  );
}
