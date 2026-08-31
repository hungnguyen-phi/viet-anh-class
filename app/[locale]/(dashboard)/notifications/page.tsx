import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Bell} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {DaXem} from '@/components/notifications/DaXem';
import {DongThongBao} from '@/components/notifications/DongThongBao';
import {markAllRead} from './actions';

// Trung tâm thông báo in-app. RLS: mỗi user chỉ thấy thông báo của mình.
export default async function NotificationsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  await requireProfile();
  const t = await getTranslations('notif');
  const supabase = await createClient();

  // SINH NHẮC HỌP PDR TRƯỚC KHI ĐỌC DANH SÁCH (0159).
  //
  // Đây là chuông TRONG app: người ta chỉ thấy thông báo khi mở app, nên sinh nó ngay lúc mở
  // trang này là đủ sớm. Hàm tự chặn chạy dày (10 phút một lần, bảng pdr_nhac_lan_chay) và tự
  // chống nhắc trùng, nên gọi mỗi lần mở trang không sinh ra tin thừa.
  //
  // KHÔNG đặt ở layout: layout chạy trên MỌI trang sau đăng nhập, mà mỗi lần gọi là một vòng
  // mạng tới Supabase — đường truyền VPS↔Supabase của trường vốn đã là chỗ đau. Chỉ trang này
  // mới cần.
  //
  // Nuốt lỗi có chủ ý: hỏng việc nhắc thì trang thông báo vẫn phải mở được. Nếu project đã bật
  // pg_cron (xem cuối 0159) thì cron đã làm phần này rồi, lời gọi ở đây chỉ là lưới đỡ.
  await supabase.rpc('sinh_nhac_pdr').then(
    () => undefined,
    () => undefined,
  );

  const {data} = await supabase
    .from('notifications')
    .select('id, title, body, link, read, created_at')
    .order('created_at', {ascending: false})
    .limit(100);
  const rows = data ?? [];
  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="flex flex-col gap-4">
      {/* MỞ TRANG LÀ TẮT SỐ TRÊN CHUÔNG. Không dựng gì ra màn — chỉ chạy một lần sau khi trang đã
          lên rồi bảo layout đếm lại. Đặt ở đây, sau khi `rows` đã đọc xong, nên danh sách vẫn tô
          đậm những cái vừa-chưa-đọc: em vẫn nhận ra cái nào là mới trong chính lần mở này. */}
      <DaXem soChuaDoc={unread} />
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
          {/* BẤM MỘT DÒNG = ĐÁNH DẤU ĐÚNG DÒNG ẤY RỒI MỚI ĐI TỚI NƠI. Trước đây là <Link> thuần:
              bấm vào là nhảy đi, dòng ấy vĩnh viễn còn "chưa đọc". Chi tiết ở DongThongBao —
              nó cũng là chỗ giữ dấu "mới" không bị lần làm tươi của DaXem xoá mất. */}
          {rows.map((n, i) => (
            <DongThongBao
              key={n.id}
              id={n.id}
              link={n.link ?? '/notifications'}
              title={n.title}
              body={n.body}
              ngay={new Date(n.created_at).toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN')}
              chuaDoc={!n.read}
              coVien={i > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
