import {getTranslations, setRequestLocale} from 'next-intl/server';
import {SITE_URL, SCHOOL} from '@/lib/site';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';
import {LoginForm} from '@/components/auth/LoginForm';
import {StudentCrowd} from '@/components/auth/StudentCrowd';
import {SkyDecor} from '@/components/auth/SkyDecor';
import {HubEmbedGate} from '@/components/hub/HubEmbedGate';

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
      className="fixed inset-0 overflow-hidden"
      style={{background: '#ffffff'}}
    >
      {/* JSON-LD EducationalOrganization — chỉ đặt ở trang CÔNG KHAI này; các trang sau đăng nhập
          đã bị chặn ở robots.ts nên không cần (và không nên) mô tả cho máy tìm kiếm. */}
      <script
        type="application/ld+json"
        // Nội dung tĩnh do mình viết, không có dữ liệu người dùng → không có nguy cơ injection.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'EducationalOrganization',
            name: SCHOOL.name,
            url: SCHOOL.url,
            logo: `${SITE_URL}/logo-viet-anh.jpg`,
            subOrganization: {
              '@type': 'WebApplication',
              name: SCHOOL.appName,
              url: `${SITE_URL}/vi`,
              applicationCategory: 'EducationalApplication',
              inLanguage: ['vi', 'en'],
            },
          }),
        }}
      />

      {/* NHÚNG VÀO HUB: che toàn bộ màn đăng nhập của app này bằng CSS thuần (ẩn/hiện qua cờ
          data-hub-embed đặt TRƯỚC khi vẽ trang — xem globals.css), rồi tự bắt tay + đăng nhập
          qua tài khoản Hub. Người vào trực tiếp không thấy component này render ra gì (trả về
          null) — màn hình y hệt trước đây. */}
      <HubEmbedGate />

      <div data-login-content className="contents">
        {/* Nền trời: mây trôi + chim bay (sau đám đông) */}
        <SkyDecor />

        {/* Nền: đám đông học sinh đi lại */}
        <StudentCrowd />

        {/* Đổi ngôn ngữ */}
        <div className="absolute right-4 top-4 z-20">
          <LocaleSwitcher />
        </div>

        {/* Nội dung */}
        <div className="relative z-10 flex flex-col items-center px-5 pb-4 pt-[6.5vh] sm:pb-24 sm:pt-[9vh]">
        {/* Nhãn trường — chỉ logo, đã bỏ chữ */}
        <div className="inline-flex items-center rounded-full border border-navy/15 bg-white/55 p-1.5 backdrop-blur-sm">
          <span className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full bg-white">
            {/* Bản 128px: logo gốc là JPEG 900x900 (72 KB) nhưng ô này chỉ 44x44 — bản webp
                128px (2.8 KB) vẫn dư nét ở màn hình 2x. File .jpg gốc GIỮ NGUYÊN vì metadata
                (OG image, apple-touch-icon) cần ảnh lớn. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-viet-anh-128.webp"
              alt="Logo Trường Việt Anh"
              width={44}
              height={44}
              fetchPriority="high"
              className="h-[44px] w-[44px] rounded-full object-cover"
            />
          </span>
        </div>

        {/* Tiêu đề lớn + gạch chân gold vẽ tay */}
        <h1 className="mt-4 text-center font-display font-bold leading-[0.98] tracking-tight text-navy text-[clamp(2.15rem,8.5vw,5.5rem)] max-sm:text-[clamp(2.7rem,12.5vw,3.9rem)] sm:mt-6">
          Viet Anh{' '}
          <span className="relative inline-block text-gold">
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
        <p className="mt-5 max-w-[560px] text-center text-[14.5px] font-semibold leading-[1.5] text-navy/75 sm:mt-8 sm:text-[17px]">
          {t('hero')}
        </p>

        {/* Thẻ đăng nhập */}
        <div className="mt-7 w-full max-w-[376px] sm:mt-9">
          <LoginForm />
        </div>
        </div>
      </div>
    </main>
  );
}
