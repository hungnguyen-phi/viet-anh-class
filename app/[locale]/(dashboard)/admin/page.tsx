import {Suspense} from 'react';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {Flash} from '@/components/ui/Flash';
import {AdminSections} from './AdminSections';
import {MucQuanTri} from './MucQuanTri';
import {CreateMenuLoader, CreateMenuSkeleton} from './CreateMenuLoader';
import {PendingGrants} from './PendingGrants';
import {PendingSection} from './PendingSection';
import {UsersSection, UsersSectionSkeleton} from './UsersSection';
// Hằng số lấy từ file trung lập, KHÔNG lấy từ UsersToolbar.tsx: nhập dữ liệu thuần từ một module
// 'use client' vào server component thì nhận về proxy tham chiếu, không phải mảng. Xem user-tabs.ts.
import {USER_TABS, PAGE_SIZES, type UserTab} from './user-tabs';

// MÀN QUẢN TRỊ — KHUNG MỎNG, BA MẢNH CHẢY SONG SONG.
//
// Trước đây file này tự chạy mười một truy vấn trong một Promise.all rồi mới dựng được dòng đầu
// tiên. Nghĩa là bấm một cái tab "Học sinh", hay đổi 10 → 50 dòng, là đi hỏi lại cả trường: cơ sở,
// khối, lớp, nhân sự, lời mời, lĩnh vực 4DX, dải wifi — chín thứ chẳng liên quan gì tới bảng
// người dùng.
//
// Đo trên production: một vòng đi-về Supabase mất TRUNG VỊ 251 ms (dao động 57–381), byte đầu của
// /admin về sau 414 ms còn trang xong hẳn mất 1,4–2,8 giây. Container báo tải trung bình 17,2 trên
// 16 CPU trong khi CPU nhàn rỗi 68% — tức là tiến trình nằm CHỜ MẠNG chứ không thiếu sức tính, và
// 2,2% gói TCP phải gửi lại.
//
// Nay khung này chỉ làm đúng việc xác thực rồi đọc tham số, còn ba mảnh dưới chảy độc lập:
//   · người đang chờ duyệt — 1 truy vấn
//   · bảng người dùng      — 2 truy vấn  ← thứ người ta thật sự đang đợi khi bấm tab
//   · phần còn lại         — 8 truy vấn, về sau, không giữ chân ai
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    q?: string;
    upage?: string;
    vai?: string;
    size?: string;
    flash?: string;
    flash_err?: string;
  }>;
}) {
  const {locale} = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const me = await requireRole(['admin']);
  const t = await getTranslations('admin');

  // Loại ký tự phá cú pháp filter PostgREST (,()*) để chống injection ở .or().
  const q = (sp.q ?? '').replace(/[,()*%]/g, '').trim();
  const tab: UserTab = (USER_TABS as readonly string[]).includes(sp.vai ?? '')
    ? (sp.vai as UserTab)
    : 'all';
  // Cỡ trang phải nằm trong danh sách cho phép: ?size=100000 là một cách vô tình (hoặc cố ý) kéo
  // toàn bộ PII của trường về trong một payload.
  const sizeNum = Number(sp.size);
  const page = (PAGE_SIZES as readonly number[]).includes(sizeNum) ? sizeNum : PAGE_SIZES[0];
  const upage = Math.max(1, Number(sp.upage) || 1);

  // Khoá dựng lại cho Suspense: đổi tab / đổi cỡ trang / sang trang là một truy vấn khác, nên phải
  // cho React biết đây là nội dung MỚI. Thiếu key thì nó giữ nguyên bảng cũ trên màn hình cho tới
  // khi bảng mới về — người dùng bấm xong thấy y hệt lúc chưa bấm, tưởng cú bấm rơi mất.
  // KHÔNG đưa q vào khoá: ô tìm nay lọc ngay khi gõ (UsersToolbar), mà đổi khoá là dựng lại cả
  // mảnh — ô gõ mất chữ, mất con trỏ giữa chừng. Lúc tìm, chấm quay nằm trong chính ô gõ; bảng cũ
  // đứng yên tới khi bảng mới về, không nhấp nháy khung xương sau mỗi phím.
  const khoaBang = `${tab}|${page}|${upage}`;

  // revision = dấu vân tay để hộp thoại "Tạo mới" tự đóng khi form bên trong vừa lưu xong. Mọi
  // server action ở đây kết thúc bằng redirect kèm ?flash=… nên đường dẫn luôn đổi sau khi lưu.
  // Giới hạn đã biết: làm HAI lần cùng một thao tác cho ra đúng một câu thông báo thì lần thứ hai
  // hộp thoại không tự đóng. Chấp nhận được — vẫn còn nút ✕, Esc và bấm ra ngoài.
  const revision = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v != null) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-4">
      {/* Tiêu đề + MỘT nút "Tạo mới" gom cả năm việc khai báo (cơ sở, lớp, mời người, phân công,
          mời phụ huynh) — trước đây là năm thẻ form luôn mở giữa trang. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">{t('title')}</h1>
        <Suspense fallback={<CreateMenuSkeleton />}>
          <CreateMenuLoader revision={revision} />
        </Suspense>
      </div>

      <Flash />

      {/* Người chờ duyệt nằm TRÊN thanh chọn mục: đây là việc phải làm ngay, mục nào đang mở cũng
          phải thấy. */}
      <Suspense fallback={null}>
        <PendingSection />
      </Suspense>

      <MucQuanTri
        nguoi={
          <>
            {/* Đã khai sẵn, chờ đăng nhập lần đầu — đặt TRÊN bảng người dùng vì đây là những người
                CHƯA có trong bảng ấy. Không có mục này thì khai xong ba mươi ba email là mất dấu. */}
            <Suspense fallback={null}>
              <PendingGrants />
            </Suspense>
            <Suspense key={khoaBang} fallback={<UsersSectionSkeleton rows={Math.min(page, 10)} />}>
              <UsersSection q={q} tab={tab} page={page} upage={upage} meId={me.id} />
            </Suspense>
            {/* Học sinh đã đăng nhập mà chưa thuộc lớp nào — chuyện của NGƯỜI, đứng ở đây. */}
            <Suspense fallback={null}>
              <AdminSections phan="nguoi" />
            </Suspense>
          </>
        }
        truong={
          <Suspense fallback={null}>
            <AdminSections phan="truong" />
          </Suspense>
        }
        khac={
          <Suspense fallback={null}>
            <AdminSections phan="khac" />
          </Suspense>
        }
      />
    </div>
  );
}
