'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Mail, MailCheck, Loader2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

// ============================================================
// DEMO LOGIN (tạm — XOÁ khối này + seed tương ứng trước khi deploy production).
// Mật khẩu đặt trong supabase/seed.sql, chỉ tồn tại trên DB demo/local.
// ============================================================
const DEMO_PASSWORD = 'demo1234';
// label tuỳ chọn: nếu có thì hiển thị thay cho tên vai trò (vd tổ trưởng điểm danh).
const DEMO_ACCOUNTS: {role: string; email: string; to: string; label?: string}[] = [
  {role: 'teacher', email: 'co.lan@truongvietanh.com', to: '/'},
  // Học sinh THƯỜNG (không tổ trưởng) — demo đúng trải nghiệm cá nhân.
  {role: 'student', email: 'hs02@student.truongvietanh.com', to: '/'},
  // Tổ trưởng điểm danh — học sinh được GVCN uỷ quyền điểm danh lớp.
  {role: 'student', email: 'hs01@student.truongvietanh.com', to: '/attendance', label: 'Tổ trưởng ĐD'},
  {role: 'admin', email: 'admin@truongvietanh.com', to: '/admin'},
  {role: 'principal', email: 'bgh@truongvietanh.com', to: '/campus'},
  {role: 'parent', email: 'phuhuynh.an@gmail.com', to: '/report'},
];

export function LoginForm() {
  const t = useTranslations('login');
  const tr = useTranslations('roles');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
          <MailCheck size={22} strokeWidth={2} />
        </div>
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
        className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-grey-line bg-white px-4 py-3 font-heading font-bold text-navy shadow-card transition-all hover:border-line-strong hover:shadow-raise disabled:opacity-60"
      >
        {loading === 'google' && <Loader2 size={16} className="animate-spin" />}
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
        <div className="relative">
          <Mail
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-grey-mid"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full rounded-xl border border-grey-line bg-grey-light/60 py-3 pl-10 pr-4 text-sm text-ink outline-none transition-all focus:border-navy focus:bg-white focus:ring-4 focus:ring-navy/10"
          />
        </div>
        <button
          type="submit"
          disabled={loading !== false}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 font-heading font-bold text-white shadow-[0_10px_24px_-10px_rgba(38,39,93,0.55)] transition-all hover:bg-navy-700 active:scale-[0.99] disabled:opacity-60"
        >
          {loading === 'magic' && <Loader2 size={16} className="animate-spin" />}
          {t('sendLink')}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-status-bad/[0.08] px-3 py-2.5 text-center text-sm font-medium text-status-bad">
          {error}
        </p>
      )}

      {/* DEMO — đăng nhập nhanh theo vai trò (xoá trước khi deploy production) */}
      <div className="mt-1 flex items-center gap-3 text-[11px] text-grey-mid">
        <span className="h-px flex-1 bg-grey-line" />
        <span className="whitespace-nowrap font-bold uppercase tracking-wider">Demo</span>
        <span className="h-px flex-1 bg-grey-line" />
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {DEMO_ACCOUNTS.map((acc) => (
          <button
            key={acc.email}
            type="button"
            onClick={() => signInDemo(acc)}
            disabled={loading !== false}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-grey-line bg-grey-light/50 px-3 py-1.5 text-xs font-semibold text-txt transition-colors hover:border-navy hover:bg-white hover:text-navy disabled:opacity-50"
          >
            {loading === acc.email && <Loader2 size={12} className="animate-spin" />}
            {acc.label ?? tr(acc.role)}
          </button>
        ))}
      </div>
    </div>
  );
}
