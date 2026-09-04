'use client';

import {useEffect, useMemo, useState, useTransition, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {Loader2, Search, X} from 'lucide-react';
import {useLinkStatus} from 'next/link';
import {Link, useRouter} from '@/i18n/navigation';
// Hằng số nằm ở file trung lập, KHÔNG khai báo lại ở đây — xem ghi chú trong user-tabs.ts.
import {USER_TABS, PAGE_SIZES, type UserTab} from './user-tabs';
import type {LocNoiHoc} from './UsersSection';

const selectCls =
  'min-h-11 h-11 max-w-[180px] cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 text-than font-semibold text-navy focus-visible:border-navy focus-visible:outline-none';

export type DanhMucLoc = {
  campuses: {id: string; name: string}[];
  grades: {id: string; name: string; campus_id: string}[];
  classes: {id: string; name: string; campus_id: string; grade_id: string | null}[];
};

// Chấm quay hiện NGAY TRONG tab vừa bấm.
//
// Đổi tab là một vòng đi-về máy chủ thật (truy vấn lại bảng + đếm lại). Trên đường truyền của
// trường, khoảng ấy đủ dài để người ta tưởng cú bấm rơi mất và bấm tiếp tab khác. useLinkStatus
// đọc đúng trạng thái điều hướng của chính <Link> bọc nó, nên không cần tự quản state nào.
function TabPending({children}: {children: ReactNode}) {
  const {pending} = useLinkStatus();
  return pending ? <Loader2 size={12} className="animate-spin" /> : <>{children}</>;
}

// Thanh điều khiển bảng người dùng: TÁCH VAI THÀNH TAB + tìm kiếm + lọc nơi học + số dòng mỗi trang.
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
  loc,
  danhMuc,
}: {
  q: string;
  tab: UserTab;
  size: number;
  counts: Record<UserTab, number>;
  loc: LocNoiHoc;
  danhMuc: DanhMucLoc;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const router = useRouter();

  const label = (k: UserTab) => (k === 'all' ? t('tabAll') : tr(k));

  // MỌI đường dẫn của thanh này dựng từ MỘT chỗ, để tab / tìm / lọc / cỡ trang không đánh rơi nhau:
  // bản cũ ba chỗ tự ghép query riêng, thêm một tham số là phải nhớ sửa cả ba.
  const duong = (them: Partial<{q: string; vai: string; cs: string; khoi: string; lop: string; size: number}>) => {
    const goc = {q, vai: tab === 'all' ? '' : tab, cs: loc.cs, khoi: loc.khoi, lop: loc.lop, size, ...them};
    const query: Record<string, string | number> = {};
    if (goc.q) query.q = goc.q;
    if (goc.vai) query.vai = goc.vai;
    if (goc.cs) query.cs = goc.cs;
    if (goc.khoi) query.khoi = goc.khoi;
    if (goc.lop) query.lop = goc.lop;
    query.size = goc.size;
    return {pathname: '/admin' as const, query};
  };

  const [goi, setGoi] = useState(q);
  const [dangTim, batDauTim] = useTransition();
  // Ô gõ theo người dùng; đường dẫn theo ô gõ, trễ 250 ms. Chỉ đẩy khi khác với ?q= hiện tại —
  // nếu không, lần dựng đầu tiên (goi === q) cũng đẩy một lần vô ích.
  useEffect(() => {
    const sach = goi.replace(/[,()*%]/g, '').trim();
    if (sach === q) return;
    const hen = setTimeout(() => {
      batDauTim(() => router.replace(duong({q: sach})));
    }, 250);
    return () => clearTimeout(hen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goi]);
  // Đổi số dòng/trang thì luôn về TRANG 1: đang ở trang 7 với 10 dòng mà chuyển sang 100 dòng
  // thì trang 7 không còn tồn tại, và một bảng rỗng trông hệt như "không có ai".
  const goSize = (n: number) => router.push(duong({size: n}));

  // Bộ lọc nơi học: cơ sở → khối → lớp, ô sau chỉ liệt kê những gì thuộc ô trước. Đổi ô trước thì
  // ô sau về trống (khối của cơ sở A không có nghĩa ở cơ sở B). Bộ lọc này chỉ áp cho học sinh
  // (trang ép tab 'student' khi có lọc) nên tab hiện tại không cần giữ.
  const [dangLoc, batDauLoc] = useTransition();
  const khoiCuaCs = useMemo(
    () => danhMuc.grades.filter((g) => !loc.cs || g.campus_id === loc.cs),
    [danhMuc.grades, loc.cs],
  );
  const lopCuaKhoi = useMemo(
    () =>
      danhMuc.classes.filter(
        (c) => (!loc.cs || c.campus_id === loc.cs) && (!loc.khoi || c.grade_id === loc.khoi),
      ),
    [danhMuc.classes, loc.cs, loc.khoi],
  );
  const chonLoc = (phan: Partial<LocNoiHoc>) => {
    const moi: LocNoiHoc = {...loc, ...phan};
    if (phan.cs !== undefined) {
      moi.khoi = '';
      moi.lop = '';
    }
    if (phan.khoi !== undefined) moi.lop = '';
    const coLoc = !!(moi.cs || moi.khoi || moi.lop);
    batDauLoc(() => router.push(duong({...moi, vai: coLoc ? 'student' : tab === 'all' ? '' : tab})));
  };
  const coLoc = !!(loc.cs || loc.khoi || loc.lop);

  return (
    <div className="mb-3 flex flex-col gap-2.5">
      {/* Tab theo vai trò */}
      <div className="flex flex-wrap gap-1.5">
        {USER_TABS.map((k) => {
          const on = k === tab;
          return (
            <Link
              key={k}
              href={duong({vai: k === 'all' ? '' : k})}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex min-h-11 h-11 items-center gap-1.5 rounded-full px-3.5 text-chu-thich font-extrabold transition-all ${
                on
                  ? 'bg-navy text-white'
                  : 'border-[1.5px] border-navy/15 bg-white/60 text-navy hover:border-navy'
              }`}
            >
              {label(k)}
              <span className={`ml-0.5 tabular-nums ${on ? 'text-white/70' : 'text-grey-mid'}`}>
                <TabPending>{counts[k]}</TabPending>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Tìm kiếm + lọc nơi học + số dòng mỗi trang */}
      <div className="flex flex-wrap items-center gap-2">
        {/* TÌM NGAY KHI GÕ, KHÔNG CẦN DẤU. Gõ tới đâu lọc tới đó — chờ 250 ms sau phím cuối rồi
            mới hỏi máy chủ, để mười ký tự không thành mười vòng đi-về; chấm quay hiện trong ô lúc
            đang chờ kết quả. Kết quả vẫn đi qua đường dẫn (?q=) nên tải lại trang hay gửi link cho
            người khác vẫn ra đúng danh sách ấy. */}
        <span className="relative">
          <Search
            size={14}
            strokeWidth={2.5}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-mid"
          />
          <input
            value={goi}
            onChange={(e) => setGoi(e.target.value)}
            placeholder={t('searchUser')}
            aria-label={t('searchUser')}
            className="min-h-11 h-11 w-[230px] rounded-[8px] border-[1.5px] border-navy/15 bg-white pl-8 pr-8 text-doc font-semibold text-navy focus-visible:border-navy focus-visible:outline-none sm:text-than"
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
                className="absolute right-0 top-0 grid min-h-11 h-11 w-10 cursor-pointer place-items-center text-grey-mid hover:text-navy"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            )
          )}
        </span>

        {/* Lọc nơi học. Ba ô nối nhau; một ô có giá trị là cả bộ lọc "đang bật" và có nút xoá. */}
        {danhMuc.campuses.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5">
            <select
              value={loc.cs}
              onChange={(e) => chonLoc({cs: e.target.value})}
              aria-label={t('filterCampus')}
              className={selectCls}
            >
              <option value="">{t('filterCampus')}</option>
              {danhMuc.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={loc.khoi}
              onChange={(e) => chonLoc({khoi: e.target.value})}
              aria-label={t('filterGrade')}
              className={selectCls}
            >
              <option value="">{t('filterGrade')}</option>
              {khoiCuaCs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={loc.lop}
              onChange={(e) => chonLoc({lop: e.target.value})}
              aria-label={t('filterClass')}
              className={selectCls}
            >
              <option value="">{t('filterClass')}</option>
              {lopCuaKhoi.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {dangLoc && <Loader2 size={14} className="animate-spin text-grey-mid" />}
            {coLoc && !dangLoc && (
              <button
                type="button"
                onClick={() => chonLoc({cs: '', khoi: '', lop: ''})}
                className="inline-flex min-h-11 h-11 cursor-pointer items-center gap-1 rounded-[8px] border-[1.5px] border-navy/15 bg-white/60 px-2.5 text-chu-thich font-extrabold text-navy hover:border-navy"
              >
                <X size={13} strokeWidth={2.5} />
                {t('filterClear')}
              </button>
            )}
          </span>
        )}

        <label className="ml-auto flex items-center gap-1.5 text-chu-thich font-bold text-grey-mid">
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
