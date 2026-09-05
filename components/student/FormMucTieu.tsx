'use client';

import {useActionState, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Trash2, Lightbulb, Info, Check, HelpCircle, ChevronLeft, ChevronRight} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder, inputInline} from '@/components/ui/Field';
import {ONgayVN, ngayVN} from '@/components/ui/ONgayVN';
import {ChonCuon} from '@/components/ui/ChonCuon';
import {FormTaiCho, NutGui} from '@/components/ui/FormTaiCho';
import {AREAS} from '@/lib/areas';
import {luuMucTieu, xoaMucTieu, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';
import {xoaMucTieuLop} from '@/app/[locale]/(dashboard)/wig/lop-actions';
import type {Database} from '@/lib/database.types';

// ════════════════════════════════════════════════════════════════════════════════════════════
// FORM ĐẶT MỤC TIÊU — BA BƯỚC THẬT (04/09), trong một hộp thoại
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Audit 04/09: form một trang dài 1.330 px ở 360 px, nút Lưu nằm cuối 1,7 màn. Nay chia ba bước
// có chỉ báo, nút Tiếp/Quay lại và THANH NÚT DÍNH ĐÁY hộp — mỗi bước vừa một màn điện thoại:
//   ① Mục tiêu là gì?   → nhóm · tên · mô tả · hướng lên cấp trên
//   ② Đo thế nào?        → loại cột mốc · số/bước · ngày đến hạn
//   ③ Đọc lại & lưu      → câu ráp sống · chất lượng · Lưu / Lưu nháp
// Mọi giá trị mirror vào ô ẩn nên chuyển bước KHÔNG mất gì; máy chủ trả lỗi trỏ ô nào thì tự
// nhảy về bước chứa ô ấy. Ô controlled (bài học 31/08). Vẫn một action `luuMucTieu` (state).

type MucTieuV = Database['public']['Views']['muc_tieu_v']['Row'];

export type DonViChon = {id: string; ma: string; nhan?: string};
export type MonChon = {id: string; ten: string};
export type MucTieuLopChon = {id: string; ten: string; linh_vuc: string};
export type BuocChon = {tieu_de: string; phan_tram: number | null; bat_dau: string | null; ket_thuc: string | null; mo_ta: string | null};
export type BuocThe = BuocChon & {id: string; phan_tram: number; xong: boolean};
export type MauMucTieu = {
  id: string;
  ten: string;
  linh_vuc: string;
  subject_id: string | null;
  don_vi_id: string | null;
  kieu_dich: string;
  chieu: string;
  x_goi_y: number | null;
  y_goi_y: number | null;
};
export type DangSuaMt = MucTieuV | null;

// Suy CHIỀU của mục tiêu ĐO thẳng từ hai con số (chủ dự án 02/09): đích cao hơn = tăng, thấp hơn
// = giảm, bằng = giữ; chưa biết mức đầu thì mặc định tăng.
function suyTuSo(x: string, y: string, chuaX: boolean): {kieu_dich: string; chieu: string} {
  const xn = Number(x);
  const yn = Number(y);
  if (chuaX || x.trim() === '' || !Number.isFinite(xn)) return {kieu_dich: 'toi', chieu: 'tang'};
  if (Number.isFinite(yn) && yn < xn) return {kieu_dich: 'toi', chieu: 'giam'};
  if (Number.isFinite(yn) && yn === xn) return {kieu_dich: 'giu', chieu: 'giu'};
  return {kieu_dich: 'toi', chieu: 'tang'};
}

// Ô nào thuộc bước nào — máy chủ trả fieldError thì nhảy đúng bước.
const BUOC_CUA_O: Record<string, 1 | 2> = {ten: 1, ho_tro_cho: 1, don_vi_id: 2, x_so: 2, y_so: 2, y_chu: 2, buoc: 2, ket_thuc: 2, bat_dau: 2};

export function FormMucTieu3Buoc({
  studentId,
  classId,
  laChinhEm,
  tenEm,
  areaPreset,
  khoaLinhVuc = false,
  nhanTheoArea,
  donViList,
  monList = [],
  mauList = [],
  mucTieuLop = [],
  buocDangSua = [],
  dangSua = null,
  cap = 'em',
  campusId = '',
  laToi = false,
  onClose,
  onDone,
}: {
  studentId: string;
  classId: string;
  laChinhEm: boolean;
  cap?: 'em' | 'lop' | 'truong';
  campusId?: string;
  laToi?: boolean;
  tenEm?: string;
  areaPreset?: string;
  khoaLinhVuc?: boolean;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
  monList?: MonChon[];
  mauList?: MauMucTieu[];
  mucTieuLop?: MucTieuLopChon[];
  buocDangSua?: BuocChon[];
  dangSua?: DangSuaMt;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const t = useTranslations('mucTieu');
  const tf = useTranslations('formChung');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieu, {ok: false});

  const [buoc, setBuoc] = useState<1 | 2 | 3>(1);
  const [loiBuoc, setLoiBuoc] = useState<string | null>(null);
  const [ten, setTen] = useState(dangSua?.ten ?? '');
  const [linhVuc, setLinhVuc] = useState<string>(dangSua?.linh_vuc ?? areaPreset ?? AREAS[0]);
  const [monId, setMonId] = useState<string>(dangSua?.subject_id ?? '');
  const [x, setX] = useState(dangSua?.x_so != null ? String(dangSua.x_so) : '');
  const [y, setY] = useState(dangSua?.y_so != null ? String(dangSua.y_so) : '');
  const [donViId, setDonViId] = useState<string>(dangSua?.don_vi_id ?? '');
  const [donViMoi, setDonViMoi] = useState('');
  const [batDau] = useState(dangSua?.bat_dau ?? '');
  const [ketThuc, setKetThuc] = useState(dangSua?.ket_thuc ?? '');
  const hanGioi = (() => {
    const now = new Date();
    const y1 = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const p = (n: number) => String(n).padStart(2, '0');
    return {min: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`, max: `${y1 + 1}-07-31`};
  })();
  const [moTa, setMoTa] = useState(dangSua?.mo_ta ?? '');
  const [hoTroCho, setHoTroCho] = useState('');
  const [loaiMoc, setLoaiMoc] = useState<string>(dangSua?.loai_moc ?? 'do_luong');
  // 0193: mục tiêu LỚP/TRƯỜNG "đếm số em đạt mục tiêu (%)" — kiểu lớp hay đặt nhất ngoài đời
  // ("95% học sinh đạt mục tiêu cá nhân"). Bật thì đơn vị khoá '%', đích mặc định 95, máy tự đếm.
  const [demEm, setDemEm] = useState<boolean>(cap !== 'em' && dangSua?.nguon_so === 'dem_em');
  const dvPhanTram = donViList.find((d) => d.ma === 'phan_tram')?.id ?? '';
  function batDemEm(bat: boolean) {
    setDemEm(bat);
    if (bat && !y.trim()) setY('95');
  }
  type BuocItem = {tieu_de: string; phan_tram: string; bat_dau: string; ket_thuc: string; mo_ta: string};
  const buocRong = (): BuocItem => ({tieu_de: '', phan_tram: '', bat_dau: '', ket_thuc: '', mo_ta: ''});
  const [buocList, setBuocList] = useState<BuocItem[]>(
    (buocDangSua ?? []).map((b) => ({
      tieu_de: b.tieu_de,
      phan_tram: b.phan_tram != null ? String(b.phan_tram) : '',
      bat_dau: b.bat_dau ?? '',
      ket_thuc: b.ket_thuc ?? '',
      mo_ta: b.mo_ta ?? '',
    })),
  );
  const [moHelp, setMoHelp] = useState<string | null>(null);
  const [moSmart, setMoSmart] = useState(false);
  const [moChatLuong, setMoChatLuong] = useState(false);
  const [moMau, setMoMau] = useState(false);

  // Lưu xong thì ĐÓNG. Máy chủ trả lỗi trỏ ô → nhảy về bước chứa ô ấy.
  useEffect(() => {
    if (state.ok) {
      onDone?.(state.message ?? '');
      onClose();
      return;
    }
    if (state.fieldError && BUOC_CUA_O[state.fieldError]) setBuoc(BUOC_CUA_O[state.fieldError]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const suy = demEm ? {kieu_dich: 'toi', chieu: 'tang'} : suyTuSo(x, y, false);
  const nhanDv = demEm ? '%' : (donViList.find((d) => d.id === donViId)?.nhan ?? (donViId === '__khac__' ? donViMoi : ''));
  const laDo = loaiMoc === 'do_luong';
  const nguoiLon = laToi || cap !== 'em';
  const kNL = (k: string) => (nguoiLon ? `${k}NguoiLon` : k);
  const suG: string[] = [...AREAS];
  const tongBuoc = Math.round(buocList.reduce((s, b) => s + (Number(b.phan_tram) || 0), 0));

  // ── CHẤM CHẤT LƯỢNG (SMART) ─────────────────────────────────────────────────────────────
  const tieuChi = useMemo(() => {
    const tenLen = ten.trim().length;
    const yNum = Number(y);
    const xNum = Number(x);
    const list = [
      {key: 'clCuThe', dat: tenLen >= 10 && tenLen <= 120},
      {key: 'clDoDuoc', dat: laDo ? Boolean(y.trim()) && (Boolean(donViId) || demEm) : true},
      {
        key: 'clVuaSuc',
        dat: demEm
          ? yNum > 0 && yNum <= 100
          : !laDo || suy.chieu !== 'tang' || x.trim() === ''
            ? Boolean(y.trim()) || !laDo
            : Number.isFinite(yNum) && Number.isFinite(xNum) && yNum > xNum && yNum <= (xNum || 1) * 20,
      },
      {key: 'clLienKet', dat: Boolean(hoTroCho) || Boolean(dangSua)},
      {key: 'clCoHan', dat: Boolean(ketThuc)},
      {key: 'clCoMoTa', dat: moTa.trim().length >= 20},
    ];
    return list.filter((c) => {
      if (cap !== 'em' && c.key === 'clLienKet') return false;
      if (!laDo && (c.key === 'clDoDuoc' || c.key === 'clVuaSuc')) return false;
      return true;
    });
  }, [ten, y, x, donViId, hoTroCho, ketThuc, moTa, laDo, suy.chieu, dangSua, cap, demEm]);
  const soDat = tieuChi.filter((c) => c.dat).length;
  const phanTram = Math.round((soDat / tieuChi.length) * 100);

  // Câu ráp SỐNG — ghép từ chính những ô đã gõ.
  const cauRap = useMemo(() => {
    if (!ten.trim()) return null;
    if (cap === 'truong') return null;
    if (loaiMoc !== 'do_luong') return null;
    if (!y.trim() || !nhanDv || !ketThuc) return null;
    const ngay = ngayVN(ketThuc);
    if (demEm) return t('cauChotLopDemEm', {ten, y, ngay});
    const p = cap === 'lop' ? 'Lop' : '';
    if (suy.chieu === 'giu') return t(`cauChot${p}Giu`, {ten, dau: '≥', y, dv: nhanDv});
    if (!x.trim()) return t(`cauChot${p}ChuaX`, {ten, y, dv: nhanDv, ngay});
    return t(`cauChot${p}`, {ten, x, chieu: suy.chieu === 'giam' ? t('chieuGiam') : t('chieuTang'), y, dv: nhanDv, ngay});
  }, [ten, loaiMoc, suy.chieu, x, y, nhanDv, ketThuc, t, cap, demEm]);

  function chonMau(m: MauMucTieu) {
    setTen(m.ten);
    setLinhVuc(m.linh_vuc);
    setMonId(m.subject_id ?? '');
    setDonViId(m.don_vi_id ?? '');
    if (m.x_goi_y != null) setX(String(m.x_goi_y));
    if (m.y_goi_y != null) setY(String(m.y_goi_y));
    setMoMau(false);
  }
  const mauCuaLop = mauList.filter((m) => m.linh_vuc === linhVuc || !linhVuc);
  const hoTroBatBuoc = !dangSua && nguoiLon && mucTieuLop.length > 0;

  // Kiểm nhẹ ở máy — đủ để không sang bước sau với ô trống; máy chủ vẫn là luật thật.
  function kiemBuoc(b: 1 | 2): string | null {
    if (b === 1) {
      if (!ten.trim()) return tf('canTen');
      if (hoTroBatBuoc && !hoTroCho) return tf('canHoTro');
      return null;
    }
    if (loaiMoc === 'do_luong') {
      if (!y.trim() || Number(y) <= 0) return tf('canDich');
      if (demEm && Number(y) > 100) return tf('canDich');
      if (!demEm && (!donViId || (donViId === '__khac__' && !donViMoi.trim()))) return tf('canDonVi');
    }
    if (loaiMoc === 'ke_hoach') {
      if (buocList.filter((s) => s.tieu_de.trim()).length === 0 || tongBuoc !== 100) return tf('canBuoc');
    }
    if (!ketThuc) return tf('canHan');
    return null;
  }
  function tiep() {
    const l = kiemBuoc(buoc as 1 | 2);
    setLoiBuoc(l);
    if (!l) setBuoc((b) => (b === 1 ? 2 : 3));
  }
  function quayLai() {
    setLoiBuoc(null);
    setBuoc((b) => (b === 3 ? 2 : 1));
  }
  function nhayToi(b: 1 | 2 | 3) {
    // Đi lùi tự do; đi tới phải qua kiểm của các bước trước.
    if (b <= buoc) {
      setLoiBuoc(null);
      setBuoc(b);
      return;
    }
    for (let k = buoc; k < b; k++) {
      const l = kiemBuoc(k as 1 | 2);
      if (l) {
        setLoiBuoc(l);
        setBuoc(k as 1 | 2 | 3);
        return;
      }
    }
    setLoiBuoc(null);
    setBuoc(b);
  }

  const tieuDe =
    laToi
      ? dangSua
        ? t('formTitleSua')
        : t('formTitleToi')
      : cap === 'truong'
      ? t('formTitleTruong')
      : cap === 'lop'
      ? dangSua
        ? t('formTitleLopSua')
        : t('formTitleLop')
      : dangSua
        ? t('formTitleSua')
        : laChinhEm
          ? t('formTitle')
          : t('formTitleHo', {ten: tenEm ?? ''});

  const tenBuoc = [t('phanLaGi'), t('phanDoTheNao'), tf('docLai')];
  const nutPhu =
    'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1 rounded-[12px] border-2 border-navy bg-white px-4 text-than font-extrabold text-navy transition-colors hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

  return (
    <Popup title={tieuDe} onClose={onClose} width="max-w-[640px]">
      {/* CHỈ BÁO BƯỚC — bấm để lùi; tiến thì phải qua kiểm. */}
      <ol className="mb-3 grid grid-cols-3 gap-1.5" aria-label={tf('buocCua', {n: buoc})}>
        {tenBuoc.map((nhan, i) => {
          const so = (i + 1) as 1 | 2 | 3;
          const dangO = so === buoc;
          const daQua = so < buoc;
          return (
            <li key={so}>
              <button
                type="button"
                onClick={() => nhayToi(so)}
                aria-current={dangO ? 'step' : undefined}
                className={`flex min-h-[44px] w-full items-center gap-1.5 rounded-[12px] border-[1.5px] px-2 text-left text-chu-thich font-extrabold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  dangO ? 'border-navy bg-navy text-white' : daQua ? 'border-success/40 bg-success/[0.10] text-success-dark' : 'border-navy/15 bg-white text-grey-mid'
                }`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-chu-thich ${dangO ? 'bg-white/20' : daQua ? 'bg-success text-white' : 'bg-navy/10'}`}>
                  {daQua ? <Check size={12} strokeWidth={2.5} /> : so}
                </span>
                <span className="min-w-0 truncate">{nhan}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <form action={formAction} className="flex flex-col gap-3">
        {/* ── Ô ẨN: mọi giá trị mirror vào đây nên đổi bước không mất gì ── */}
        <input type="hidden" name="cap" value={cap} />
        <input type="hidden" name="student_id" value={cap === 'em' ? studentId : ''} />
        <input type="hidden" name="class_id" value={classId} />
        {cap === 'truong' && <input type="hidden" name="campus_id" value={campusId} />}
        {dangSua && <input type="hidden" name="muc_tieu_id" value={dangSua.id ?? ''} />}
        {buoc !== 1 && <input type="hidden" name="ten" value={ten} />}
        <input type="hidden" name="linh_vuc" value={linhVuc} />
        <input type="hidden" name="subject_id" value={monId} />
        <input type="hidden" name="kieu_dich" value={suy.kieu_dich} />
        <input type="hidden" name="chieu" value={suy.chieu} />
        <input type="hidden" name="ky" value="" />
        <input type="hidden" name="nguon_so" value={demEm ? 'dem_em' : 'ghi_tay'} />
        <input type="hidden" name="chua_do_x" value={!demEm && x.trim() === '' ? '1' : ''} />
        <input type="hidden" name="x_so" value={demEm ? '0' : x} />
        <input type="hidden" name="y_so" value={y} />
        <input type="hidden" name="y_chu" value="" />
        <input type="hidden" name="don_vi_id" value={demEm ? dvPhanTram : donViId} />
        {buoc !== 2 && !demEm && donViId === '__khac__' && <input type="hidden" name="don_vi_moi" value={donViMoi} />}
        <input type="hidden" name="bat_dau" value={batDau} />
        <input type="hidden" name="ket_thuc" value={ketThuc} />
        <input type="hidden" name="mo_ta" value={moTa} />
        <input type="hidden" name="loai_moc" value={loaiMoc} />
        {loaiMoc === 'ke_hoach' && (
          <input
            type="hidden"
            name="buoc_json"
            value={JSON.stringify(
              buocList
                .filter((b) => b.tieu_de.trim())
                .map((b) => ({
                  tieu_de: b.tieu_de.trim(),
                  phan_tram: Number(b.phan_tram) || 0,
                  bat_dau: b.bat_dau || undefined,
                  ket_thuc: b.ket_thuc || undefined,
                  mo_ta: b.mo_ta || undefined,
                })),
            )}
          />
        )}
        {!dangSua && <input type="hidden" name="ho_tro_cho" value={hoTroCho} />}
        {hoTroBatBuoc && <input type="hidden" name="ho_tro_bat_buoc" value="1" />}

        {state.error && !state.fieldError && (
          <p data-kiem="mt-loi" role="alert" className="inline-flex items-start gap-1.5 rounded-[12px] bg-status-bad/[0.08] px-2.5 py-2 text-chu-thich font-bold text-status-bad">
            <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}

        {/* ═══════════ BƯỚC 1 · MỤC TIÊU LÀ GÌ? ═══════════ */}
        {buoc === 1 && (
          <div className="flex flex-col gap-3">
            {mauCuaLop.length > 0 && !dangSua && (
              <div className="rounded-[12px] bg-gold/[0.10] p-2.5">
                <button type="button" data-kiem="mt-chon-mau" onClick={() => setMoMau((v) => !v)} className="min-h-[32px] text-than font-extrabold text-gold-text underline">
                  {t('themTuMau')}
                </button>
                {moMau && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {mauCuaLop.map((m) => (
                      <button key={m.id} type="button" data-kiem="mt-mau" data-id={m.id} onClick={() => chonMau(m)} className="min-h-[44px] rounded-[12px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-left text-than font-bold text-navy hover:border-navy">
                        {m.ten}
                      </button>
                    ))}
                    <p className="text-chu-thich font-semibold text-grey-mid">{t('mauKhoa')}</p>
                  </div>
                )}
              </div>
            )}

            {/* NHÓM — 4 chip; mở từ (+) của một ô lĩnh vực thì KHOÁ nhóm ấy. */}
            <div>
              <p className="mb-1.5 text-chu-thich font-bold text-grey-mid">{t('linhVuc')}</p>
              {khoaLinhVuc && !dangSua ? (
                <span data-kiem="mt-buoc-1" className="inline-flex items-center rounded-full bg-navy/[0.06] px-3 py-1 text-than font-extrabold text-navy">
                  {nhanTheoArea[linhVuc] ?? linhVuc}
                </span>
              ) : (
                <div data-kiem="mt-buoc-1" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {suG.map((a) => (
                    <OChon key={a} chon={linhVuc === a} onClick={() => setLinhVuc(a)} nhan={nhanTheoArea[a] ?? a} kiem="mt-linh-vuc" />
                  ))}
                </div>
              )}
              {monList.length > 0 && (
                <div className="mt-2">
                  <Field label={t('mon')} htmlFor="mt-mon">
                    <ChonCuon id="mt-mon" name="_mon_ui" value={monId} onChange={setMonId} danhSach={monList.map((m) => ({ma: m.id, nhan: m.ten}))} chuaChon={t('monChon')} />
                  </Field>
                </div>
              )}
            </div>

            {/* TÊN — kèm đèn gợi ý SMART. */}
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <label htmlFor="mt-ten" className="text-chu-thich font-bold text-grey-mid">{t('nhapMucTieu')}</label>
                <button type="button" data-kiem="mt-smart" onClick={() => setMoSmart((v) => !v)} aria-label={t('smartTitle')} aria-expanded={moSmart} className="grid h-11 w-11 cursor-pointer place-items-center rounded-full text-gold-deep hover:bg-gold/20 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  <Lightbulb size={16} strokeWidth={2.5} />
                </button>
              </div>
              {moSmart && (
                <div className="mb-2 rounded-[12px] bg-gold/[0.12] p-2.5 text-chu-thich font-semibold leading-relaxed text-navy">
                  <p className="mb-1 font-extrabold">{t('smartTitle')}</p>
                  <ul className="ml-3.5 list-disc space-y-0.5">
                    <li>{t('smartS')}</li>
                    <li>{t('smartM')}</li>
                    <li>{t('smartA')}</li>
                    <li>{t('smartR')}</li>
                    <li>{t('smartT')}</li>
                  </ul>
                  <p className="mt-1.5">{t('smartCongThuc')}</p>
                  <p className="mt-1 italic text-grey-mid">{t('smartVd')}</p>
                </div>
              )}
              <input
                id="mt-ten"
                data-kiem="mt-ten"
                name="ten"
                value={ten}
                onChange={(e) => setTen(e.target.value)}
                placeholder={t('tenPh')}
                maxLength={200}
                aria-invalid={err('ten') || (loiBuoc && !ten.trim()) ? true : undefined}
                aria-describedby={err('ten') ? 'mt-ten-loi' : loiBuoc && !ten.trim() ? 'mt-loi-buoc' : undefined}
                className={ctlWithBorder(state.fieldError === 'ten')}
                autoFocus
              />
              {err('ten') && (
                <p id="mt-ten-loi" role="alert" className="mt-1 text-chu-thich font-bold text-status-bad">
                  {err('ten')}
                </p>
              )}
            </div>

            <Field label={t('moTa')} htmlFor="mt-mo-ta" error={err('mo_ta')}>
              <textarea id="mt-mo-ta" data-kiem="mt-mo-ta" value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder={t(laToi ? 'moTaPhToi' : cap === 'lop' ? 'moTaPhLop' : cap === 'truong' ? 'moTaPhTruong' : 'moTaPh')} rows={2} maxLength={1000} className={ctlWithBorder(!!err('mo_ta'))} />
            </Field>

            {/* HƯỚNG LÊN CẤP TRÊN — em/tôi → mục tiêu lớp; lớp → mục tiêu trường. Người lớn: bắt buộc. */}
            {!dangSua && mucTieuLop.length > 0 && (
              <Field label={cap === 'lop' ? t('huongTruongCho') : t('hoTroCho')} htmlFor="mt-ho-tro" error={err('ho_tro_cho')}>
                <ChonCuon id="mt-ho-tro" name="_ho_tro_ui" value={hoTroCho} onChange={setHoTroCho} danhSach={mucTieuLop.map((m) => ({ma: m.id, nhan: m.ten}))} chuaChon={cap === 'lop' ? t('huongTruongChon') : t('hoTroChon')} loi={state.fieldError === 'ho_tro_cho'} />
                <span data-kiem="mt-ho-tro" className="hidden" />
                {cap !== 'lop' && <p className="mt-1 text-chu-thich font-semibold text-grey-mid">{t(laToi ? 'hoTroGiaiThichToi' : 'hoTroGiaiThich')}</p>}
              </Field>
            )}
          </div>
        )}

        {/* ═══════════ BƯỚC 2 · ĐO THẾ NÀO? ═══════════ */}
        {buoc === 2 && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-1.5 text-chu-thich font-bold text-grey-mid">{t('loaiMocLabel')}</p>
              <div data-kiem="mt-loai-moc" className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                {[
                  {ma: 'do_luong', nhan: t('mocDoLuong'), kiem: 'mt-moc-do-luong'},
                  {ma: 'hanh_dong', nhan: t('mocHanhDong'), kiem: 'mt-moc-hanh-dong'},
                  {ma: 'ke_hoach', nhan: t('mocKeHoach'), kiem: 'mt-moc-ke-hoach'},
                ].map((o) => (
                  <div key={o.ma} className="relative">
                    <OChon chon={loaiMoc === o.ma} onClick={() => setLoaiMoc(o.ma)} nhan={o.nhan} kiem={o.kiem} />
                    <button type="button" data-kiem={`${o.kiem}-help`} onClick={() => setMoHelp((v) => (v === o.ma ? null : o.ma))} aria-label={t('giaiThichLoai', {loai: o.nhan})} aria-expanded={moHelp === o.ma} className="absolute right-0 top-0 grid h-11 w-11 cursor-pointer place-items-center rounded-full text-grey-mid transition-colors hover:bg-navy/10 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                      <HelpCircle size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
              {moHelp ? (
                <p data-kiem="mt-loai-giai" className="mt-1.5 rounded-[12px] bg-gold/[0.12] px-2.5 py-2 text-chu-thich font-semibold leading-relaxed text-navy">
                  {moHelp === 'do_luong' ? t(kNL('mocDoLuongGiai')) : moHelp === 'hanh_dong' ? t(kNL('mocHanhDongGiai')) : t(kNL('mocKeHoachGiai'))}
                </p>
              ) : (
                <p className="mt-1 text-chu-thich font-semibold text-grey-mid">
                  {loaiMoc === 'do_luong' ? t('mocDoLuongGt') : loaiMoc === 'hanh_dong' ? t('mocHanhDongGt') : t('mocKeHoachGt')}
                </p>
              )}
            </div>

            {loaiMoc === 'hanh_dong' && (
              <p className="rounded-[12px] bg-navy/[0.05] px-2.5 py-2 text-chu-thich font-semibold text-grey-mid">{t('mocHanhDongNote')}</p>
            )}

            {loaiMoc === 'ke_hoach' && (
              <div data-kiem="mt-cac-buoc" className="rounded-[16px] border-[1.5px] border-navy/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-chu-thich font-bold text-grey-mid">{t('cacBuoc')}</p>
                  <span className={`text-chu-thich font-extrabold ${tongBuoc === 100 ? 'text-success' : 'text-status-bad'}`}>{tongBuoc}%</span>
                </div>
                <div className="flex flex-col gap-2">
                  {buocList.map((b, i) => (
                    <div key={i} className="rounded-[12px] border-[1.5px] border-navy/10 p-2">
                      <div className="flex items-center gap-1.5">
                        <input value={b.tieu_de} onChange={(e) => setBuocList((l) => l.map((s, j) => (j === i ? {...s, tieu_de: e.target.value} : s)))} placeholder={t('buocTieuDePh')} maxLength={200} data-kiem="mt-buoc-ten" className={`${inputInline} min-w-0 flex-1`} />
                        <input value={b.phan_tram} onChange={(e) => setBuocList((l) => l.map((s, j) => (j === i ? {...s, phan_tram: e.target.value} : s)))} type="number" min="0" max="100" inputMode="numeric" placeholder="%" aria-label={t('buocPhanTram')} className={`${inputInline} w-16`} />
                        <span className="text-chu-thich font-bold text-grey-mid">%</span>
                        <button type="button" onClick={() => setBuocList((l) => l.filter((_, j) => j !== i))} aria-label={t('buocXoa')} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-status-bad hover:bg-status-bad/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                          <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" data-kiem="mt-them-buoc" onClick={() => setBuocList((l) => [...l, buocRong()])} className="mt-2 inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-[12px] border-[1.5px] border-dashed border-navy/25 px-3 text-chu-thich font-extrabold text-navy hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  + {t('themBuoc')}
                </button>
                {err('buoc') && <p className="mt-1.5 text-chu-thich font-bold text-status-bad">{err('buoc')}</p>}
              </div>
            )}

            {/* 0193: lớp/trường có thể ĐẾM số em đạt thay vì đo một con số — bật là khoá '%', đích 95. */}
            {loaiMoc === 'do_luong' && cap !== 'em' && (
              <label data-kiem="mt-dem-em" className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2 has-[:checked]:border-navy has-[:checked]:bg-gold/[0.10]">
                <input type="checkbox" checked={demEm} onChange={(e) => batDemEm(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-navy)]" />
                <span className="flex flex-col gap-0.5">
                  <span className="text-than font-extrabold text-navy">{t('demEmToggle')}</span>
                  <span className="text-chu-thich font-semibold leading-relaxed text-grey-mid">{t(cap === 'truong' ? 'demEmHintTruong' : 'demEmHint')}</span>
                </span>
              </label>
            )}

            {loaiMoc === 'do_luong' && demEm && (
              <div data-kiem="mt-buoc-2" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <Field label={t('demEmY')} htmlFor="mt-y" error={err('y_so')}>
                  <div className="flex items-center gap-2">
                    <input id="mt-y" data-kiem="mt-y" type="number" step="1" min="1" max="100" inputMode="numeric" value={y} onChange={(e) => setY(e.target.value)} className={ctlWithBorder(state.fieldError === 'y_so')} />
                    <span className="shrink-0 text-than font-extrabold text-navy">%</span>
                  </div>
                </Field>
              </div>
            )}

            {loaiMoc === 'do_luong' && !demEm && (
              <div data-kiem="mt-buoc-2" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <Field label={t('donViSao')} htmlFor="mt-don-vi" error={err('don_vi_id')}>
                  <ChonCuon id="mt-don-vi" name="_don_vi_ui" value={donViId} onChange={setDonViId} danhSach={[...donViList.map((d) => ({ma: d.id, nhan: d.nhan})), {ma: '__khac__', nhan: t('donViKhac')}]} chuaChon={t('donViChon')} loi={state.fieldError === 'don_vi_id'} />
                  {donViId === '__khac__' && (
                    <input name="don_vi_moi" value={donViMoi} onChange={(e) => setDonViMoi(e.target.value)} maxLength={30} placeholder={t('donViMoiHoi')} className={`${ctlWithBorder(false)} mt-1.5`} />
                  )}
                  <span data-kiem="mt-don-vi" className="hidden" />
                </Field>
                <Field label={t('giaTriBanDau')} htmlFor="mt-x" error={err('x_so')}>
                  <input id="mt-x" data-kiem="mt-x" type="number" step="any" min="0" inputMode="decimal" value={x} onChange={(e) => setX(e.target.value)} placeholder="0" className={ctlWithBorder(state.fieldError === 'x_so')} />
                </Field>
                <Field label={t('giaTriMucTieu')} htmlFor="mt-y" error={err('y_so')}>
                  <input id="mt-y" data-kiem="mt-y" type="number" step="any" min="0.01" inputMode="decimal" value={y} onChange={(e) => setY(e.target.value)} className={ctlWithBorder(state.fieldError === 'y_so')} />
                </Field>
              </div>
            )}

            <Field label={t('ngayDenHan')} error={err('ket_thuc')} hint={t('ngayDenHanNhac', {min: ngayVN(hanGioi.min), max: ngayVN(hanGioi.max)})}>
              <span data-kiem="mt-han" className="block max-w-[220px]">
                <ONgayVN name="_ket_thuc_ui" nhan={t('ngayDenHan')} value={ketThuc} loi={state.fieldError === 'ket_thuc'} onChange={setKetThuc} min={hanGioi.min} max={hanGioi.max} />
              </span>
            </Field>
          </div>
        )}

        {/* ═══════════ BƯỚC 3 · ĐỌC LẠI & LƯU ═══════════ */}
        {buoc === 3 && (
          <div className="flex flex-col gap-3">
            <div data-kiem="mt-buoc-3">
              <p className="mb-1.5 text-than font-extrabold text-navy">{t(kNL('buoc3'))}</p>
              <div data-kiem="mt-cau-rap-lai" className={`rounded-[16px] px-3.5 py-3 text-than font-bold leading-relaxed ${cauRap ? 'bg-gold/[0.14] text-navy' : 'bg-navy/[0.04] italic text-grey-mid'}`}>
                {cauRap ?? t(kNL('cauChotTrong'))}
              </div>
              {/* Tóm tắt những gì đã chọn — nhìn là biết, không phải lùi bước. */}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-chu-thich">
                <dt className="font-extrabold text-grey-mid">{t('linhVuc')}</dt>
                <dd className="font-bold text-navy">{nhanTheoArea[linhVuc] ?? linhVuc}</dd>
                <dt className="font-extrabold text-grey-mid">{t('nhapMucTieu')}</dt>
                <dd className="font-bold text-navy">{ten}</dd>
                <dt className="font-extrabold text-grey-mid">{t('loaiMocLabel')}</dt>
                <dd className="font-bold text-navy">
                  {loaiMoc === 'do_luong' ? (demEm ? t('demEmTomTat', {y}) : `${t('mocDoLuong')} · ${x || '0'} → ${y} ${nhanDv}`) : loaiMoc === 'hanh_dong' ? t('mocHanhDong') : `${t('mocKeHoach')} · ${buocList.filter((s) => s.tieu_de.trim()).length} ${t('cacBuoc').toLowerCase()}`}
                </dd>
                <dt className="font-extrabold text-grey-mid">{t('ngayDenHan')}</dt>
                <dd className="font-bold text-navy">{ketThuc ? ngayVN(ketThuc) : '—'}</dd>
              </dl>
            </div>

            <div className="rounded-[12px] border-[1.5px] border-navy/10 p-2.5">
              <button type="button" data-kiem="mt-chat-luong" onClick={() => setMoChatLuong((v) => !v)} aria-expanded={moChatLuong} className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <span className="flex gap-0.5">
                  {tieuChi.map((c, i) => (
                    <span key={i} className={`h-2 w-4 rounded-full ${c.dat ? 'bg-success' : 'bg-navy/15'}`} />
                  ))}
                </span>
                <span className="text-than font-extrabold text-navy">{t('chatLuong')} · {phanTram}%</span>
                <Info size={14} strokeWidth={2.5} className="ml-auto text-grey-mid" />
              </button>
              {moChatLuong && (
                <div className="mt-2 flex flex-col gap-1.5 border-t border-navy/10 pt-2">
                  <p className="text-chu-thich font-semibold text-grey-mid">{t('chatLuongMo')}</p>
                  {tieuChi.map((c) => (
                    <div key={c.key} className="flex items-start gap-1.5 text-chu-thich font-semibold">
                      <span className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full ${c.dat ? 'bg-success text-white' : 'border-[1.5px] border-navy/25 text-transparent'}`}>
                        <Check size={12} strokeWidth={2.5} />
                      </span>
                      <span className={c.dat ? 'text-grey-mid line-through' : 'text-navy'}>{t(c.key)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {loiBuoc && (
          <p id="mt-loi-buoc" role="alert" className="inline-flex items-start gap-1.5 rounded-[12px] bg-status-bad/[0.08] px-2.5 py-2 text-chu-thich font-bold text-status-bad">
            <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
            {loiBuoc}
          </p>
        )}

        {/* THANH NÚT DÍNH ĐÁY — ở 360 px không phải cuộn xuống 1,7 màn mới thấy nút. */}
        <div className="sticky bottom-[-18px] z-10 -mx-[18px] mt-1 flex flex-wrap items-center gap-2 border-t border-navy/10 bg-white/95 px-[18px] py-3 backdrop-blur-sm">
          {buoc > 1 ? (
            <button type="button" onClick={quayLai} className={nutPhu}>
              <ChevronLeft size={14} strokeWidth={2.5} />
              {tf('quayLai')}
            </button>
          ) : (
            <button type="button" onClick={onClose} className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-[12px] border-2 border-grey-mid/40 bg-white px-4 text-than font-extrabold text-grey-mid transition-colors hover:bg-navy/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              {t('thoi')}
            </button>
          )}
          <span className={`${buoc < 3 ? 'ml-auto' : ''} text-chu-thich font-extrabold text-grey-mid`}>{tf('buocCua', {n: buoc})}</span>
          {buoc < 3 ? (
            <button type="button" data-kiem="mt-tiep" onClick={tiep} className="btn-gold inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1 rounded-[12px] px-4 text-than font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy">
              {tf('tiep')}
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          ) : (
            // Hai nút lưu đi chung một cụm để ở 360px chúng xuống dòng cùng nhau, canh phải — không
            // để "Lưu" rớt lẻ loi sang trái hàng dưới.
            <span className="ml-auto flex flex-wrap justify-end gap-2">
              <button type="submit" name="action" value="nhap" className={nutPhu}>
                {t('luuNhap')}
              </button>
              <SubmitButton className="btn-gold min-h-[44px] rounded-[12px] px-4 text-than font-extrabold" name="action" value="gui" wrapClass="contents">
                <span data-kiem="mt-gui">{laChinhEm ? t('gui') : t('luu')}</span>
              </SubmitButton>
            </span>
          )}
        </div>
      </form>

      {/* XOÁ — trong hộp Sửa (tại chỗ, có hộp xác nhận). RLS quyết được xoá hay không. */}
      {dangSua && (laChinhEm || cap === 'lop') && (
        <div className="mt-2 flex justify-end">
          <FormTaiCho action={cap === 'lop' ? xoaMucTieuLop : xoaMucTieu} xacNhan={t('xoaHoi')} nhanXacNhan={t('xoa')} nguyHiem anThanhCong onOk={() => onClose()} className="flex flex-col items-end gap-1">
            <input type="hidden" name="muc_tieu_id" value={dangSua.id ?? ''} />
            {cap === 'lop' ? <input type="hidden" name="class_id" value={classId} /> : <input type="hidden" name="student_id" value={studentId} />}
            <NutGui className="inline-flex cursor-pointer items-center gap-1 rounded-[12px] px-3 text-chu-thich font-extrabold text-status-bad hover:bg-status-bad/[0.08] focus-visible:ring-2 focus-visible:ring-gold">
              <Trash2 size={12} strokeWidth={2.5} />
              {t('xoa')}
            </NutGui>
          </FormTaiCho>
        </div>
      )}
    </Popup>
  );
}

// Một ô chọn kiểu "chip lớn" — bấm nhanh trên điện thoại (≥ 44 px).
function OChon({chon, onClick, nhan, kiem}: {chon: boolean; onClick: () => void; nhan: string; kiem?: string}) {
  return (
    <button
      type="button"
      data-kiem={kiem}
      onClick={onClick}
      aria-pressed={chon}
      className={`min-h-[44px] w-full cursor-pointer rounded-[12px] border-[1.5px] px-2.5 py-2 text-than font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        chon ? 'border-navy bg-navy/[0.06] text-navy' : 'border-navy/15 bg-white text-grey-mid hover:border-navy/40'
      }`}
    >
      {nhan}
    </button>
  );
}

// Giữ tên cũ cho các nơi còn import.
export {FormMucTieu3Buoc as FormMucTieu};
