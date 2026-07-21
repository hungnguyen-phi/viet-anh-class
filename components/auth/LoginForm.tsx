'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Loader2, Check} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

// ============================================================
// DEMO LOGIN (tạm — XOÁ khối này + seed tương ứng trước khi deploy production).
// Mật khẩu đặt trong supabase/seed.sql, chỉ tồn tại trên DB demo/local.
// ============================================================
const DEMO_PASSWORD = 'demo1234';
const DEMO_ACCOUNTS: {role: string; email: string; to: string; label?: string}[] = [
  {role: 'teacher', email: 'co.lan@truongvietanh.com', to: '/'},
  {role: 'student', email: 'hs02@student.truongvietanh.com', to: '/'},
  {role: 'student', email: 'hs01@student.truongvietanh.com', to: '/attendance', label: 'Tổ trưởng ĐD'},
  {role: 'admin', email: 'admin@truongvietanh.com', to: '/admin'},
  {role: 'principal', email: 'bgh@truongvietanh.com', to: '/campus'},
  {role: 'parent', email: 'phuhuynh.an@gmail.com', to: '/report'},
];

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LoginForm() {
  const t = useTranslations('login');
  const tr = useTranslations('roles');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [showParent, setShowParent] = useState(false);
  const [loading, setLoading] = useState<false | string>(false);
  const [error, setError] = useState<string | null>(null);

  // DEMO — đăng nhập nhanh bằng mật khẩu seed (xoá cùng khối DEMO_ACCOUNTS).
  async function signInDemo(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setError(null);
    setLoading(acc.email);
    const supabase = createClient();
    const {error} = await supabase.auth.signInWithPassword({
      email: acc.email,
      password: DEMO_PASSWORD,
    });
    if (error) {
      setError(t('errorGeneric'));
      setLoading(false);
    } else {
      window.location.assign(acc.to);
    }
  }

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

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Thẻ kính đăng nhập */}
      <div
        className="w-full rounded-[22px] border border-navy/12 p-4"
        style={{
          background: 'rgba(255,255,255,0.62)',
          backdropFilter: 'blur(22px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.9), 0 26px 60px -20px rgba(38,39,93,0.35)',
        }}
      >
        <button
          type="button"
          onClick={signInGoogle}
          disabled={loading !== false}
          className="flex h-[50px] w-full cursor-pointer items-center justify-center gap-[11px] rounded-[14px] border border-navy/[0.16] bg-white font-display text-[14.5px] font-bold text-navy shadow-[0_8px_20px_-8px_rgba(38,39,93,0.28)] transition-all hover:brightness-[0.98] active:translate-y-px disabled:opacity-60"
        >
          {loading === 'google' ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
          {t('googleButton')}
        </button>
        <div className="mt-2 text-center text-[11px] font-semibold text-navy/55">
          {t('googleHint')}
        </div>

        {/* Phụ huynh: link mở ra ô email */}
        {!showParent && !sent && (
          <button
            type="button"
            onClick={() => setShowParent(true)}
            className="mx-auto mt-3 block cursor-pointer px-1.5 py-1 text-xs font-extrabold text-gold-deep underline underline-offset-[3px]"
          >
            {t('parentLink')}
          </button>
        )}

        {(showParent || sent) && (
          <div className="mt-3 border-t border-navy/12 pt-3">
            {!sent ? (
              <form onSubmit={sendMagicLink} className="flex gap-[7px]">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  autoFocus
                  className="h-11 min-w-0 flex-1 rounded-[12px] border border-navy/[0.18] bg-white px-[13px] text-[13.5px] font-bold text-navy outline-none transition-all focus:border-gold focus:shadow-[0_0_0_3px_rgba(249,221,14,0.22)]"
                />
                <button
                  type="submit"
                  disabled={loading !== false}
                  className="btn-gold inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[12px] px-4 font-display text-[13px] font-black disabled:opacity-60"
                >
                  {loading === 'magic' && <Loader2 size={15} className="animate-spin" />}
                  {t('sendShort')}
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-[9px] text-[12.5px] font-bold text-success">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-white">
                  <Check size={12} strokeWidth={3.2} />
                </span>
                <span className="min-w-0">
                  {t('sentShort')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setEmail('');
                    }}
                    className="cursor-pointer font-extrabold text-gold-deep underline"
                  >
                    {t('again')}
                  </button>
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="mt-2 rounded-[10px] bg-status-bad/[0.08] px-3 py-2 text-center text-xs font-semibold text-status-bad">
            {error}
          </p>
        )}
      </div>

      {/* DEMO — đăng nhập nhanh theo vai trò (xoá trước khi deploy production) */}
      <div className="w-full">
        <div className="flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-wider text-navy/40">
          <span className="h-px flex-1 bg-navy/10" />
          <span>Demo</span>
          <span className="h-px flex-1 bg-navy/10" />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => signInDemo(acc)}
              disabled={loading !== false}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-navy/15 bg-white/60 px-2.5 py-1 text-[11px] font-bold text-navy transition-colors hover:border-navy hover:bg-white disabled:opacity-50"
            >
              {loading === acc.email && <Loader2 size={11} className="animate-spin" />}
              {acc.label ?? tr(acc.role)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
