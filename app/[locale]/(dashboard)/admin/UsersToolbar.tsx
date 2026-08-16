'use client';

import {useEffect, useState, useTransition, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {Loader2, Search, X} from 'lucide-react';
import {useLinkStatus} from 'next/link';
import {Link, useRouter} from '@/i18n/navigation';
// Hằng số nằm ở file trung lập, KHÔNG khai báo lại ở đây — xem ghi chú trong user-tabs.ts.
import {USER_TABS, PAGE_SIZES, type UserTab} from './user-tabs';

const selectCls =
  'h-10 cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';

// Chấm quay hiện NGAY TRONG tab vừa bấm.
//
// Đổi tab là một vòng đi-về máy chủ thật (truy vấn lại bảng + đếm lại). Trên đường truyền của
// trường, khoảng ấy đủ dài để người ta tưởng cú bấm rơi mất và bấm tiếp tab khác. useLinkStatus
// đọc đúng trạng thái điều hướng của chính <Link> bọc nó, nên không cần tự quản state nào.
function TabPending({children}: {children: ReactNode}) {
  const {pending} = useLinkStatus();
  return pending ? <Loader2 size={12} className="animate-spin" /> : <>{children}</>;
}

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

  const [goi, setGoi] = useState(q);
  const [dangTim, batDauTim] = useTransition();
  // Ô gõ theo người dùng; đường dẫn theo ô gõ, trễ 300 ms. Chỉ đẩy khi khác với ?q= hiện tại —
  // nếu không, lần dựng đầu tiên (goi === q) cũng đẩy một lần vô ích.
  useEffect(() => {
    const sach = goi.replace(/[,()*%]/g, '').trim();
    if (sach === q) return;
    const hen = setTimeout(() => {
      batDauTim(() =>
        router.replace({
          pathname: '/admin',
          query: {...(sach ? {q: sach} : {}), ...(tab !== 'all' ? {vai: tab} : {}), size},
        }),
      );
    }, 300);
    return () => clearTimeout(hen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goi]);
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
              aria-current={on ? 'page' : undefined}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-extrabold transition-all ${
                on
                  ? 'bg-navy text-white'
                  : 'border-[1.5px] border-navy/15 bg-white/60 text-navy hover:border-navy'
              }`}
            >
              {label(k)}
              <span className={on ? 'text-white/70' : 'text-grey-mid'}>
                <TabPending>{counts[k]}</TabPending>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Tìm kiếm + số dòng mỗi trang */}
      <div className="flex flex-wrap items-center gap-2">
        {/* TÌM NGAY KHI GÕ. Bản trước là <form method="get"> với nút "Tìm": gõ xong còn phải bấm
            thêm một cái, và người quản trị hỏi thẳng "code gì lạc hậu vậy". Nay gõ tới đâu lọc tới
            đó — chờ 300 ms sau phím cuối rồi mới hỏi máy chủ, để mười ký tự không thành mười vòng
            đi-về; chấm quay hiện trong ô lúc đang chờ kết quả. Kết quả vẫn đi qua đường dẫn (?q=)
            nên tải lại trang hay gửi link cho người khác vẫn ra đúng danh sách ấy. */}
        <span className="relative">
          <Search
            size={14}
            strokeWidth={2.4}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-mid"
          />
          <input
            value={goi}
            onChange={(e) => setGoi(e.target.value)}
            placeholder={t('searchUser')}
            aria-label={t('searchUser')}
            className="h-10 w-[230px] rounded-[10px] border-[1.5px] border-navy/15 bg-white pl-8 pr-8 text-[12.5px] font-semibold text-navy outline-none focus:border-navy"
          />
          {dangTim ? (
            <Loader2
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-grey-mid"
            />
          ) : (
            goi && (
              <button
                type="button"
                onClick={() => setGoi('')}
                aria-label={t('clear')}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-grey-mid hover:text-navy"
              >
                <X size={14} strokeWidth={2.6} />
              </button>
            )
          )}
        </span>
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
