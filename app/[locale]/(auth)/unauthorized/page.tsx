import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ShieldAlert, LogOut} from 'lucide-react';
import {signOut} from '@/lib/auth-actions';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';
import {SubmitButton} from '@/components/ui/SubmitButton';

export default async function UnauthorizedPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('unauthorized');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher />
      </div>

      <div className="glass animate-rise w-full max-w-md rounded-[26px] p-8 text-center">
        <div
          className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-status-bad"
          style={{background: 'rgba(192,57,43,0.12)'}}
        >
          <ShieldAlert size={30} strokeWidth={2} />
        </div>
        <h1 className="font-display text-xl font-extrabold text-navy">
          {t('title')}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-txt">
          {t('message')}
        </p>
        <form action={signOut} className="mt-6">
          <SubmitButton
            className="btn-gold inline-flex cursor-pointer items-center gap-2 rounded-[12px] px-6 py-2.5 font-display font-bold"
            wrapClass="inline-flex items-center gap-2"
          >
            <LogOut size={17} strokeWidth={2.2} />
            {t('signOut')}
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
