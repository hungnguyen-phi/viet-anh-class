'use client';

// ── VIỆC EM LÀM (④) + CAM KẾT TUẦN NÀY (⑤) ───────────────────────────────────────────────────
//
// Hai khu GHI của bảng của em theo mô hình mới. Mục tiêu (③) là <MucTieuCuaCon>, băng rôn (②) do
// màn cha bày sẵn ở máy chủ — khối này chỉ lo hai khu cần bấm:
//   ④ Việc em làm   (viec_bang)  — mỗi thước một hàng: 12 ô tuần + 7 ô ngày để chạm/điền
//   ⑤ Cam kết       (cam_ket_v)  — em tự chấm Thắng/Thua, máy chỉ gợi ý
//
// KHÔNG TỰ CỘNG SỐ (L12): số đã do CSDL tính sẵn, truyền xuống qua props. Ghi đi qua ĐÚNG action
// lõi của mô hình mới (`student/actions.ts`), không có đường ghi thứ hai:
//   · ghiLuot(thuocId, ngay, giaTri) → đặt LẠI giá trị ngày ấy (xoá lượt tay cũ rồi ghi), trả {ok}
//   · chamCamKet(formData)           → action chuyển hướng (redirect + flash), dùng qua <form>
// Cửa sổ 7 ngày, khoá chữ ký, luật thứ Sáu là RLS/trigger thật — nút chỉ mờ sẵn cho đúng sự thật.
// Mọi ô nhập controlled (bài học 31/08): value + onChange, dọn khi ghi xong.

import {useState, useTransition, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {ListChecks, Flag, Check, Plus, Minus, X} from 'lucide-react';
import {isoDowVN} from '@/lib/dates';
import {ThemCamKetEm} from '@/components/student/ThemCamKetEm';
import {ghiLuot, chamCamKet, doiCamKet, type LuotResult} from '@/app/[locale]/(dashboard)/student/actions';
import {SuaCamKetEm} from '@/components/student/SuaCamKetEm';
import {SuaViecEm} from '@/components/student/SuaViecEm';

export type ViecTuan = {
  tuan: string;
  gia: number;
  chi_tieu: number;
  dat: boolean;
  trang_thai: string;
  la_tuan_hoc: boolean;
};

export type ViecEm = {
  thuoc_id: string;
  ten: string;
  ten_don_vi: string | null;
  don_vi_id: string | null;
  cach_ghi: string; // cham | dien | he_thong
  chieu_dich: string; // it_nhat | nhieu_nhat
  chi_tieu: number;
  ky_tuan: number;
  dat: boolean;
  gia: number;
  trang_thai: string;
  ngay_ap_dung: number[];
  cho_bu: boolean;
  chi_xem: boolean;
  muoiHaiTuan: ViecTuan[];
  ngayLuot: Record<string, number>;
};

export type CamKetEm = {
  id: string;
  noi_dung: string;
  trang_thai: string;
  ket_qua: string | null;
  so_hua: number | null;
  so_dat: number | null;
  ten_don_vi: string | null;
  so_tuan: number;
  tuan_bat_dau: string;
  tuan_ket_thuc: string | null;
  xong_at: string | null;
  goi_y_may: string | null;
  so_dat_goi_y: number | null;
  muc_tieu_id: string | null;
  thuoc_id: string | null;
  lac_muc_tieu: boolean | null;
  tenMucTieu: string | null;
  tenViec: string | null;
};

// ── Tiện ích thuần (server + client cho cùng một kết quả → không lệch hydrate) ────────────────
const so = (n: number | null | undefined) =>
  n == null ? '0' : Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

export function themNgay(s: string, delta: number): string {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
const ddmm = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');

export function BangEmPA2({
  laChinhEm,
  studentId,
  classId,
  viec,
  camKet,
  weekDays,
  today,
  monday,
  thisMonday,
  tuanNghi,
  daChotHopTuan,
  dayShort,
  mucTieuLop = [],
}: {
  laChinhEm: boolean;
  studentId: string;
  classId: string;
  viec: ViecEm[];
  camKet: CamKetEm[];
  weekDays: string[];
  today: string;
  monday: string;
  thisMonday: string;
  tuanNghi: boolean;
  daChotHopTuan: boolean;
  dayShort: string[];
  mucTieuLop?: {id: string; ten: string; don_vi_id: string | null; ten_don_vi: string | null}[];
}) {
  const tb = useTranslations('bangEm');
  const tv = useTranslations('viec');
  const tc = useTranslations('camKet');
  const router = useRouter();
  const [dangChay, khoiDong] = useTransition();
  const [loi, datLoi] = useState<string | null>(null);

  // Chạy một action ghi LƯỢT: xoá lỗi cũ, gọi, nếu hỏng thì hiện câu tiếng người, xong thì làm mới.
  const ghi = (fn: () => Promise<LuotResult>) => {
    datLoi(null);
    khoiDong(async () => {
      const r = await fn();
      if (!r.ok) datLoi(r.error ?? tv('ghiLoi'));
      else router.refresh();
    });
  };

  // Tuần này còn ghi lượt được không: chỉ tuần hiện tại, chưa bị chốt bởi chữ ký họp bạn. Cửa sổ
  // 7 ngày và khoá chữ ký là luật RLS thật; cờ này chỉ để nút bấm nói đúng sự thật.
  const moTuan = laChinhEm && monday === thisMonday && !daChotHopTuan;
  const dauCuaSo = themNgay(today, -6);
  const moNgay = (d: string) => moTuan && d <= today && d >= dauCuaSo;

  return (
    <div className="flex flex-col gap-[22px]">
      {loi && (
        <p className="rounded-[12px] border border-status-bad/40 bg-status-bad/[0.08] px-3 py-2 text-[12.5px] font-bold text-status-bad">
          {loi}
        </p>
      )}

      {/* ④ VIỆC EM LÀM --------------------------------------------------------------------- */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-[17px] font-bold text-navy">
          <ListChecks size={18} strokeWidth={2.5} className="text-gold-deep" />
          {tb('khuViec')}
        </h2>
        {viec.length === 0 ? (
          <div className="glass rounded-[16px] p-5">
            <p className="text-[13px] font-semibold text-grey-mid">{tv('trong')}</p>
            <p className="mt-1 text-[12px] italic text-grey-mid">{tv('trongHint')}</p>
          </div>
        ) : (
          <div className="glass flex flex-col overflow-hidden rounded-[18px]">
            {viec.map((v, i) => (
              <HangViec
                key={v.thuoc_id}
                v={v}
                weekDays={weekDays}
                today={today}
                moNgay={moNgay}
                daChotHopTuan={daChotHopTuan}
                dangChay={dangChay}
                ghi={ghi}
                dayShort={dayShort}
                vien={i > 0}
                studentId={studentId}
                laChinhEm={laChinhEm}
              />
            ))}
          </div>
        )}
      </section>

      {/* ⑤ CAM KẾT TUẦN NÀY ---------------------------------------------------------------- */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-[17px] font-bold text-navy">
          <Flag size={18} strokeWidth={2.5} className="text-gold-deep" />
          {tb('khuCamKet')}
        </h2>
        {camKet.length === 0 ? (
          <div className="glass rounded-[16px] p-5">
            <p className="text-[13px] font-semibold text-grey-mid">{tc('trong')}</p>
            <p className="mt-1 text-[12px] italic text-grey-mid">{tc('trongHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {camKet.map((c) => (
              <TheCamKet key={c.id} c={c} studentId={studentId} laChinhEm={laChinhEm} tuanNghi={tuanNghi} today={today} />
            ))}
          </div>
        )}
        {/* Em tự đặt cam kết tuần của mình, hướng vào mục tiêu lớp để cùng đẩy nó lên. */}
        {laChinhEm && classId ? (
          <ThemCamKetEm studentId={studentId} classId={classId} monday={monday} mucTieuLop={mucTieuLop} />
        ) : null}
      </section>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ④ HÀNG VIỆC — 12 ô tuần + 7 ô ngày
// ══════════════════════════════════════════════════════════════════════════════════════════════
export function HangViec({
  v,
  weekDays,
  today,
  moNgay,
  daChotHopTuan,
  dangChay,
  ghi,
  dayShort,
  vien,
  studentId,
  laChinhEm = false,
  donViList = [],
}: {
  v: ViecEm;
  weekDays: string[];
  today: string;
  moNgay: (d: string) => boolean;
  daChotHopTuan: boolean;
  dangChay: boolean;
  ghi: (fn: () => Promise<LuotResult>) => void;
  dayShort: string[];
  vien: boolean;
  studentId?: string;
  laChinhEm?: boolean;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const tv = useTranslations('viec');
  const [oDien, datODien] = useState<string | null>(null);
  const [soDien, datSoDien] = useState('');
  const kieng = v.chieu_dich === 'nhieu_nhat';
  const heThong = v.cach_ghi === 'he_thong' || v.chi_xem;

  // Nhãn trạng thái nhỏ (Đủ / Chưa đủ / Đang làm / Nghỉ).
  let ttNhan = tv('dangChay');
  let ttMau = 'text-grey-mid';
  if (v.trang_thai === 'mien') {
    ttNhan = tv('oNghi');
  } else if (v.dat) {
    ttNhan = tv('du');
    ttMau = 'text-success-dark';
  } else if (v.trang_thai === 'chua_bat_dau') {
    ttNhan = tv('oChuaBatDau');
  } else {
    ttNhan = tv('chuaDu');
    ttMau = 'text-gold-text';
  }

  const kyNhan = v.ky_tuan === 2 ? tv('ky2Tuan') : v.ky_tuan === 4 ? tv('ky4Tuan') : tv('kyTuan');

  // TICK NHANH — cập nhật lạc quan: số nhảy NGAY tại chỗ, ghi lượt + làm mới chạy nền (không khoá
  // nút, không đợi cả trang tải lại). Khi rảnh (dangChay=false) thì dọn override để lấy số thật;
  // nếu ghi hỏng, ghi() không refresh → dọn override đưa về số cũ (tự lùi lại).
  const [luotLocal, datLuotLocal] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!dangChay) datLuotLocal({});
  }, [dangChay]);
  const napNgay = (d: string, giaTri: number) => {
    datLuotLocal((cu) => ({...cu, [d]: giaTri < 0 ? 0 : giaTri}));
    ghi(() => ghiLuot(v.thuoc_id, d, giaTri));
  };

  return (
    <div className={`px-3.5 py-3 ${vien ? 'border-t border-navy/10' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1 text-[14px] font-extrabold text-navy">{v.ten}</span>
        {v.chi_xem && (
          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10px] font-bold text-grey-mid">{tv('chipLop')}</span>
        )}
        <span className={`text-[11.5px] font-extrabold ${ttMau}`}>{ttNhan}</span>
        {laChinhEm && !v.chi_xem && studentId && (
          <SuaViecEm
            studentId={studentId}
            thuocId={v.thuoc_id}
            ten={v.ten}
            chiTieu={v.chi_tieu}
            ngayApDung={v.ngay_ap_dung}
            tenDonVi={v.ten_don_vi}
            cachGhi={v.cach_ghi}
            donViId={v.don_vi_id}
            donViList={donViList}
          />
        )}
      </div>
      <div className="mt-0.5 text-[11.5px] font-semibold text-grey-mid">
        {kieng
          ? tv('chiTieuKhongQua', {n: so(v.chi_tieu), dv: v.ten_don_vi || tv('donViNgay'), ky: kyNhan})
          : tv('chiTieu', {n: so(v.chi_tieu), dv: v.ten_don_vi || tv('donViNgay'), ky: kyNhan})}
        {' · '}
        {tv('tuanNayDuoc', {so: so(v.gia), n: so(v.chi_tieu), dv: v.ten_don_vi || tv('donViNgay')})}
      </div>

      {/* 12 ô tuần */}
      <div className="mt-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-grey-mid">{tv('muoiHaiTuan')}</div>
        <div className="mt-1 flex gap-[3px]">
          {v.muoiHaiTuan.map((w) => {
            let bg = 'bg-navy/[0.06]';
            if (!w.la_tuan_hoc) bg = 'bg-navy/[0.03]';
            else if (w.dat) bg = 'bg-success/70';
            else if (w.trang_thai === 'sat_nut') bg = 'bg-gold/70';
            else if (w.gia > 0) bg = 'bg-status-bad/50';
            return (
              <span
                key={w.tuan}
                className={`h-3.5 flex-1 rounded-[2px] ${bg}`}
                title={`${w.tuan}: ${so(w.gia)}/${so(w.chi_tieu)}`}
              />
            );
          })}
        </div>
      </div>

      {/* 7 ô ngày */}
      <div className="mt-2 grid grid-cols-7 gap-[3px]">
        {weekDays.map((d, i) => {
          const ap = v.ngay_ap_dung.includes(isoDowVN(d));
          const giaNgay = d in luotLocal ? luotLocal[d] : v.ngayLuot[d] ?? 0;
          const coSo = giaNgay > 0;
          const tuongLai = d > today;
          const moChinhNgay = moNgay(d) && ap && !heThong;

          if (!ap) {
            return (
              <div key={d} className="flex flex-col items-center">
                <span className="text-[9.5px] font-bold text-grey-mid/70">{dayShort[i]}</span>
                <span className="mt-0.5 grid h-8 w-full place-items-center rounded-[7px] bg-navy/[0.02] text-[10px] text-grey-mid/40">
                  ·
                </span>
              </div>
            );
          }

          const onClick = () => {
            if (!moChinhNgay) return;
            if (v.cach_ghi === 'dien') {
              datSoDien(coSo ? so(giaNgay) : '');
              datODien((cur) => (cur === d ? null : d));
            } else {
              napNgay(d, giaNgay + 1);
            }
          };

          return (
            <div key={d} className="flex flex-col items-center">
              <span className="text-[9.5px] font-bold text-grey-mid">{dayShort[i]}</span>
              <button
                type="button"
                disabled={!moChinhNgay}
                onClick={onClick}
                title={
                  tuongLai
                    ? tv('ngayTuongLai')
                    : daChotHopTuan
                      ? tv('ngayKhoaKy')
                      : !moNgay(d)
                        ? tv('ngayKhoa7')
                        : coSo
                          ? undefined
                          : tv('ngayChua')
                }
                className={`mt-0.5 grid h-8 w-full place-items-center rounded-[7px] text-[12px] font-extrabold transition ${
                  coSo
                    ? kieng
                      ? 'bg-status-bad/70 text-white'
                      : 'bg-success/80 text-white'
                    : moChinhNgay
                      ? 'border-[1.5px] border-dashed border-navy/25 text-navy hover:bg-navy/5'
                      : 'bg-navy/[0.03] text-grey-mid/40'
                } ${moChinhNgay ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                {coSo ? (
                  v.cach_ghi === 'cham' ? (
                    giaNgay
                  ) : (
                    so(giaNgay)
                  )
                ) : moChinhNgay ? (
                  <Plus size={13} strokeWidth={3} />
                ) : (
                  ''
                )}
              </button>
              {v.cach_ghi === 'cham' && coSo && moChinhNgay && (
                <button
                  type="button"
                  onClick={() => napNgay(d, giaNgay <= 1 ? -1 : giaNgay - 1)}
                  className="mt-0.5 grid h-4 w-full place-items-center rounded-[5px] text-grey-mid hover:text-status-bad"
                  title={tv('chamBot')}
                >
                  <Minus size={11} strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Khung điền số (controlled) cho ngày đang mở */}
      {oDien && (
        <div className="mt-2 rounded-[12px] border border-navy/10 bg-white/80 p-2.5">
          <label className="block text-[12px] font-bold text-navy">
            {kieng ? tv('kiengHoi', {ngay: ddmm(oDien)}) : tv('dienHoi', {ngay: ddmm(oDien), dv: v.ten_don_vi ?? ''})}
          </label>
          <p className="mt-0.5 text-[11px] italic text-grey-mid">{kieng ? tv('kiengNhac') : tv('dienKhong')}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              inputMode="decimal"
              value={soDien}
              onChange={(e) => datSoDien(e.target.value)}
              className="w-24 rounded-[9px] border-[1.5px] border-navy/15 px-2 py-1 text-[13px]"
            />
            <span className="text-[12px] font-semibold text-grey-mid">{v.ten_don_vi}</span>
            <button
              type="button"
              onClick={() => datODien(null)}
              className="ml-auto cursor-pointer rounded-[9px] px-2 py-1 text-[12px] font-bold text-grey-mid"
            >
              <X size={14} strokeWidth={3} />
            </button>
            <button
              type="button"
              disabled={soDien.trim() === ""}
              onClick={() => {
                const ngay = oDien;
                napNgay(ngay, Number(soDien));
                datODien(null);
              }}
              className="cursor-pointer rounded-[9px] bg-navy px-3 py-1 text-[12px] font-extrabold text-white disabled:opacity-50"
            >
              <Check size={14} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ⑤ THẺ CAM KẾT — em tự chấm Thắng/Thua qua <form action={chamCamKet}>
// ══════════════════════════════════════════════════════════════════════════════════════════════
export function TheCamKet({
  c,
  studentId,
  laChinhEm,
  tuanNghi,
  today,
}: {
  c: CamKetEm;
  studentId: string;
  laChinhEm: boolean;
  tuanNghi: boolean;
  today: string;
}) {
  const tc = useTranslations('camKet');
  const [soDat, datSoDat] = useState(c.so_hua != null ? so(c.so_hua) : '');

  const daCham = c.ket_qua != null;
  const chamMo = laChinhEm && !daCham && !tuanNghi;

  return (
    <div className="glass rounded-[16px] border-l-[3px] border-gold-mid p-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 flex-1 text-[14px] font-extrabold text-navy">{c.noi_dung}</span>
        {laChinhEm && !daCham && (
          <SuaCamKetEm studentId={studentId} camKetId={c.id} noiDung={c.noi_dung} soHua={c.so_hua} tenDonVi={c.ten_don_vi} />
        )}
        {c.so_hua != null && (
          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-bold text-navy">
            {tc('chipSo', {dat: so(c.so_dat ?? 0), hua: so(c.so_hua), dv: c.ten_don_vi ?? ''})}
          </span>
        )}
        {daCham ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
              c.ket_qua === 'thang' ? 'bg-success/15 text-success-dark' : 'bg-status-bad/[0.1] text-status-bad'
            }`}
          >
            {c.ket_qua === 'thang' ? tc('thang') : tc('thua')}
          </span>
        ) : (
          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-bold text-grey-mid">
            {tc('chuaCham')}
          </span>
        )}
      </div>

      {c.tenViec ? (
        <p className="mt-1 text-[11px] font-semibold text-grey-mid">{tc('giupViec', {ten: c.tenViec})}</p>
      ) : c.tenMucTieu ? (
        <p className="mt-1 text-[11px] font-semibold text-grey-mid">{tc('giupMucTieu', {ten: c.tenMucTieu})}</p>
      ) : c.lac_muc_tieu ? (
        <p className="mt-1 text-[11px] font-semibold italic text-grey-mid">{tc('lac')}</p>
      ) : null}

      {tuanNghi && <p className="mt-1 text-[11.5px] font-semibold italic text-grey-mid">{tc('nghi')}</p>}

      {laChinhEm && !daCham && !tuanNghi && (
        <div className="mt-2">
          {(
            <form action={chamCamKet} className="flex flex-col gap-1.5">
              <input type="hidden" name="student_id" value={studentId} />
              <input type="hidden" name="cam_ket_id" value={c.id} />
              {c.so_hua != null && (
                <div className="flex items-center gap-2">
                  <label className="text-[11.5px] font-bold text-navy">{tc('soDatHoi', {dv: c.ten_don_vi ?? ''})}</label>
                  <input
                    name="so_dat"
                    inputMode="decimal"
                    value={soDat}
                    onChange={(e) => datSoDat(e.target.value)}
                    className="w-20 rounded-[9px] border-[1.5px] border-navy/15 px-2 py-1 text-[13px]"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  name="ket_qua"
                  value="thang"
                  disabled={!chamMo}
                  className="cursor-pointer rounded-[9px] bg-success px-3 py-1 text-[12px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tc('thang')}
                </button>
                <button
                  type="submit"
                  name="ket_qua"
                  value="thua"
                  disabled={!chamMo}
                  className="cursor-pointer rounded-[9px] border-[1.5px] border-status-bad/40 px-3 py-1 text-[12px] font-extrabold text-status-bad disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tc('thua')}
                </button>
                {chamMo && (
                  <span className="text-[11px] font-semibold italic text-grey-mid">
                    {c.goi_y_may === 'thang'
                      ? tc('goiYThang', {so: so(c.so_dat_goi_y ?? 0), n: so(c.so_hua ?? 0)})
                      : c.goi_y_may === 'thua'
                        ? tc('goiYThua', {so: so(c.so_dat_goi_y ?? 0), n: so(c.so_hua ?? 0)})
                        : tc('goiYKhong')}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      {/* XÓA CAM KẾT — bỏ cam kết này KÈM lead measure của nó (doiCamKet: đánh dấu 'huy' để cam kết
          tự-lăn NGỪNG lăn dòng này + xoá thước đo dẫn dắt gắn nó). */}
      {laChinhEm && !daCham && (
        <form
          action={doiCamKet}
          onSubmit={(e) => {
            if (!window.confirm(tc('xoaHoi'))) e.preventDefault();
          }}
          className="mt-2 flex justify-end"
        >
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="cam_ket_id" value={c.id} />
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-grey-mid underline hover:text-status-bad"
          >
            {tc('xoaCamKet')}
          </button>
        </form>
      )}
    </div>
  );
}
