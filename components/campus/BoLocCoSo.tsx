'use client';

// BỘ LỌC trên /campus (BGH/admin): Năm học → Khối — cơ sở đã theo campus của người xem. Ghi vào
// URL (?nam=&khoi=) để bảng "Lớp nào đi chậm" lọc ở máy chủ và link chia sẻ được (04/09/2026).
import {useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';

const SEL =
  'ctl-h w-full min-w-0 cursor-pointer appearance-none rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 pr-8 text-base font-bold text-navy transition-all hover:border-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm';

export function BoLocCoSo({
  namList,
  khoiList,
  nam,
  khoi,
}: {
  namList: string[];
  khoiList: {id: string; name: string}[];
  nam: string;
  khoi: string;
}) {
  const t = useTranslations('campusReport');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dangChuyen, batDau] = useTransition();

  const doi = (k: 'nam' | 'khoi', v: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (v) q.set(k, v);
    else q.delete(k);
    if (k === 'nam') q.delete('khoi');
    batDau(() => {
      router.push(`${pathname}?${q.toString()}`);
    });
  };

  const O = ({label, htmlFor, children}: {label: string; htmlFor: string; children: React.ReactNode}) => (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">{label}</span>
      <span className="relative block">
        {children}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-navy/60">▼</span>
      </span>
    </label>
  );

  return (
    <div role="group" aria-label={t('locBoLoc')} aria-busy={dangChuyen} className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
      <O label={t('locNam')} htmlFor="cs-nam">
        <select id="cs-nam" value={nam} disabled={dangChuyen || namList.length <= 1} onChange={(e) => doi('nam', e.target.value)} className={SEL}>
          {namList.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </O>
      <O label={t('locKhoi')} htmlFor="cs-khoi">
        <select id="cs-khoi" value={khoi} disabled={dangChuyen} onChange={(e) => doi('khoi', e.target.value)} className={SEL}>
          <option value="">{t('locTatCa')}</option>
          {khoiList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </O>
    </div>
  );
}
