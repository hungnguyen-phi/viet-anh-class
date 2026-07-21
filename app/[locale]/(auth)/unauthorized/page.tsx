import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ShieldAlert} from 'lucide-react';
import {signOut} from '@/lib/auth-actions';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';

export default async function UnauthorizedPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('unauthorized');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-navy px-5 py-12">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-7 text-center shadow-pop">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-bad/10 text-status-bad">
          <ShieldAlert size={24} strokeWidth={2} />
        </div>
        <h1 className="font-heading text-lg font-extrabold text-navy">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-grey-mid">
          {t('message')}
        </p>
        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="rounded-lg bg-navy px-5 py-2.5 font-heading font-bold text-white transition-colors hover:bg-navy-dark"
          >
            {t('signOut')}
          </button>
        </form>
      </div>
    </main>
  );
}
