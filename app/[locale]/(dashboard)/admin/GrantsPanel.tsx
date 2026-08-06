'use client';

import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Search, X} from 'lucide-react';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {cancelParentInvite, cancelUserGrant, updateUserGrants} from './actions';
import {PAGE_SIZES} from './user-tabs';

export type GrantRow = {email: string; role: string; class_id: string | null; created_at: string | null};
export type InviteRow = {email: string; childName: string | null};
export type LopChon = {id: string; name: string};

// Vai trò khai sẵn được. 'parent' nằm cuối vì lời mời phụ huynh đi bằng đường khác (bảng
// parent_invitations, gắn với CON chứ không gắn lớp) nhưng vẫn phải xem chung một chỗ.
const VAI_KHAI_DUOC = ['teacher', 'principal', 'admin', 'student', 'parent'] as const;
const TABS = ['all', ...VAI_KHAI_DUOC] as const;
type Tab = (typeof TABS)[number];

const oChon =
  'h-8 w-full min-w-0 cursor-pointer rounded-[9px] border-[1.5px] border-navy/15 bg-white px-1.5 text-[12px] font-semibold text-navy outline-none focus:border-navy';
const selectCls =
  'h-10 cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';
const navyBtn =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-navy px-3 text-[12px] font-extrabold text-white transition-all hover:bg-navy-700';
const ghostBtn =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white/70 px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const ghostBtnLg =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] border-navy/20 bg-white/60 px-3 text-[12px] font-extrabold text-navy transition-all hover:border-navy';
const th = 'text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';

// DANH SÁCH KHAI SẴN — ĐÓNG BĂNG MẶC ĐỊNH, MỘT NÚT LƯU, CÓ CHIA NHÓM.
//
// Bản trước bày MỌI dòng ở trạng thái đang-sửa: mỗi dòng hai ô chọn và một nút "Lưu" riêng. Với ba
// mươi ba dòng đã là ba mươi ba nút Lưu; đầu năm khai năm trăm học sinh với năm trăm giáo viên thì
// đó là một nghìn nút Lưu trên một trang, mỗi cú bấm là một vòng đi-về máy chủ và một lần tải lại
// trang. Chưa kể một danh sách mà mọi ô đều đang mở sẵn thì không đọc được: không phân biệt được
// "cái này tôi vừa đổi" với "cái này vẫn nguyên".
//
// Nay:
//   · MẶC ĐỊNH ĐÓNG BĂNG — dòng chỉ là chữ, đọc được, không lỡ tay đổi. Muốn sửa thì bấm "Sửa
//     danh sách"; lưu xong tự đóng băng lại (server đổi dữ liệu → dấu vân tay đổi → panel dựng lại).
//   · MỘT NÚT LƯU cho cả đợt sửa, gom mọi dòng đã đổi vào một lần gửi. Nút nói rõ đang lưu mấy
//     dòng, và chỉ hiện khi thật sự có thay đổi.
//   · CHIA NHÓM: tab theo vai trò kèm số đếm, lọc theo lớp, tìm theo email, phân trang. Năm trăm
//     học sinh không còn là một cột dài vô tận — bấm "Học sinh · 10A1" là ra đúng lớp ấy.
//
// Lọc và phân trang chạy NGAY TẠI TRÌNH DUYỆT, không đi qua đường dẫn. Máy chủ này nằm sau một
// đường truyền mất gói (mỗi vòng đi-về ~250 ms); dữ liệu đã nằm sẵn trên máy rồi thì bấm một cái
// tab không đáng phải hỏi lại Supabase.
export function GrantsPanel({
  grants,
  invites,
  classes,
  classNames,
}: {
  grants: GrantRow[];
  invites: InviteRow[];
  /** Lớp đang dùng — nguồn cho ô chọn lớp khi sửa và cho bộ lọc lớp. */
  classes: LopChon[];
  /** id lớp → tên, KỂ CẢ lớp đã lưu trữ, để dòng cũ không hiện ra một ô trống. */
  classNames: Record<string, string>;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');

  const [sua, setSua] = useState(false);
  const [edits, setEdits] = useState<Record<string, {role: string; class_id: string}>>({});
  const [tab, setTab] = useState<Tab>('all');
  const [lop, setLop] = useState('');
  const [q, setQ] = useState('');
  const [size, setSize] = useState<number>(25);
  const [trang, setTrang] = useState(1);

  // Đổi bộ lọc thì về trang 1: đang ở trang 7 của "Tất cả" mà bấm sang "Giáo viên" (chỉ có 2 trang)
  // là rơi vào một trang rỗng — trông hệt như "không có giáo viên nào".
  useEffect(() => {
    setTrang(1);
  }, [tab, lop, q, size]);

  const canhCua = (g: GrantRow) => edits[g.email] ?? {role: g.role, class_id: g.class_id ?? ''};
  const daDoi = (g: GrantRow) => {
    const e = edits[g.email];
    return !!e && (e.role !== g.role || e.class_id !== (g.class_id ?? ''));
  };
  const doiDong = (email: string, phan: Partial<{role: string; class_id: string}>) =>
    setEdits((s) => {
      const goc = grants.find((g) => g.email === email);
      const hienTai = s[email] ?? {role: goc?.role ?? 'student', class_id: goc?.class_id ?? ''};
      return {...s, [email]: {...hienTai, ...phan}};
    });

  // So từng dòng với giá trị GỐC chứ không chỉ "đã chạm vào": chọn lại đúng vai cũ rồi bấm Lưu thì
  // không có gì để lưu, và nút không nên nói "Lưu 1 thay đổi".
  const daSua = useMemo(
    () =>
      grants.filter((g) => {
        const e = edits[g.email];
        return !!e && (e.role !== g.role || e.class_id !== (g.class_id ?? ''));
      }),
    [grants, edits],
  );

  // Một danh sách chung để đếm và lọc: khai sẵn (pending_user_grants) và lời mời phụ huynh
  // (parent_invitations) là hai bảng khác nhau nhưng với người quản trị thì cùng một việc —
  // "đã khai, đang chờ họ đăng nhập".
  type Dong =
    | {kind: 'grant'; email: string; role: string; g: GrantRow}
    | {kind: 'invite'; email: string; role: 'parent'; i: InviteRow};
  const tatCa: Dong[] = useMemo(
    () => [
      ...grants.map((g) => ({kind: 'grant' as const, email: g.email, role: g.role, g})),
      ...invites.map((i) => ({kind: 'invite' as const, email: i.email, role: 'parent' as const, i})),
    ],
    [grants, invites],
  );

  const dem = useMemo(() => {
    const m: Record<string, number> = {all: tatCa.length};
    for (const k of VAI_KHAI_DUOC) m[k] = 0;
    for (const d of tatCa) m[d.role] = (m[d.role] ?? 0) + 1;
    return m;
  }, [tatCa]);

  const tuKhoa = q.trim().toLowerCase();
  const locDuoc = useMemo(
    () =>
      tatCa.filter((d) => {
        if (tab !== 'all' && d.role !== tab) return false;
        // Lọc theo lớp chỉ có nghĩa với dòng khai sẵn; lời mời phụ huynh gắn với CON, không gắn lớp.
        if (lop) {
          if (d.kind !== 'grant') return false;
          if (lop === 'none' ? d.g.class_id != null : d.g.class_id !== lop) return false;
        }
        if (tuKhoa && !d.email.toLowerCase().includes(tuKhoa)) return false;
        return true;
      }),
    [tatCa, tab, lop, tuKhoa],
  );

  const soTrang = Math.max(1, Math.ceil(locDuoc.length / size));
  const trangHienTai = Math.min(trang, soTrang);
  const dangHien = locDuoc.slice((trangHienTai - 1) * size, trangHienTai * size);

  // Lớp nào ĐANG có người chờ thì mới đưa vào bộ lọc — một danh sách bốn mươi lớp mà ba mươi tám
  // lớp lọc ra rỗng là bốn mươi lần thử vô ích.
  const lopCoNguoi = useMemo(() => {
    const co = new Set(grants.map((g) => g.class_id).filter(Boolean) as string[]);
    return classes.filter((c) => co.has(c.id));
  }, [grants, classes]);
  const coDongKhongLop = grants.some((g) => !g.class_id);

  const thoatSua = () => {
    if (daSua.length > 0 && !window.confirm(t('grantsConfirmLeave', {n: daSua.length}))) return;
    setEdits({});
    setSua(false);
  };

  const tenLop = (id: string | null) =>
    id ? (classNames[id] ?? t('classGone')) : t('classNone');
  const ngay = (s: string | null) => (s ? String(s).slice(0, 10) : '');

  return (
    <>
      {/* THANH CHIA NHÓM + MỘT NÚT LƯU DUY NHẤT */}
      <div className="mb-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((k) => {
            const on = k === tab;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-pressed={on}
                className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-extrabold transition-all ${
                  on
                    ? 'bg-navy text-white'
                    : 'border-[1.5px] border-navy/15 bg-white/60 text-navy hover:border-navy'
                }`}
              >
                {k === 'all' ? t('tabAll') : tr(k)}
                <span className={on ? 'text-white/70' : 'text-grey-mid'}>{dem[k] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="relative">
            <Search
              size={14}
              strokeWidth={2.4}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-mid"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('grantsSearch')}
              aria-label={t('grantsSearch')}
              className="h-10 w-[230px] rounded-[10px] border-[1.5px] border-navy/15 bg-white pl-8 pr-3 text-[12.5px] font-semibold text-navy outline-none focus:border-navy"
            />
          </span>
          {q && (
            <button type="button" onClick={() => setQ('')} className={ghostBtnLg}>
              <X size={13} strokeWidth={2.6} />
              {t('clear')}
            </button>
          )}

          {(lopCoNguoi.length > 0 || coDongKhongLop) && (
            <select
              value={lop}
              onChange={(e) => setLop(e.target.value)}
              aria-label={t('classes')}
              className={selectCls}
            >
              <option value="">{t('grantsAllClasses')}</option>
              {lopCoNguoi.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {coDongKhongLop && <option value="none">{t('classNone')}</option>}
            </select>
          )}

          {/* Nút sửa / lưu. Đây là chỗ DUY NHẤT lưu được — không còn nút Lưu rải trên từng dòng. */}
          <div className="ml-auto flex items-center gap-2">
            {!sua ? (
              <button type="button" onClick={() => setSua(true)} className={navyBtn}>
                <Pencil size={13} strokeWidth={2.6} />
                {t('grantsEdit')}
              </button>
            ) : (
              <>
                {daSua.length > 0 ? (
                  <form action={updateUserGrants} className="contents">
                    {daSua.map((g) => {
                      const v = canhCua(g);
                      return (
                        <Fragment key={g.email}>
                          <input type="hidden" name="email" value={g.email} />
                          <input type="hidden" name="role" value={v.role} />
                          <input type="hidden" name="class_id" value={v.class_id} />
                        </Fragment>
                      );
                    })}
                    <SubmitButton className={navyBtn} wrapClass="contents">
                      {t('grantsSaveAll', {n: daSua.length})}
                    </SubmitButton>
                  </form>
                ) : (
                  <span className="text-[12px] font-bold text-grey-mid">{t('grantsNoChange')}</span>
                )}
                <button type="button" onClick={thoatSua} className={ghostBtnLg}>
                  {t('grantsExitEdit')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Nói rõ danh sách đang khoá, để người ta khỏi ngồi tìm ô chọn không có ở đó. */}
        {!sua && (
          <p className="text-[12px] font-semibold text-grey-mid">{t('grantsFrozen')}</p>
        )}
      </div>

      {/* role="row" phải nằm TRONG một role="table"/"grid" thì trình đọc màn hình mới hiểu; đứng
          trơ một mình là ARIA không hợp lệ và bị bỏ qua. Khai đủ bộ như bảng người dùng. */}
      <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
        <div role="table" aria-label={t('grantsTitle')}>
          <div
            role="row"
            className="box-border flex min-w-[620px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px]"
          >
            <span role="columnheader" className={`flex-[1.6] ${th}`}>
              {t('email')}
            </span>
            <span role="columnheader" className={`flex-[2] ${th}`}>
              {t('role')} · {t('classes')}
            </span>
            <span role="columnheader" className={`w-[92px] flex-none ${th}`}>
              {t('grantedOn')}
            </span>
            <span className="w-[72px] flex-none" aria-hidden />
          </div>

          {dangHien.map((d) =>
            d.kind === 'grant' ? (
              <DongKhai
                key={`g-${d.email}`}
                g={d.g}
                sua={sua}
                doi={daDoi(d.g)}
                gia={canhCua(d.g)}
                classes={classes}
                tenLop={tenLop}
                ngay={ngay}
                onDoi={doiDong}
              />
            ) : (
              <div
                key={`p-${d.email}`}
                role="row"
                className="box-border flex min-w-[620px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2"
              >
                <span className="min-w-0 flex-[1.6] truncate text-[13px] font-bold text-navy">
                  {d.email}
                </span>
                <span className="flex flex-[2] min-w-0 items-center gap-2">
                  <span className="whitespace-nowrap text-[12.5px] font-semibold text-navy">
                    {tr('parent')}
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-grey-mid">
                    {/* Phụ huynh gắn với CON, không gắn với lớp — nên cột này hiện tên con. */}
                    {d.i.childName ?? t('classNone')}
                  </span>
                </span>
                <span className="w-[92px] flex-none" />
                <span className="w-[72px] flex-none">
                  {sua && (
                    <form action={cancelParentInvite}>
                      <input type="hidden" name="email" value={d.email} />
                      <ConfirmButton
                        message={t('confirmCancelGrant', {email: d.email})}
                        label={t('cancelGrantFor', {email: d.email})}
                        className={ghostBtn}
                      >
                        {t('cancelGrant')}
                      </ConfirmButton>
                    </form>
                  )}
                </span>
              </div>
            ),
          )}

          {dangHien.length === 0 && (
            <div className="border-t border-navy/[0.08] px-[14px] py-8 text-center">
              <div className="text-[13.5px] font-extrabold text-navy">
                {tuKhoa ? t('noMatch', {q}) : t('noUsersFilter')}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-grey-mid">
                {t('noUsersFilterHint')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phân trang + số dòng mỗi trang. Chỉ hiện khi danh sách đủ dài để cần tới. */}
      {(locDuoc.length > PAGE_SIZES[0] || soTrang > 1) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12.5px] font-bold text-navy">
          <button
            type="button"
            onClick={() => setTrang(trangHienTai - 1)}
            disabled={trangHienTai <= 1}
            className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            ← {t('prev')}
          </button>
          <span className="text-grey-mid">{t('pageOf', {page: trangHienTai, total: soTrang})}</span>
          <button
            type="button"
            onClick={() => setTrang(trangHienTai + 1)}
            disabled={trangHienTai >= soTrang}
            className={`${ghostBtn} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {t('next')} →
          </button>
          <label className="ml-2 flex items-center gap-1.5 text-[12px] font-bold text-grey-mid">
            {t('perPage')}
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label={t('perPage')}
              className={`${selectCls} h-8 text-[12px]`}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </>
  );
}

// Một dòng khai sẵn. Đóng băng thì là chữ; đang sửa thì là hai ô chọn + nút Huỷ.
//
// Ô chọn nằm NGOÀI mọi <form> (giá trị giữ bằng state React, đổ vào hidden input ở nút Lưu chung):
// một <form> lồng trong <form> là HTML không hợp lệ, mà mỗi dòng còn cần nút Huỷ riêng — vốn là
// một server action khác. Cùng cách làm với bảng người dùng.
function DongKhai({
  g,
  sua,
  doi,
  gia,
  classes,
  tenLop,
  ngay,
  onDoi,
}: {
  g: GrantRow;
  sua: boolean;
  doi: boolean;
  gia: {role: string; class_id: string};
  classes: LopChon[];
  tenLop: (id: string | null) => string;
  ngay: (s: string | null) => string;
  onDoi: (email: string, phan: Partial<{role: string; class_id: string}>) => void;
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');

  return (
    <div
      role="row"
      className={`box-border flex min-w-[620px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2 ${
        doi ? 'bg-navy/[0.05]' : ''
      }`}
    >
      <span className="min-w-0 flex-[1.6] truncate text-[13px] font-bold text-navy">{g.email}</span>

      {sua ? (
        <span className="flex flex-[2] items-center gap-1.5">
          <select
            value={gia.role}
            onChange={(e) => onDoi(g.email, {role: e.target.value})}
            aria-label={t('grantRoleFor', {name: g.email})}
            className={`${oChon} flex-1`}
          >
            {VAI_KHAI_DUOC.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </select>
          <select
            value={gia.class_id}
            onChange={(e) => onDoi(g.email, {class_id: e.target.value})}
            aria-label={t('classFor', {name: g.email})}
            className={`${oChon} flex-1`}
          >
            <option value="">{t('classNone')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {/* Lớp đã xoá/lưu trữ mà dòng này còn trỏ vào: giữ lại trong danh sách, nếu không
                <select> tự nhảy về "không gắn lớp" và bấm Lưu là âm thầm mất lớp. */}
            {g.class_id && !classes.some((c) => c.id === g.class_id) && (
              <option value={g.class_id}>{tenLop(g.class_id)}</option>
            )}
          </select>
          {doi && (
            <span className="shrink-0 whitespace-nowrap rounded-[7px] bg-navy/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-navy">
              {t('grantsChangedBadge')}
            </span>
          )}
        </span>
      ) : (
        <span className="flex min-w-0 flex-[2] items-center gap-2">
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-navy">
            {tr(g.role as 'student')}
          </span>
          <span className="min-w-0 truncate text-[12.5px] font-semibold text-grey-mid">
            {tenLop(g.class_id)}
          </span>
        </span>
      )}

      <span className="w-[92px] flex-none whitespace-nowrap text-[11.5px] font-semibold text-grey-mid">
        {ngay(g.created_at)}
      </span>
      <span className="w-[72px] flex-none">
        {/* Huỷ chỉ hiện khi đang sửa: danh sách đóng băng thì không có nút nào xoá được dữ liệu. */}
        {sua && (
          <form action={cancelUserGrant}>
            <input type="hidden" name="email" value={g.email} />
            <ConfirmButton
              message={t('confirmCancelGrant', {email: g.email})}
              label={t('cancelGrantFor', {email: g.email})}
              className={ghostBtn}
            >
              {t('cancelGrant')}
            </ConfirmButton>
          </form>
        )}
      </span>
    </div>
  );
}
