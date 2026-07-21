import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';
import {LoginForm} from '@/components/auth/LoginForm';
import {StudentCrowd} from '@/components/auth/StudentCrowd';

export default async function LoginPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('login');

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{background: 'linear-gradient(180deg,#ffffff 0%,#fbfbfa 58%,#f2f3f1 100%)'}}
    >
      {/* Nền: đám đông học sinh đi lại */}
      <StudentCrowd />

      {/* Đổi ngôn ngữ */}
      <div className="absolute right-5 top-5 z-20 rounded-2xl bg-navy p-1 shadow-[0_10px_28px_rgba(38,39,93,0.28)]">
        <LocaleSwitcher />
      </div>

      {/* Nội dung */}
      <div className="relative z-10 flex flex-col items-center px-5 pb-24 pt-[9vh]">
        {/* Nhãn trường */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-navy/15 bg-white/55 py-1.5 pl-1.5 pr-3.5 backdrop-blur-sm">
          <span className="grid h-[26px] w-[26px] place-items-center overflow-hidden rounded-full bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-viet-anh.jpg"
              alt="Logo Trường Việt Anh"
              className="h-[22px] w-[22px] rounded-full object-cover"
            />
          </span>
          <span className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-navy">
            {t('brand')}
          </span>
        </div>

        {/* Tiêu đề lớn + gạch chân gold vẽ tay */}
        <h1 className="mt-6 text-center font-display font-bold leading-[0.98] tracking-tight text-navy text-[clamp(2.75rem,9vw,5.5rem)]">
          Việt Anh{' '}
          <span className="relative inline-block">
            Class
            <svg
              viewBox="0 0 320 26"
              preserveAspectRatio="none"
              aria-hidden
              className="absolute left-0 w-full"
              style={{bottom: '-0.14em', height: '0.22em'}}
            >
              <path
                d="M8,16 Q90,4 170,12 T312,9"
                fill="none"
                stroke="#f9dd0e"
                strokeWidth="8"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        {/* Slogan */}
        <p className="mt-8 max-w-[560px] text-center text-[17px] font-semibold leading-[1.55] text-navy/75">
          {t('hero')}
        </p>

        {/* Thẻ đăng nhập */}
        <div className="mt-9 w-full max-w-[376px]">
          <LoginForm />
        </div>

        {/* Hướng dẫn */}
        <Link
          href="/guide"
          className="mt-5 text-[13px] font-extrabold text-navy/60 underline underline-offset-4 transition-colors hover:text-navy"
        >
          {t('guide')}
        </Link>
      </div>
    </main>
  );
}
