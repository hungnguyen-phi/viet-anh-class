import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import {UsersToolbar} from './UsersToolbar';
import {UsersTable} from './UsersTable';
import {USER_TABS, type UserTab} from './user-tabs';

// inline-flex items-center KHÔNG phải thừa: h-8 dựng hộp cao 32px, nhưng chữ chỉ tự nằm giữa hộp
// khi phần tử là <button> (trình duyệt căn sẵn nội dung nút). Trên <a> và <span> — hai nút phân
// trang bên dưới — chữ bám mép trên, lệch 6px so với nhãn "Trang 1/5" ở giữa. Đã đo trên production.
const outlineBtnSm =
  'inline-flex h-8 cursor-pointer items-center justify-center whitespace-nowrap rounded-[10px] border-[1.5px] border-navy/20 bg-white/60 px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';

// BẢNG NGƯỜI DÙNG — MẢNH RIÊNG, CHẢY RIÊNG.
//
// Đây là lý do cả trang được tách ra. Trước đây bấm một cái tab "Học sinh" hay đổi 10 → 50 dòng là
// dựng lại TOÀN BỘ trang: mười một truy vấn, trong đó chín cái (cơ sở, khối, lớp, nhân sự, lời
// mời, lĩnh vực, wifi) chẳng liên quan gì tới bảng người dùng. Đo trên production: một vòng đi-về
// Supabase mất trung vị 251 ms, và trang mất 1,4–2,8 giây mới xong.
//
// Nay mảnh này chỉ chạy HAI truy vấn — dòng của trang hiện tại, và số đếm cho các tab — rồi hiện
// ngay, còn phần còn lại của trang chảy về sau mà không giữ chân nó.
export async function UsersSection({
  q,
  tab,
  page,
  upage,
  meId,
}: {
  q: string;
  tab: UserTab;
  page: number;
  upage: number;
  meId: string;
}) {
  const t = await getTranslations('admin');
  const supabase = await createClient();
  const fromIdx = (upage - 1) * page;

  let usersQuery = supabase
    .from('profiles')
    .select('id, full_name, email, role', {count: 'exact'})
    .order('email')
    .range(fromIdx, fromIdx + page - 1);
  // Phải khớp ĐÚNG phép so của hàm admin_user_counts (ilike hai cột), nếu không con số trên tab và
  // số dòng trong bảng sẽ lệch nhau — kiểu lỗi người dùng không báo được thành lời, họ chỉ thấy
  // "ghi 3 mà bấm vào có 1" rồi thôi tin cả màn hình.
  if (q) usersQuery = usersQuery.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (tab !== 'all') usersQuery = usersQuery.eq('role', tab);

  // Số đếm cho bảy tab bằng MỘT lượt đi-về (hàm admin_user_counts, migration 0085) thay vì bảy.
  const [{data: pageUsers, count: usersTotal}, {data: roleCounts}] = await Promise.all([
    usersQuery,
    supabase.rpc('admin_user_counts', q ? {p_q: q} : {}),
  ]);

  const rows = pageUsers ?? [];
  const total = usersTotal ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / page));
  // Hàm chỉ trả về những vai CÓ người; vai rỗng không có dòng nào. Dựng đủ bảy khoá với mặc định 0
  // để tab "Phụ huynh (0)" vẫn hiện số thay vì hiện `undefined`.
  const byRole = new Map((roleCounts ?? []).map((r) => [r.role, Number(r.n)]));
  const counts = Object.fromEntries(
    USER_TABS.map((k) => [
      k,
      k === 'all' ? [...byRole.values()].reduce((a, b) => a + b, 0) : (byRole.get(k) ?? 0),
    ]),
  ) as Record<UserTab, number>;

  const trang = (n: number) => ({
    pathname: '/admin' as const,
    query: {...(q ? {q} : {}), ...(tab !== 'all' ? {vai: tab} : {}), size: page, upage: n},
  });

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 font-display text-[15px] font-bold text-navy">
        {t('users')} <span className="font-semibold text-grey-mid">({counts.all})</span>
      </div>

      <UsersToolbar q={q} tab={tab} size={page} counts={counts} />

      <UsersTable rows={rows} meId={meId} q={q} />

      {/* Phân trang — giữ nguyên tab và cỡ trang khi sang trang khác. */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] font-bold text-navy">
          {upage > 1 ? (
            <Link href={trang(upage - 1)} className={outlineBtnSm}>
              ← {t('prev')}
            </Link>
          ) : (
            <span className={`${outlineBtnSm} pointer-events-none opacity-40`}>← {t('prev')}</span>
          )}
          <span className="text-grey-mid">{t('pageOf', {page: upage, total: totalPages})}</span>
          {upage < totalPages ? (
            <Link href={trang(upage + 1)} className={outlineBtnSm}>
              {t('next')} →
            </Link>
          ) : (
            <span className={`${outlineBtnSm} pointer-events-none opacity-40`}>{t('next')} →</span>
          )}
        </div>
      )}
    </section>
  );
}

// Khung xương trong lúc chờ.
//
// Không dùng chấm quay giữa màn: nó nói "đang bận" mà không nói cái gì sắp hiện ra, và mỗi lần
// đổi tab lại thấy cả vùng co lại rồi bung ra. Khung xương giữ nguyên chiều cao và hình dạng bảng
// nên mắt không phải tìm lại chỗ cũ.
export function UsersSectionSkeleton({rows = 10}: {rows?: number}) {
  return (
    <section className="glass rounded-[20px] p-[18px]" aria-busy="true">
      <div className="mb-3 h-5 w-40 rounded bg-navy/[0.08]" />
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {Array.from({length: 7}, (_, i) => (
          <div key={i} className="h-10 w-24 rounded-full bg-navy/[0.06]" />
        ))}
      </div>
      <div className="mb-3 h-10 w-[280px] rounded-[10px] bg-navy/[0.06]" />
      <div className="overflow-hidden rounded-[14px] border-[1.5px] border-navy/10">
        <div className="h-9 bg-navy/[0.04]" />
        {Array.from({length: rows}, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-navy/[0.08] px-[14px] py-3">
            <div className="h-4 w-4 rounded bg-navy/[0.08]" />
            <div className="h-3.5 flex-[1.2] rounded bg-navy/[0.08]" />
            <div className="h-3 flex-[1.4] rounded bg-navy/[0.05]" />
            <div className="h-3 flex-1 rounded bg-navy/[0.05]" />
            <div className="h-8 flex-[1.6] rounded-[10px] bg-navy/[0.05]" />
            <div className="h-8 w-[130px] rounded-[10px] bg-navy/[0.05]" />
          </div>
        ))}
      </div>
    </section>
  );
}
