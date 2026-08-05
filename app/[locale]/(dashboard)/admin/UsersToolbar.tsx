'use client';

import {useTranslations} from 'next-intl';
import {Search, X} from 'lucide-react';
import {Link, useRouter} from '@/i18n/navigation';
import {SubmitButton} from '@/components/ui/SubmitButton';

export const USER_TABS = ['all', 'teacher', 'principal', 'admin', 'student', 'parent', 'pending'] as const;
export type UserTab = (typeof USER_TABS)[number];
export const PAGE_SIZES = [10, 25, 50, 100] as const;

const navyBtn =
  'h-10 cursor-pointer whitespace-nowrap rounded-[10px] bg-navy px-3 text-[12px] font-extrabold text-white transition-all hover:bg-navy-700';
const selectCls =
  'h-10 cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';

// Thanh điều khiển bảng người dùng: TÁCH VAI THÀNH TAB + tìm kiếm + số dòng mỗi trang.
//
// Bản cũ trộn học sinh, giáo viên, BGH, quản trị, phụ huynh và người chờ vào MỘT bảng xếp theo
// email — muốn xem "có bao nhiêu giáo viên" thì phải tự đọc cột vai trò qua từng trang. Tab kèm
// số đếm trả lời câu ấy trước khi bấm, và lọc luôn khi bấm.
//
// Số dòng mặc định là 10: bảng ngắn thì cả trang còn chứa được những mục bên dưới; ai cần nhìn
// nhiều thì chọn 25/50/100 — lựa chọn ấy đi theo đường dẫn nên tải lại trang vẫn giữ nguyên.
export function UsersToolbar({
  q,
  tab,
  size,
  counts,
}: {
  q: string;
  tab: UserTab;
  size: number;
  counts: Record<UserTab, number>;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const router = useRouter();

  const label = (k: UserTab) => (k === 'all' ? t('tabAll') : tr(k));
  // Đổi số dòng/trang thì luôn về TRANG 1: đang ở trang 7 với 10 dòng mà chuyển sang 100 dòng
  // thì trang 7 không còn tồn tại, và một bảng rỗng trông hệt như "không có ai".
  const goSize = (n: number) =>
    router.push({pathname: '/admin', query: {...(q ? {q} : {}), ...(tab !== 'all' ? {vai: tab} : {}), size: n}});

  return (
    <div className="mb-3 flex flex-col gap-2.5">
      {/* Tab theo vai trò */}
      <div className="flex flex-wrap gap-1.5">
        {USER_TABS.map((k) => {
          const on = k === tab;
          return (
            <Link
              key={k}
              href={{
                pathname: '/admin',
                query: {...(q ? {q} : {}), ...(k !== 'all' ? {vai: k} : {}), size},
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold transition-all ${
                on
                  ? 'bg-navy text-white'
                  : 'border-[1.5px] border-navy/15 bg-white/60 text-navy hover:border-navy'
              }`}
            >
              {label(k)}
              <span className={on ? 'text-white/70' : 'text-grey-mid'}>{counts[k]}</span>
            </Link>
          );
        })}
      </div>

      {/* Tìm kiếm + số dòng mỗi trang */}
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex items-center gap-1.5">
          {/* Giữ tab và cỡ trang khi tìm — nếu không, mỗi lần gõ tìm là bị ném về "Tất cả". */}
          {tab !== 'all' && <input type="hidden" name="vai" value={tab} />}
          <input type="hidden" name="size" value={size} />
          <span className="relative">
            <Search
              size={14}
              strokeWidth={2.4}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-mid"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder={t('searchUser')}
              aria-label={t('searchUser')}
              className="h-10 w-[230px] rounded-[10px] border-[1.5px] border-navy/15 bg-white pl-8 pr-3 text-[12.5px] font-semibold text-navy outline-none focus:border-navy"
            />
          </span>
          <SubmitButton className={navyBtn}>{t('search')}</SubmitButton>
        </form>
        {q && (
          <Link
            href={{pathname: '/admin', query: {...(tab !== 'all' ? {vai: tab} : {}), size}}}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white/60 px-2.5 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
          >
            <X size={13} strokeWidth={2.6} />
            {t('clear')}
          </Link>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[12px] font-bold text-grey-mid">
          {t('perPage')}
          <select
            value={size}
            onChange={(e) => goSize(Number(e.target.value))}
            aria-label={t('perPage')}
            className={selectCls}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
