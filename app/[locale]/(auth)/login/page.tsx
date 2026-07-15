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
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher />
      </div>

      <div className="absolute inset-x-0 top-4 px-4 text-center text-[11px] font-extrabold uppercase tracking-wide text-gold">
        {values.join(' · ')}
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-14 items-center justify-center rounded-b-[40%] rounded-t-md bg-gold font-heading text-2xl font-black text-navy">
          VA
        </div>
        <h1 className="text-center font-heading text-xl font-black text-navy">
          {t('app.name')}
        </h1>
        <p className="mb-5 mt-1 text-center text-sm text-grey-mid">
          {t('login.subtitle')}
        </p>
        <LoginForm />
      </div>

      <Link href="/guide" className="mt-5 text-sm font-bold text-gold underline">
        {t('common.guide')}
      </Link>
    </main>
  );
}
