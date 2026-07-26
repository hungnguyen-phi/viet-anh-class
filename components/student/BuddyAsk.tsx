'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Sparkles, Loader2} from 'lucide-react';
import {askBuddyNote, type BuddyAskResult} from '@/app/[locale]/(dashboard)/student/actions';

// Nút "Hỏi Buddy" — Buddy là LLM (DeepSeek qua OpenRouter), gọi ở server action.
// Có spinner vì gọi LLM mất vài giây; giới hạn 1 lần/ngày nằm ở server (không tin client).
export function BuddyAsk({hasNote}: {hasNote: boolean}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Map mã lỗi → câu tiếng Việt. Dùng switch chứ không t(`buddyErr.${code}`) vì next-intl
  // NÉM LỖI khi key không tồn tại — mã lạ sẽ làm trắng cả trang.
  function messageFor(code: BuddyAskResult['error']): string {
    switch (code) {
      case 'no_wig':
        return t('buddyErrNoWig');
      case 'no_class':
        return t('buddyErrNoClass');
      case 'rate_limited':
        return t('buddyErrRateLimited');
      case 'no_key':
        return t('buddyErrNoKey');
      default:
        return t('buddyErrGeneric');
    }
  }

  async function ask() {
    if (loading) return;
    setLoading(true);
    setErr(null);
    const res = await askBuddyNote();
    setLoading(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    setErr(messageFor(res.error));
    // rate_limited kèm ghi chú cũ → làm mới để em thấy nội dung đã có.
    if (res.error === 'rate_limited' && res.note) router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={ask}
        disabled={loading}
        className="inline-flex h-10 w-fit cursor-pointer items-center gap-1.5 rounded-[12px] border-[1.5px] border-navy/20 bg-white/60 px-3.5 font-display text-[12.5px] font-bold text-navy transition-colors hover:border-navy hover:bg-white disabled:opacity-60"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} strokeWidth={2.5} className="text-gold-deep" />
        )}
        {loading ? t('buddyAsking') : hasNote ? t('buddyAskAgain') : t('buddyAsk')}
      </button>
      {err && (
        <p className="rounded-lg bg-status-bad/10 px-3 py-1.5 text-xs font-bold text-status-bad">{err}</p>
      )}
    </div>
  );
}
