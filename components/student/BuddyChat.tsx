'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Send, Loader2, Sparkles, ShieldAlert} from 'lucide-react';
import {sendBuddyMessage, type BuddyChatResult} from '@/app/[locale]/(dashboard)/student/actions';

export type BuddyMessage = {id: string; role: string; content: string};

// Chat với Buddy — CHỈ trong buổi họp và CHỈ khi GVCN đã mở (buddy_chat_open).
// Đây là chỗ duy nhất có chữ do học sinh gõ đi ra nhà cung cấp ngoài, nên: có cảnh báo hiển thị,
// GVCN đọc lại được toàn bộ, và số lượt bị giới hạn ở server.
export function BuddyChat({
  meetingId,
  messages,
  turnsLeft,
}: {
  meetingId: string;
  messages: BuddyMessage[];
  turnsLeft: number;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function messageFor(code: BuddyChatResult['error']): string {
    switch (code) {
      case 'closed':
        return t('buddyChatClosed');
      case 'limit':
        return t('buddyChatLimit');
      case 'too_long':
        return t('buddyChatTooLong');
      case 'no_wig':
        return t('buddyErrNoWig');
      case 'no_key':
        return t('buddyErrNoKey');
      default:
        return t('buddyErrGeneric');
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr(null);
    const res = await sendBuddyMessage(meetingId, body);
    setBusy(false);
    if (res.ok) {
      setText('');
      router.refresh();
      return;
    }
    setErr(messageFor(res.error));
  }

  return (
    <div className="mt-3 rounded-[14px] border-[1.5px] border-navy/12 bg-white/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-gold-text">
          <Sparkles size={12} strokeWidth={2.5} />
          {t('buddyChatTitle')}
        </span>
        <span className="ml-auto text-[11px] font-bold text-grey-mid">
          {t('buddyChatTurnsLeft', {n: turnsLeft})}
        </span>
      </div>

      <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-semibold text-grey-mid">
        <ShieldAlert size={13} strokeWidth={2.5} className="mt-px shrink-0" />
        {t('buddyChatNotice')}
      </p>

      {messages.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[88%] rounded-[12px] px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-pre-line ${
                m.role === 'user'
                  ? 'self-end bg-navy text-white'
                  : 'self-start border-[1.5px] border-gold/40 bg-gold/[0.09] text-navy'
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      {turnsLeft > 0 && (
        <div className="mt-2.5 flex items-end gap-2">
          <textarea
                aria-label={t('message')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t('buddyChatPlaceholder')}
            className="min-h-[46px] min-w-0 flex-1 resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || text.trim().length === 0}
            className="btn-gold inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-3.5 text-[12.5px] font-extrabold disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2.5} />}
            {t('buddyChatSend')}
          </button>
        </div>
      )}

      {err && (
        <p className="mt-2 rounded-lg bg-status-bad/10 px-3 py-1.5 text-xs font-bold text-status-bad">{err}</p>
      )}
    </div>
  );
}
