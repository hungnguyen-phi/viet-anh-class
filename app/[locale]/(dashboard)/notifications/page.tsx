import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Link} from '@/i18n/navigation';
import {Bell} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {markAllRead} from './actions';

// Trung tâm thông báo in-app. RLS: mỗi user chỉ thấy thông báo của mình.
export default async function NotificationsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireProfile();
  const t = await getTranslations('notif');
  const supabase = await createClient();

  const {data} = await supabase
    .from('notifications')
    .select('id, title, body, link, read, created_at')
    .order('created_at', {ascending: false})
    .limit(100);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="inline-flex items-center gap-2 font-display text-[22px] font-bold text-navy">
          <Bell size={20} strokeWidth={2.2} />
          {t('title')}
          {unread > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[12px] font-black text-navy">{unread}</span>
          )}
        </h1>
        {unread > 0 && (
          <form action={markAllRead}>
            <SubmitButton className="btn-gold cursor-pointer rounded-[12px] px-4 h-11 text-sm font-extrabold" wrapClass="contents">
              {t('markAll')}
            </SubmitButton>
          </form>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="glass rounded-[20px] p-10 text-center">
          <p className="text-sm italic text-grey-mid">{t('empty')}</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-[20px]">
          {rows.map((n, i) => (
            <Link
              key={n.id}
              href={n.link ?? '/notifications'}
              className={`block px-4 py-3 transition-colors hover:bg-navy/[0.03] ${
                i > 0 ? 'border-t border-navy/[0.08]' : ''
              } ${!n.read ? 'bg-gold/[0.06]' : ''}`}
            >
              <div className="flex items-center gap-2">
                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-deep" />}
                <span className="text-[14px] font-bold text-navy">{n.title}</span>
                <span className="ml-auto shrink-0 text-[11px] font-semibold text-grey-mid">
                  {new Date(n.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN')}
                </span>
              </div>
              {n.body && <p className="mt-1 text-[13px] leading-relaxed text-txt">{n.body}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
