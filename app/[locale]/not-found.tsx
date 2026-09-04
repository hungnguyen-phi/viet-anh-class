import {Link} from '@/i18n/navigation';
import {getTranslations} from 'next-intl/server';

// 404 cho URL sai BÊN TRONG một locale hợp lệ (vd /vi/khong-ton-tai).
//
// Khác với app/not-found.tsx ở gốc: file này nằm dưới app/[locale]/layout.tsx nên có sẵn
// <html>/<body>, globals.css và font — dùng được đúng giao diện app. Bản ở gốc phải viết kiểu
// inline vì nó chạy trước layout đó (xem ghi chú trong chính file kia).
export default async function LocaleNotFound() {
  const t = await getTranslations('common');
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-[440px] text-center">
        {/* 64px: con số 404 trang trí, cố ý ngoài thang chữ. */}
        <div className="font-display text-[64px] font-bold leading-none text-navy/20">404</div>
        <h1 className="mt-3 font-display text-dau font-bold text-navy">{t('khongTimThayTrang')}</h1>
        <p className="mt-2 text-noi-dung font-semibold leading-[1.6] text-navy/70">{t('khongTimThayMoTa')}</p>
        <Link
          href="/"
          className="btn-gold mt-6 inline-flex h-11 items-center rounded-[12px] px-6 font-display text-noi-dung font-bold"
        >
          {t('veTrangChinh')}
        </Link>
      </div>
    </main>
  );
}
