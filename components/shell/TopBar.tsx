import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';
import {signOut} from '@/lib/auth-actions';
import type {Profile} from '@/lib/auth';

export async function TopBar({profile}: {profile: Profile}) {
  const t = await getTranslations();

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 font-heading text-sm font-extrabold">
          <span className="flex h-7 w-6 items-center justify-center rounded-b-[40%] rounded-t-sm bg-gold text-[11px] font-black text-navy">
            VA
          </span>
          {t('app.name')}
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <span className="hidden text-white/90 sm:inline">
            {profile.full_name ?? profile.email}
          </span>
          <Link
            href="/guide"
            className="rounded-md bg-white/10 px-3 py-1.5 font-semibold transition-colors hover:bg-white/20"
          >
            {t('common.guide')}
          </Link>
          <LocaleSwitcher />
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md bg-white/10 px-3 py-1.5 font-semibold transition-colors hover:bg-white/20"
            >
              {t('common.logout')}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
