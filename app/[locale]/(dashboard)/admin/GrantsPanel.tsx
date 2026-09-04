'use client';

import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {Pencil, Search, X} from 'lucide-react';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {boDau} from '@/lib/don-vi';
import {cancelParentInvite, cancelUserGrant, updateUserGrants} from './actions';
import {PAGE_SIZES} from './user-tabs';

export type GrantRow = {email: string; role: string; class_id: string | null; created_at: string | null};
export type InviteRow = {email: string; childName: string | null};
export type LopChon = {id: string; name: string; campus_id: string; grade_id: string | null};
export type CoSoChon = {id: string; name: string};
export type KhoiChon = {id: string; name: string; campus_id: string};

// BỘ LỌC ĐI THEO ĐƯỜNG DẪN (?gvai=&gcs=&gkhoi=&glop=&gq=), ghi bằng history.replaceState — KHÔNG
// qua router: mỗi cú router.replace là một lần máy chủ dựng lại cả trang quản trị (đường truyền
// mất gói, 1–3 giây), mà dữ liệu đã nằm sẵn trên máy. Ghi thẳng vào thanh địa chỉ thì tải lại
// trang hay gửi link cho người khác vẫn ra đúng bộ lọc, còn bấm thì tức thì.
const THAM_SO = ['gvai', 'gcs', 'gkhoi', 'glop', 'gq'] as const;

// Vai trò khai sẵn được. 'parent' nằm cuối vì lời mời phụ huynh đi bằng đường khác (bảng
// parent_invitations, gắn với CON chứ không gắn lớp) nhưng vẫn phải xem chung một chỗ.
const VAI_KHAI_DUOC = ['teacher', 'principal', 'admin', 'student', 'parent'] as const;
const TABS = ['all', ...VAI_KHAI_DUOC] as const;
// Vai không gắn lớp — cột lớp của họ luôn trống, cả ở CSDL (trigger 0139) lẫn ở ô chọn.
const KHONG_LOP: string[] = ['principal', 'admin'];
type Tab = (typeof TABS)[number];

// THỨ TỰ ĐỌC: người phụ trách trước, học sinh sau.
//
// Xếp theo ngày khai (mặc định của truy vấn) thì GVCN của một lớp nằm lẫn đâu đó giữa ba mươi dòng
// học sinh, tuỳ hôm ấy khai lúc nào — trong khi đó lại là dòng cần soi kỹ nhất: khai sai vai GVCN
// là cả lớp không có ai chủ nhiệm. Trong cùng một vai thì gom theo lớp rồi theo email, để lớp nào
// ra lớp nấy.
const HANG_VAI: Record<string, number> = {teacher: 0, principal: 1, admin: 2, student: 3, parent: 4};

const oChon =
  'h-8 w-full min-w-0 cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-1.5 text-base sm:text-chu-thich font-semibold text-navy outline-none focus:border-navy';
const selectCls =
  'h-11 cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 text-than font-semibold text-navy outline-none focus:border-navy';
const navyBtn =
  'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] bg-navy px-3 text-chu-thich font-extrabold text-white transition-all hover:bg-navy-700';
const ghostBtn =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[8px] border-[1.5px] border-navy/20 bg-white/70 px-2.5 text-chu-thich font-extrabold text-navy transition-all hover:border-navy';
const ghostBtnLg =
  'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border-[1.5px] border-navy/20 bg-white/60 px-3 text-chu-thich font-extrabold text-navy transition-all hover:border-navy';
const th = 'text-nhan font-extrabold uppercase tracking-wide text-grey-mid';

// MỘT BỘ CỘT DÙNG CHUNG CHO CẢ TIÊU ĐỀ LẪN MỌI DÒNG.
//
// Bản trước nhồi vai trò và lớp vào CHUNG một ô ("Học sinh 12A1") nên hai thứ khác hẳn nhau lại
// dính sát nhau, đọc lướt qua ba mươi dòng không tách được đâu là vai đâu là lớp. Nay mỗi thứ một
// cột, chia đều phần còn lại sau khi trừ các cột có bề ngang cố định.
//
// Khai một chỗ rồi dùng lại: tiêu đề và các dòng phải khớp từng cột, mà chúng nằm ở hai component
// khác nhau — chép tay hai bộ số là kiểu lệch cột chỉ lộ ra khi nhìn màn hình thật.
const cotStt = 'w-[34px] flex-none';
const cotEmail = 'min-w-0 flex-1 sm:flex-[1.8]';
const cotVai = 'min-w-0 flex-none sm:flex-1';
const cotLop = 'min-w-0 flex-none sm:flex-1';
const cotNgay = 'flex-none sm:w-[92px]';
const cotNut = 'w-[72px] flex-none';
// Cột riêng cho CHẾ ĐỘ SỬA, không dùng lại cotVai/cotLop.
//
// Ghép `${cotVai} flex-1` là đặt cạnh nhau hai lớp chọi nhau — flex-none (dành cho chữ ở chế độ
// đóng băng) và flex-1 — rồi phó mặc cho thứ tự trong tệp CSS quyết định lớp nào thắng. Kết quả
// ở 360px: mỗi ô chọn chiếm trọn một dòng, mỗi dòng khai báo cao bốn tầng, cả trang dài 9845px.
// CHẾ ĐỘ SỬA DÙNG LƯỚI, KHÔNG DÙNG FLEX.
//
// Đã thử hai lần bằng flex và hỏng cả hai: chia đôi thì ô vai còn 120px và hiện "Giáo v"; cho ô
// lớp bề ngang cố định thì phần còn lại bị bóp tiếp, ô vai còn đúng "G". Với flex, bề ngang mỗi ô
// là phần thừa còn lại sau khi trừ mọi thứ khác — đoán được trên giấy nhưng sai trên màn hình.
// Lưới thì khai thẳng tỉ lệ: vai 1.7 phần, lớp 1 phần, nút Huỷ vừa đúng nội dung. Không còn phụ
// thuộc vào việc hàng có bao nhiêu thứ khác.
// Ô ngày ở chế độ sửa là `hidden` trên máy hẹp nên không chiếm ô lưới nào — vẫn đúng ba cột.
// KHÔNG thụt lề ở dòng sửa, khác với dòng đọc: 42px thụt lề là 42px lấy mất của hai ô chọn, mà
// ở 360px thì đó là phần chênh giữa "Giáo viên chủ nhiệm" đọc được và "Giáo viên" cụt đuôi.
const tangDuoiSua = 'grid w-full grid-cols-[2fr_0.85fr_auto] items-center gap-x-1.5 sm:contents';
const cotSuaVai = 'min-w-0';
const cotSuaLop = 'min-w-0';
const sttCls = 'text-chu-thich font-bold tabular-nums text-grey-mid';

// HAI BỐ CỤC, MỘT CÂY DOM.
//
// Bảng năm cột cần 760px mới đủ chỗ. Trên máy 360px, audit cho thấy người dùng chỉ đọc được STT
// và Email — Vai trò, Lớp học, Ngày khai nằm ngoài màn hình, tức là đúng thứ người ta mở ra để
// xem thì phải cuộn ngang mới thấy, mà cột hiện ra lại là cột dài nhất và ít giá trị nhất.
//
// Dưới 640px: mỗi dòng xuống thành một THẺ hai tầng — tầng trên số thứ tự + email, tầng dưới vai
// · lớp · ngày. Từ 640px trở lên: y nguyên bảng năm cột như cũ.
//
// `sm:contents` là chỗ mấu chốt: cái bọc của tầng dưới BIẾN MẤT ở màn rộng, ba ô con rơi thẳng
// vào hàng flex của dòng. Nhờ vậy không phải viết hai khối JSX song song — thứ chắc chắn sẽ lệch
// nhau sau vài lần sửa, và lệch ở bản nào ít ai mở thì lâu mới lộ.
const hangCls =
  'box-border flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-navy/[0.08] px-[14px] py-2.5 sm:min-w-[760px] sm:flex-nowrap sm:gap-2 sm:py-2';
// flex-wrap ở tầng dưới: vai "Giáo viên chủ nhiệm" dài gấp ba "Học sinh", nên với vai ấy thì
// vai + lớp + ngày không nằm vừa một dòng 318px và ngày bị đẩy ra ngoài thẻ 24px. Cho ngày rơi
// xuống dòng kế còn hơn để nó tràn ra nền trang.
const tangDuoi = 'flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-[42px] sm:contents';
const chamNgan = 'text-grey-mid/50 sm:hidden';

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
  campuses,
  grades,
}: {
  grants: GrantRow[];
  invites: InviteRow[];
  /** Lớp đang dùng — nguồn cho ô chọn lớp khi sửa và cho bộ lọc lớp. */
  classes: LopChon[];
  /** id lớp → tên, KỂ CẢ lớp đã lưu trữ, để dòng cũ không hiện ra một ô trống. */
  classNames: Record<string, string>;
  campuses: CoSoChon[];
  grades: KhoiChon[];
}) {
  const t = useTranslations('admin');
  const tr = useTranslations('roles');
  const sp = useSearchParams();

  const [sua, setSua] = useState(false);
  const [edits, setEdits] = useState<Record<string, {role: string; class_id: string}>>({});
  const vaiBanDau = sp.get('gvai') ?? 'all';
  const [tab, setTab] = useState<Tab>(
    (TABS as readonly string[]).includes(vaiBanDau) ? (vaiBanDau as Tab) : 'all',
  );
  const [cs, setCs] = useState(sp.get('gcs') ?? '');
  const [khoi, setKhoi] = useState(sp.get('gkhoi') ?? '');
  const [lop, setLop] = useState(sp.get('glop') ?? '');
  const [q, setQ] = useState(sp.get('gq') ?? '');
  const [size, setSize] = useState<number>(25);
  const [trang, setTrang] = useState(1);
  const [hoiThoat, setHoiThoat] = useState(false);

  // Đổi bộ lọc thì về trang 1: đang ở trang 7 của "Tất cả" mà bấm sang "Giáo viên" (chỉ có 2 trang)
  // là rơi vào một trang rỗng — trông hệt như "không có giáo viên nào". Đồng thời ghi bộ lọc lên
  // thanh địa chỉ (xem THAM_SO).
  useEffect(() => {
    setTrang(1);
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    const gia: Record<(typeof THAM_SO)[number], string> = {
      gvai: tab === 'all' ? '' : tab,
      gcs: cs,
      gkhoi: khoi,
      glop: lop,
      gq: q,
    };
    for (const k of THAM_SO) {
      if (gia[k]) u.searchParams.set(k, gia[k]);
      else u.searchParams.delete(k);
    }
    window.history.replaceState(window.history.state, '', u.toString());
  }, [tab, cs, khoi, lop, q, size]);

  // Cơ sở → khối → lớp: ô sau chỉ liệt kê những gì thuộc ô trước; đổi ô trước thì ô sau về trống.
  const lopTheoId = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const chonCs = (v: string) => {
    setCs(v);
    setKhoi('');
    setLop('');
  };
  const chonKhoi = (v: string) => {
    setKhoi(v);
    setLop('');
  };

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

  // Từ khoá bỏ dấu, so với email VÀ tên lớp (gõ "10a1" ra cả lớp). Bảng khai sẵn không có cột tên
  // người — chỉ email — nên chưa tìm theo tên được (xem ghi chú ở PendingGrants).
  const tuKhoa = boDau(q);
  const locDuoc = useMemo(
    () =>
      tatCa.filter((d) => {
        if (tab !== 'all' && d.role !== tab) return false;
        // Lọc theo nơi học chỉ có nghĩa với dòng khai sẵn; lời mời phụ huynh gắn với CON, không gắn lớp.
        if (lop || cs || khoi) {
          if (d.kind !== 'grant') return false;
          if (lop === 'none') {
            if (d.g.class_id != null) return false;
          } else {
            const c = d.g.class_id ? lopTheoId.get(d.g.class_id) : undefined;
            if (lop && d.g.class_id !== lop) return false;
            if (cs && c?.campus_id !== cs) return false;
            if (khoi && c?.grade_id !== khoi) return false;
          }
        }
        if (tuKhoa) {
          const tenLop = d.kind === 'grant' && d.g.class_id ? (classNames[d.g.class_id] ?? '') : '';
          if (!boDau(d.email).includes(tuKhoa) && !boDau(tenLop).includes(tuKhoa)) return false;
        }
        return true;
      }),
    [tatCa, tab, lop, cs, khoi, tuKhoa, lopTheoId, classNames],
  );

  const daXep = useMemo(() => {
    const khoaLop = (d: Dong) =>
      d.kind === 'grant' ? (d.g.class_id ? (classNames[d.g.class_id] ?? '') : '￿') : '￿';
    return [...locDuoc].sort(
      (a, b) =>
        (HANG_VAI[a.role] ?? 9) - (HANG_VAI[b.role] ?? 9) ||
        khoaLop(a).localeCompare(khoaLop(b), 'vi') ||
        a.email.localeCompare(b.email, 'vi'),
    );
  }, [locDuoc, classNames]);

  const soTrang = Math.max(1, Math.ceil(daXep.length / size));
  const trangHienTai = Math.min(trang, soTrang);
  const batDau = (trangHienTai - 1) * size;
  const dangHien = daXep.slice(batDau, batDau + size);

  // Lớp nào ĐANG có người chờ thì mới đưa vào bộ lọc — một danh sách bốn mươi lớp mà ba mươi tám
  // lớp lọc ra rỗng là bốn mươi lần thử vô ích.
  const lopCoNguoi = useMemo(() => {
    const co = new Set(grants.map((g) => g.class_id).filter(Boolean) as string[]);
    return classes.filter(
      (c) => co.has(c.id) && (!cs || c.campus_id === cs) && (!khoi || c.grade_id === khoi),
    );
  }, [grants, classes, cs, khoi]);
  const csCoNguoi = useMemo(() => {
    const co = new Set(
      grants.map((g) => (g.class_id ? lopTheoId.get(g.class_id)?.campus_id : null)).filter(Boolean),
    );
    return campuses.filter((c) => co.has(c.id));
  }, [grants, campuses, lopTheoId]);
  const khoiCoNguoi = useMemo(() => {
    const co = new Set(
      grants.map((g) => (g.class_id ? lopTheoId.get(g.class_id)?.grade_id : null)).filter(Boolean),
    );
    return grades.filter((g) => co.has(g.id) && (!cs || g.campus_id === cs));
  }, [grants, grades, lopTheoId, cs]);
  const coDongKhongLop = grants.some((g) => !g.class_id);

  // Thoát sửa khi còn dòng chưa lưu → HỎI bằng hộp của app, không phải window.confirm (hộp hệ
  // thống lệch bản sắc, nút OK/Cancel không dịch).
  const thoatSua = () => {
    if (daSua.length > 0) {
      setHoiThoat(true);
      return;
    }
    setEdits({});
    setSua(false);
  };
  const thoatHan = () => {
    setHoiThoat(false);
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
                className={`inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-chu-thich font-extrabold transition-all ${
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
              strokeWidth={2.5}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-grey-mid"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('grantsSearch')}
              aria-label={t('grantsSearch')}
              className="h-11 w-[230px] rounded-[8px] border-[1.5px] border-navy/15 bg-white pl-8 pr-3 text-doc font-semibold text-navy focus-visible:border-navy focus-visible:outline-none sm:text-than"
            />
          </span>
          {q && (
            <button type="button" onClick={() => setQ('')} className={ghostBtnLg}>
              <X size={13} strokeWidth={2.5} />
              {t('clear')}
            </button>
          )}

          {csCoNguoi.length > 1 && (
            <select value={cs} onChange={(e) => chonCs(e.target.value)} aria-label={t('filterCampus')} className={selectCls}>
              <option value="">{t('filterCampus')}</option>
              {csCoNguoi.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {khoiCoNguoi.length > 1 && (
            <select value={khoi} onChange={(e) => chonKhoi(e.target.value)} aria-label={t('filterGrade')} className={selectCls}>
              <option value="">{t('filterGrade')}</option>
              {khoiCoNguoi.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
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
          {(cs || khoi || lop) && (
            <button type="button" onClick={() => chonCs('')} className={ghostBtnLg}>
              <X size={13} strokeWidth={2.5} />
              {t('filterClear')}
            </button>
          )}

          {/* Nút sửa / lưu. Đây là chỗ DUY NHẤT lưu được — không còn nút Lưu rải trên từng dòng. */}
          <div className="ml-auto flex items-center gap-2">
            {!sua ? (
              <button type="button" onClick={() => setSua(true)} className={navyBtn}>
                <Pencil size={13} strokeWidth={2.5} />
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
                  <span className="text-chu-thich font-bold text-grey-mid">{t('grantsNoChange')}</span>
                )}
                <button type="button" onClick={thoatSua} className={ghostBtnLg}>
                  {t('grantsExitEdit')}
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {hoiThoat && (
        <Popup title={t('grantsExitEdit')} onClose={() => setHoiThoat(false)} width="max-w-[400px]">
          <p className="text-noi-dung font-semibold leading-relaxed text-navy">
            {t('grantsConfirmLeave', {n: daSua.length})}
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setHoiThoat(false)} className={`${ghostBtnLg} min-h-[44px]`}>
              {t('grantsKeepEditing')}
            </button>
            <button type="button" onClick={thoatHan} autoFocus className={`${navyBtn} min-h-[44px]`}>
              {t('grantsDiscard')}
            </button>
          </div>
        </Popup>
      )}

      {/* role="row" phải nằm TRONG một role="table"/"grid" thì trình đọc màn hình mới hiểu; đứng
          trơ một mình là ARIA không hợp lệ và bị bỏ qua. Khai đủ bộ như bảng người dùng. */}
      {/* Chỉ cuộn ngang từ 640px trở lên — dưới đó không còn gì phải cuộn, dòng đã xuống thẻ. */}
      <div className="rounded-[12px] border-[1.5px] border-navy/10 sm:overflow-x-auto">
        <div role="table" aria-label={t('grantsTitle')}>
          {/* Hàng tiêu đề chỉ có nghĩa khi còn là bảng. Ở dạng thẻ, mỗi dòng tự nói ra nó là gì. */}
          <div
            role="row"
            className="box-border hidden min-w-[760px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px] sm:flex"
          >
            <span role="columnheader" className={`${cotStt} ${th}`}>
              {t('grantsNo')}
            </span>
            <span role="columnheader" className={`${cotEmail} ${th}`}>
              {t('email')}
            </span>
            <span role="columnheader" className={`${cotVai} ${th}`}>
              {t('role')}
            </span>
            <span role="columnheader" className={`${cotLop} ${th}`}>
              {t('classes')}
            </span>
            <span role="columnheader" className={`${cotNgay} ${th}`}>
              {t('grantedOn')}
            </span>
            <span className={cotNut} aria-hidden />
          </div>

          {dangHien.map((d, i) =>
            d.kind === 'grant' ? (
              <DongKhai
                key={`g-${d.email}`}
                stt={batDau + i + 1}
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
              <div key={`p-${d.email}`} role="row" className={hangCls}>
                <span className={`${cotStt} ${sttCls}`}>{batDau + i + 1}</span>
                <span className={`${cotEmail} truncate text-than font-bold text-navy`}>
                  {d.email}
                </span>
                <span className={tangDuoi}>
                  <span className={`${cotVai} truncate text-than font-semibold text-navy`}>
                    {tr('parent')}
                  </span>
                  <span className={chamNgan}>·</span>
                  <span className={`${cotLop} truncate text-than font-semibold text-grey-mid`}>
                    {/* Phụ huynh gắn với CON, không gắn với lớp — nên cột này hiện tên con. */}
                    {d.i.childName ?? t('classNone')}
                  </span>
                  <span className={cotNgay} />
                </span>
                <span className={cotNut}>
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
              <div className="text-noi-dung font-extrabold text-navy">
                {tuKhoa ? t('noMatch', {q}) : t('noUsersFilter')}
              </div>
              <div className="mt-1 text-chu-thich font-semibold text-grey-mid">
                {t('noUsersFilterHint')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phân trang + số dòng mỗi trang. Chỉ hiện khi danh sách đủ dài để cần tới. */}
      {(locDuoc.length > PAGE_SIZES[0] || soTrang > 1) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-than font-bold text-navy">
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
          <label className="ml-2 flex items-center gap-1.5 text-chu-thich font-bold text-grey-mid">
            {t('perPage')}
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label={t('perPage')}
              className={`${selectCls} h-8 text-chu-thich`}
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
  stt,
  g,
  sua,
  doi,
  gia,
  classes,
  tenLop,
  ngay,
  onDoi,
}: {
  /** Số thứ tự chạy liên tục qua các trang — trang 2 bắt đầu từ 26, không quay về 1. */
  stt: number;
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
    <div role="row" className={`${hangCls} ${doi ? 'bg-navy/[0.05]' : ''}`}>
      <span className={`${cotStt} ${sttCls}`}>{stt}</span>
      <span className={`${cotEmail} flex items-center gap-1.5`}>
        <span className="min-w-0 truncate text-than font-bold text-navy">{g.email}</span>
        {/* Nhãn "đã sửa" bám vào EMAIL chứ không vào ô chọn: nó phải đọc được ở cả hai chế độ, và
            khi chen vào giữa cột vai/lớp thì hai ô chọn bị bóp lại mỗi lần đổi một dòng. */}
        {doi && (
          <span className="shrink-0 whitespace-nowrap rounded-[8px] bg-navy/10 px-1.5 py-0.5 text-nhan font-extrabold uppercase text-navy">
            {t('grantsChangedBadge')}
          </span>
        )}
      </span>

      <span className={sua ? tangDuoiSua : tangDuoi}>
      {sua ? (
        <>
          <span className={cotSuaVai}>
            <select
              value={gia.role}
              onChange={(e) =>
                // BGH/admin không thuộc lớp nào (0139): đổi sang vai ấy là ô lớp về trống và khoá.
                onDoi(
                  g.email,
                  KHONG_LOP.includes(e.target.value)
                    ? {role: e.target.value, class_id: ''}
                    : {role: e.target.value},
                )
              }
              aria-label={t('grantRoleFor', {name: g.email})}
              className={oChon}
            >
              {VAI_KHAI_DUOC.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </select>
          </span>
          <span className={cotSuaLop}>
            <select
              value={KHONG_LOP.includes(gia.role) ? '' : gia.class_id}
              disabled={KHONG_LOP.includes(gia.role)}
              onChange={(e) => onDoi(g.email, {class_id: e.target.value})}
              aria-label={t('classFor', {name: g.email})}
              className={`${oChon} disabled:cursor-not-allowed disabled:opacity-50`}
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
          </span>
        </>
      ) : (
        <>
          <span className={`${cotVai} truncate text-than font-semibold text-navy`}>
            {tr(g.role as 'student')}
          </span>
          <span className={chamNgan}>·</span>
          <span className={`${cotLop} truncate text-than font-semibold text-grey-mid`}>
            {tenLop(g.class_id)}
          </span>
          <span className={chamNgan}>·</span>
        </>
      )}
      {/* Đang sửa trên máy hẹp thì ngày phải nhường chỗ: hai ô chọn cộng ngày trong 318px là ba
          thứ đều chật, mà ngày khai là thứ ít cần nhất lúc đang gán vai. */}
      <span
        className={`${cotNgay} whitespace-nowrap text-chu-thich font-semibold text-grey-mid ${
          sua ? 'hidden sm:block' : ''
        }`}
      >
        {ngay(g.created_at)}
      </span>
      {/* Nút Huỷ nằm TRONG tầng dưới, không đứng riêng.
          Ở ngoài thì trên máy hẹp nó tự chiếm thêm một dòng nữa cho mỗi khai báo — dòng thứ tư
          của một thẻ vốn chỉ cần hai. `sm:contents` ở tầng dưới làm cái bọc biến mất ở màn rộng,
          nên trên bảng nó vẫn là cột cuối như cũ. */}
      <span className={sua ? 'flex-none' : cotNut}>
        {/* Huỷ chỉ hiện khi đang sửa: danh sách đóng băng thì không có nút nào xoá được dữ liệu. */}
        {sua && (
          <form action={cancelUserGrant}>
            <input type="hidden" name="email" value={g.email} />
            <ConfirmButton
              message={t('confirmCancelGrant', {email: g.email})}
              label={t('cancelGrantFor', {email: g.email})}
              className={`${ghostBtn} px-2 sm:px-2.5`}
            >
              {/* Trên máy hẹp nút thu về dấu ✕: chữ "Huỷ" chiếm 72px, đúng bằng phần chênh khiến
                  ô chọn vai bị cắt cụt. Tên đọc được của nút vẫn là "Huỷ khai báo cho <email>"
                  nên trình đọc màn hình không mất gì. */}
              <span className="sm:hidden" aria-hidden>
                ✕
              </span>
              <span className="hidden sm:inline">{t('cancelGrant')}</span>
            </ConfirmButton>
          </form>
        )}
      </span>
      </span>
    </div>
  );
}
