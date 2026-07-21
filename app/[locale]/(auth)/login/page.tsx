import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';
import {LoginForm} from '@/components/auth/LoginForm';

export default async function LoginPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const values = [
    t('values.respect'),
    t('values.responsibility'),
    t('values.talent'),
    t('values.integrity'),
    t('values.love'),
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-5 py-12">
      {/* Chiều sâu nền: quầng gold + vignette navy + lưới chấm rất nhẹ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(249,221,14,0.12), transparent 60%), radial-gradient(50rem 40rem at 50% 120%, rgba(20,21,47,0.95), transparent 55%), linear-gradient(160deg, #2c2e6e 0%, #26275d 50%, #1b1c45 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage:
            'radial-gradient(46rem 30rem at 50% 40%, black, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(46rem 30rem at 50% 40%, black, transparent 75%)',
        }}
      />

      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher />
      </div>

      {/* 5 giá trị cốt lõi — chip pill tinh tế */}
      <div className="relative z-10 mb-7 flex max-w-md flex-wrap items-center justify-center gap-2">
        {values.map((v) => (
          <span
            key={v}
            className="rounded-full border border-gold/25 bg-gold/[0.07] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold/90"
          >
            {v}
          </span>
        ))}
      </div>

      <div className="animate-rise relative z-10 w-full max-w-sm rounded-3xl bg-surface p-8 shadow-pop ring-1 ring-white/20">
        <div className="mx-auto mb-5 flex h-16 w-14 items-center justify-center rounded-b-[40%] rounded-t-lg bg-linear-to-b from-gold-soft to-gold font-heading text-2xl font-black text-navy shadow-[0_6px_20px_rgba(249,221,14,0.4)]">
          VA
        </div>
        <h1 className="text-center font-heading text-xl font-black text-navy">
          {t('app.name')}
        </h1>
        <p className="mb-7 mt-1.5 text-center text-sm text-grey-mid">
          {t('login.subtitle')}
        </p>
        <LoginForm />
      </div>

      <Link
        href="/guide"
        className="relative z-10 mt-7 text-sm font-bold text-gold underline-offset-4 transition-opacity hover:underline hover:opacity-90"
      >
        {t('common.guide')}
      </Link>
    </main>
  );
}
