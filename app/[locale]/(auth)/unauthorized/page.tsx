import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {ShieldAlert, LogOut, RotateCcw, Mail} from 'lucide-react';
import {signOut} from '@/lib/auth-actions';
import {getCurrentProfile, homeRouteForRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Link} from '@/i18n/navigation';

// ════════════════════════════════════════════════════════════════════════════
// MÀN HÌNH ĐẦU TIÊN MỌI GIÁO VIÊN MỚI CỦA TRƯỜNG SẼ GẶP
// ════════════════════════════════════════════════════════════════════════════
//
// Bản cũ: một hình tam giác đỏ, một câu "Tài khoản của bạn chưa được gán vai trò. Liên hệ quản
// trị viên." và ĐÚNG MỘT NÚT — Đăng xuất. Ai? tên gì? bao lâu? Đăng xuất rồi đăng nhập lại vẫn
// màn hình đó. Và tệ nhất: khi quản trị viên đã duyệt xong, người ta bấm F5 vẫn thấy y nguyên
// màn hình đỏ, vì trang không hề kiểm tra lại — nên họ gọi lên bảo "app hỏng".
//
// Ba thứ được thêm, mỗi thứ gỡ đúng một ngõ cụt:
//   · Trang TỰ KIỂM lại vai mỗi lần mở. Đã được duyệt thì đi thẳng vào nhà, không phải hỏi ai.
//   · Nút "Kiểm tra lại" — cùng việc ấy nhưng do người dùng chủ động, và họ thấy mình làm được gì.
//   · TÊN VÀ EMAIL THẬT của người duyệt. "Liên hệ quản trị viên" không phải một chỉ dẫn.
export default async function UnauthorizedPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('unauthorized');

  // ĐÃ ĐƯỢC DUYỆT THÌ ĐI THẲNG VÀO. Đây là đường thoát mà bản cũ không có: quản trị viên bấm cấp
  // quyền xong, người dùng tải lại trang là vào được, không cần ai giải thích gì.
  const profile = await getCurrentProfile();
  if (profile && profile.role !== 'pending') redirect(homeRouteForRole(profile.role));

  // Người duyệt là AI — hỏi qua hàm nguyen_duyet() (migration 0092), KHÔNG hỏi thẳng bảng.
  //
  // Bản cũ chạy `select ... from profiles where role='admin'` bằng chính phiên của người đang
  // chờ. Chính sách rls_select_profiles chỉ cho vai 'pending' đọc đúng dòng của họ, nên câu ấy
  // LUÔN trả về rỗng và trang rơi vào nhánh lùi "Trường chưa có quản trị viên nào trong hệ
  // thống" — sai, và sai với đúng người đang cần biết phải nhờ ai. Không phải thỉnh thoảng: mọi
  // lần, với mọi người, kể cả khi trường có đủ quản trị viên. Audit mobile 2026-08-06 chụp được
  // nguyên văn câu ấy trên màn của giáo viên.
  //
  // Vẫn giữ nhánh lùi bên dưới cho trường hợp THẬT SỰ chưa có ai.
  const supabase = await createClient();
  const {data: admins} = await supabase.rpc('nguoi_duyet');

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
        <h1 className="font-display text-xl font-extrabold text-navy">{t('title')}</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-txt">{t('message')}</p>

        {profile?.email && (
          <p className="mt-2 text-than font-semibold text-grey-mid">
            {t('yourAccount', {email: profile.email})}
          </p>
        )}

        {/* AI DUYỆT. Danh sách thật, có email bấm gửi thư được — thay cho "liên hệ quản trị viên",
            một câu không chỉ tới ai cả. */}
        <div className="mt-5 rounded-[16px] border-[1.5px] border-navy/10 bg-white/60 p-4 text-left">
          <div className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
            {t('whoApproves')}
          </div>
          {admins && admins.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {admins.map((a) => (
                <li key={a.email} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-than font-bold text-navy">{a.full_name ?? a.email}</span>
                  <a
                    href={`mailto:${a.email}`}
                    className="inline-flex min-h-[44px] items-center gap-1 text-chu-thich font-semibold text-navy/70 underline"
                  >
                    <Mail size={11} strokeWidth={2.5} />
                    {a.email}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-than font-semibold text-grey-mid">{t('noAdminYet')}</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {/* Cùng một trang, nhưng bấm vào là server render lại và chạy lại phép kiểm ở trên.
              Người dùng có một việc để làm thay vì chỉ có nút đăng xuất. */}
          <Link
            href="/unauthorized"
            className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border-[1.5px] border-navy/20 bg-white px-5 py-2.5 font-display text-noi-dung font-bold text-navy transition-all hover:border-navy"
          >
            <RotateCcw size={15} strokeWidth={2.4} />
            {t('checkAgain')}
          </Link>
          <form action={signOut}>
            <SubmitButton
              className="btn-gold inline-flex cursor-pointer items-center gap-2 rounded-[12px] px-6 py-2.5 font-display font-bold"
              wrapClass="inline-flex items-center gap-2"
            >
              <LogOut size={17} strokeWidth={2.2} />
              {t('signOut')}
            </SubmitButton>
          </form>
        </div>
      </div>
    </main>
  );
}
