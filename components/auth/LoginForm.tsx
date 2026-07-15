'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {createClient} from '@/lib/supabase/client';

export function LoginForm() {
  const t = useTranslations('login');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<false | 'google' | 'magic'>(false);
  const [error, setError] = useState<string | null>(null);

  async function signInGoogle() {
    setError(null);
    setLoading('google');
    const supabase = createClient();
    const {error} = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {redirectTo: `${window.location.origin}/auth/callback`},
    });
    if (error) {
      setError(t('errorGeneric'));
      setLoading(false);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@')) {
      setError(t('errorEmail'));
      return;
    }
    setLoading('magic');
    const supabase = createClient();
    const {error} = await supabase.auth.signInWithOtp({
      email,
      options: {emailRedirectTo: `${window.location.origin}/auth/callback`},
    });
    setLoading(false);
    if (error) setError(t('errorGeneric'));
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="font-heading text-lg font-extrabold text-success">
          {t('linkSent')}
        </div>
        <p className="mt-2 text-sm text-grey-mid">{t('linkSentDesc')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={signInGoogle}
        disabled={loading !== false}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-grey-line bg-white px-4 py-3 font-heading font-bold text-navy transition-colors hover:bg-grey-light disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.34Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {t('googleButton')}
      </button>
      <p className="text-center text-xs text-grey-mid">{t('googleHint')}</p>

      <div className="my-1 flex items-center gap-3 text-[11px] text-grey-mid">
        <span className="h-px flex-1 bg-grey-line" />
        <span className="whitespace-nowrap">{t('orParent')}</span>
        <span className="h-px flex-1 bg-grey-line" />
      </div>

      <form onSubmit={sendMagicLink} className="flex flex-col gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className="w-full rounded-lg border border-grey-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-navy"
        />
        <button
          type="submit"
          disabled={loading !== false}
          className="rounded-lg bg-navy px-4 py-3 font-heading font-bold text-white transition-colors hover:bg-navy-dark disabled:opacity-60"
        >
          {loading === 'magic' ? '…' : t('sendLink')}
        </button>
      </form>

      {error && (
        <p className="text-center text-sm text-status-bad">{error}</p>
      )}
    </div>
  );
}
