'use client';

import {useActionState, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AlertCircle, Trash2, Lightbulb, Info, Check, ArrowUp, ArrowDown, ArrowRight} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder, inputInline} from '@/components/ui/Field';
import {ONgayVN, ngayVN} from '@/components/ui/ONgayVN';
import {schoolYearRangeVN} from '@/lib/dates';
import {ChonCuon} from '@/components/ui/ChonCuon';
import {AREAS} from '@/lib/areas';
import {luuMucTieu, xoaMucTieu, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';
import type {Database} from '@/lib/database.types';

// ════════════════════════════════════════════════════════════════════════════════════════════
// FORM ĐẶT MỤC TIÊU — BA BƯỚC, nằm trong một hộp thoại (PA2, 40-MAN-HINH §B ③ + §F4)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mô hình cũ (wigs/lead_measures) đã DROP. Form này ghi vào `muc_tieu` (cap='em') qua action
// `luuMucTieu`. Ba bước theo cách một em lớp 5 nghĩ về mục tiêu:
//   ① Em muốn tiến bộ ở việc gì?           → tên + lĩnh vực (+ môn nếu có)
//   ② Từ đâu tới đâu, trước ngày nào?       → cách đo (đếm/đo), hướng (lên/giữ/bớt), X→Y, đơn vị, hạn
//   ③ Đọc lại câu mục tiêu                   → câu ráp SỐNG từ chính chữ em gõ, rồi Gửi
//
// Vì sao là HỘP THOẠI: form chỉ dùng vài lần một năm, còn màn của em mở mỗi ngày — để nó nằm sẵn
// giữa trang thì mỗi ngày em phải cuộn qua một form trống mới tới việc hôm nay (chủ dự án 12/08).
//
// Mọi ô CONTROLLED (value+onChange) và KHÔNG mất chữ khi máy chủ trả lỗi (bài học useActionState
// 31/08): React dọn trắng ô không kiểm soát sau mỗi lần gửi. Câu lỗi trỏ đúng ô qua state.fieldError.

type MucTieuV = Database['public']['Views']['muc_tieu_v']['Row'];

/** Đơn vị chọn từ bảng `don_vi` (H-17: em không tự thêm, thiếu thì nhờ thầy cô). */
export type DonViChon = {id: string; ma: string; nhan?: string};
/** Môn học để gắn (không bắt buộc). */
export type MonChon = {id: string; ten: string};
/** Mục tiêu lớp để em hướng tới — hiển thị/nối ở THẺ, không ở form (dây cần id mục tiêu sau khi tạo). */
export type MucTieuLopChon = {id: string; ten: string; linh_vuc: string};
/** Một bước của cột mốc kế hoạch (để prefill khi sửa). */
export type BuocChon = {tieu_de: string; phan_tram: number | null; bat_dau: string | null; ket_thuc: string | null; mo_ta: string | null};
/** Bước kèm id + trạng thái xong — cho checklist tick trên thẻ mục tiêu (bao trùm BuocChon). */
export type BuocThe = BuocChon & {id: string; phan_tram: number; xong: boolean};
/** Mẫu mục tiêu của lớp (`muc_tieu_mau`) — em chọn rồi chỉ điền số. */
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

// Suy CHIỀU của mục tiêu ĐO thẳng từ hai con số em gõ — không bắt em chọn tăng/giữ/giảm nữa (chủ
// dự án 02/09: "tăng hay giảm hay giữ thì nhìn số đầu số cuối là ra"). Đích cao hơn = tăng, thấp
// hơn = giảm, bằng nhau = giữ; chưa biết mức đầu thì mặc định tăng. Mọi tổ hợp hợp lệ với ràng
// buộc mt_chieu_thuan_ck (toi: tăng cần x<y, giảm cần x>y; giữ dùng kieu_dich riêng nên không vướng).
function suyTuSo(x: string, y: string, chuaX: boolean): {kieu_dich: string; chieu: string} {
  const xn = Number(x);
  const yn = Number(y);
  if (chuaX || x.trim() === '' || !Number.isFinite(xn)) return {kieu_dich: 'toi', chieu: 'tang'};
  if (Number.isFinite(yn) && yn < xn) return {kieu_dich: 'toi', chieu: 'giam'};
  if (Number.isFinite(yn) && yn === xn) return {kieu_dich: 'giu', chieu: 'giu'};
  return {kieu_dich: 'toi', chieu: 'tang'};
}

export function FormMucTieu3Buoc({
  studentId,
  classId,
  laChinhEm,
  tenEm,
  areaPreset,
  nhanTheoArea,
  donViList,
  monList = [],
  mauList = [],
  mucTieuLop = [],
  buocDangSua = [],
  dangSua = null,
  onClose,
  onDone,
}: {
  studentId: string;
  classId: string;
  laChinhEm: boolean;
  /** Tên em — chỉ khi thầy cô gõ giúp, để tiêu đề nói rõ đang gõ cho ai. */
  tenEm?: string;
  /** Lĩnh vực của ô em vừa bấm ở màn ngoài (mặc định lĩnh vực đầu). */
  areaPreset?: string;
  /** Nhãn 4 lĩnh vực đã dịch (từ area_config). */
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
  monList?: MonChon[];
  mauList?: MauMucTieu[];
  /** Mục tiêu của lớp để em chọn "Hỗ trợ cho" (chỉ dùng khi TẠO MỚI; sửa thì quản ở thẻ). */
  mucTieuLop?: MucTieuLopChon[];
  /** Các bước của cột mốc kế hoạch đang sửa (prefill khi sửa mục tiêu loại kế hoạch). */
  buocDangSua?: BuocChon[];
  dangSua?: DangSuaMt;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const t = useTranslations('mucTieu');
  const locale = useLocale();
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieu, {ok: false});

  const [ten, setTen] = useState(dangSua?.ten ?? '');
  const [linhVuc, setLinhVuc] = useState<string>(dangSua?.linh_vuc ?? areaPreset ?? AREAS[0]);
  const [monId, setMonId] = useState<string>(dangSua?.subject_id ?? '');
  const [chuaDoX, setChuaDoX] = useState(dangSua?.chua_do_x ?? false);
  const [x, setX] = useState(dangSua?.x_so != null ? String(dangSua.x_so) : '');
  const [y, setY] = useState(dangSua?.y_so != null ? String(dangSua.y_so) : '');
  const [donViId, setDonViId] = useState<string>(dangSua?.don_vi_id ?? '');
  // Không còn ô chọn ngày bắt đầu — giữ giá trị cũ khi sửa, còn tạo mới thì để trống (máy chủ
  // lấy hôm nay). Không có setter vì màn của em không đổi ngày bắt đầu nữa.
  const [batDau] = useState(dangSua?.bat_dau ?? '');
  const [ketThuc, setKetThuc] = useState(dangSua?.ket_thuc ?? '');
  const [moTa, setMoTa] = useState(dangSua?.mo_ta ?? '');
  // "Hỗ trợ cho" — chỉ khi tạo mới (sửa dây thì làm ở thẻ). Lọc theo lĩnh vực để gọn.
  const [hoTroCho, setHoTroCho] = useState('');
  // LOẠI CỘT MỐC (0172): đo lường / hành động / kế hoạch.
  const [loaiMoc, setLoaiMoc] = useState<string>(dangSua?.loai_moc ?? 'do_luong');
  // Các bước của cột mốc kế hoạch (form dòng, cộng dồn 100%).
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
  // SMART tooltip + bảng chấm chất lượng mở/đóng.
  const [moSmart, setMoSmart] = useState(false);
  const [moChatLuong, setMoChatLuong] = useState(false);
  // Bước mẫu chỉ mở khi có mẫu lớp cùng vai (chọn mẫu → prefill).
  const [moMau, setMoMau] = useState(false);

  // Lưu xong thì ĐÓNG — không để form còn nguyên chữ đứng cạnh thẻ "đã gửi".
  useEffect(() => {
    if (!state.ok) return;
    onDone?.(state.message ?? '');
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  // Chiều (tăng/giữ/giảm) suy thẳng từ hai số — mọi mục tiêu ĐO nay ghi tay (đếm là việc của khu
  // "Việc em làm", không phải của mục tiêu). Nhãn chiều để em thấy app hiểu đúng ("nhìn 2s là hiểu").
  const suy = suyTuSo(x, y, chuaDoX);
  const suyNhan =
    (x.trim() === '' && !chuaDoX) || y.trim() === ''
      ? null
      : suy.chieu === 'giam'
        ? t('suyGiam')
        : suy.chieu === 'giu'
          ? t('suyGiu')
          : t('suyTang');
  const nhanDv = donViList.find((d) => d.id === donViId)?.ma ?? '';

  // ── CHẤM CHẤT LƯỢNG MỤC TIÊU (SMART) ─────────────────────────────────────────────────────
  // Mỗi tiêu chí một điểm; điểm % = số đạt / tổng. Đây vừa là điểm, vừa là HƯỚNG DẪN: em nhìn ô
  // nào chưa xanh thì biết cần sửa gì. Chuẩn dựa trên SMART, hợp với dữ liệu form thu được.
  const laDo = loaiMoc === 'do_luong';
  const tieuChi = useMemo(() => {
    const tenLen = ten.trim().length;
    const yNum = Number(y);
    const xNum = Number(x);
    const list = [
      {key: 'clCuThe', dat: tenLen >= 10 && tenLen <= 120},
      {
        key: 'clDoDuoc',
        // Hành động/kế hoạch đo bằng % nên luôn đo được; đo lường cần đích + đơn vị.
        dat: laDo ? Boolean(y.trim()) && Boolean(donViId) : true,
      },
      {
        key: 'clVuaSuc',
        // Đích cao hơn hiện tại (đúng hướng), và không xa gấp hơn 20 lần — chống "0 → 1 triệu".
        dat: !laDo || suy.chieu !== 'tang' || chuaDoX
          ? Boolean(y.trim()) || !laDo
          : Number.isFinite(yNum) && Number.isFinite(xNum) && yNum > xNum && yNum <= (xNum || 1) * 20,
      },
      {key: 'clLienKet', dat: Boolean(hoTroCho) || Boolean(dangSua)},
      {key: 'clCoHan', dat: Boolean(ketThuc)},
      {key: 'clCoMoTa', dat: moTa.trim().length >= 20},
    ];
    return list;
  }, [ten, y, x, donViId, hoTroCho, ketThuc, moTa, laDo, suy.chieu, chuaDoX, dangSua]);
  const soDat = tieuChi.filter((c) => c.dat).length;
  const phanTram = Math.round((soDat / tieuChi.length) * 100);

  // Câu ráp SỐNG — ghép từ chính những ô em vừa gõ (§F4 cauChot*).
  const cauRap = useMemo(() => {
    if (!ten.trim()) return null;
    if (loaiMoc !== 'do_luong') return null; // hành động/kế hoạch có ghi chú riêng
    if (!y.trim() || !nhanDv || !ketThuc) return null;
    const ngay = ngayVN(ketThuc);
    if (suy.chieu === 'giu') return t('cauChotGiu', {ten, dau: '≥', y, dv: nhanDv});
    if (chuaDoX) return t('cauChotChuaX', {ten, y, dv: nhanDv, ngay});
    if (!x.trim()) return null;
    return t('cauChot', {ten, x, chieu: suy.chieu === 'giam' ? t('chieuGiam') : t('chieuTang'), y, dv: nhanDv, ngay});
  }, [ten, loaiMoc, suy.chieu, chuaDoX, x, y, nhanDv, ketThuc, t]);

  function chonMau(m: MauMucTieu) {
    setTen(m.ten);
    setLinhVuc(m.linh_vuc);
    setMonId(m.subject_id ?? '');
    setDonViId(m.don_vi_id ?? '');
    // Chiều suy từ x/y của mẫu — không cần map kieu_dich nữa.
    if (m.x_goi_y != null) setX(String(m.x_goi_y));
    if (m.y_goi_y != null) setY(String(m.y_goi_y));
    setMoMau(false);
  }

  const mauCuaLop = mauList.filter((m) => m.linh_vuc === linhVuc || !linhVuc);
  // CHỈ 4 LĨNH VỰC trên màn của em (chủ dự án 02/09) — không có "Khác". "Khác" chỉ dành cho lớp
  // ngoài khung 4 domain (Marketing/CLB), đặt ở màn của thầy cô, không bày cho học sinh.
  const suG: string[] = [...AREAS];

  const tieuDe = dangSua
    ? t('formTitleSua')
    : laChinhEm
      ? t('formTitle')
      : t('formTitleHo', {ten: tenEm ?? ''});

  return (
    <Popup title={tieuDe} onClose={onClose} width="max-w-[640px]">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="class_id" value={classId} />
        {dangSua && <input type="hidden" name="muc_tieu_id" value={dangSua.id ?? ''} />}
        {/* Các giá trị suy ra — máy chủ kiểm lại, đây chỉ chuyển đúng enum. */}
        <input type="hidden" name="linh_vuc" value={linhVuc} />
        <input type="hidden" name="subject_id" value={monId} />
        <input type="hidden" name="kieu_dich" value={suy.kieu_dich} />
        <input type="hidden" name="chieu" value={suy.chieu} />
        <input type="hidden" name="ky" value="" />
        <input type="hidden" name="nguon_so" value="ghi_tay" />
        <input type="hidden" name="chua_do_x" value={chuaDoX ? '1' : ''} />
        <input type="hidden" name="x_so" value={chuaDoX ? '' : x} />
        <input type="hidden" name="y_so" value={y} />
        <input type="hidden" name="y_chu" value="" />
        <input type="hidden" name="don_vi_id" value={donViId} />
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

        {state.error && !state.fieldError && (
          <p
            data-kiem="mt-loi"
            className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad"
          >
            <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}

        {/* Chọn từ mẫu của lớp — chữ lấy từ mẫu, em chỉ điền số. */}
        {mauCuaLop.length > 0 && !dangSua && (
          <div className="rounded-[12px] bg-gold/[0.10] p-2.5">
            <button
              type="button"
              data-kiem="mt-chon-mau"
              onClick={() => setMoMau((v) => !v)}
              className="text-[12.5px] font-extrabold text-gold-text underline"
            >
              {t('themTuMau')}
            </button>
            {moMau && (
              <div className="mt-2 flex flex-col gap-1.5">
                {mauCuaLop.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-kiem="mt-mau"
                    data-id={m.id}
                    onClick={() => chonMau(m)}
                    className="rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-left text-[12.5px] font-bold text-navy hover:border-navy"
                  >
                    {m.ten}
                  </button>
                ))}
                <p className="text-[11px] font-semibold text-grey-mid">{t('mauKhoa')}</p>
              </div>
            )}
          </div>
        )}

        {/* ─── CHẤM CHẤT LƯỢNG (SMART) ─── thanh ▮▮▯▯▯ + %; bấm mở bảng gợi ý. */}
        <div className="rounded-[12px] border-[1.5px] border-navy/10 p-2.5">
          <button
            type="button"
            data-kiem="mt-chat-luong"
            onClick={() => setMoChatLuong((v) => !v)}
            className="flex w-full items-center gap-2.5"
          >
            <span className="flex gap-0.5">
              {tieuChi.map((c, i) => (
                <span
                  key={i}
                  className={`h-2 w-4 rounded-full ${c.dat ? 'bg-success' : 'bg-navy/15'}`}
                />
              ))}
            </span>
            <span className="text-[12.5px] font-extrabold text-navy">
              {t('chatLuong')} · {phanTram}%
            </span>
            <Info size={13} strokeWidth={2.5} className="ml-auto text-grey-mid" />
          </button>
          {moChatLuong && (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-navy/10 pt-2">
              <p className="text-[11.5px] font-semibold text-grey-mid">{t('chatLuongMo')}</p>
              {tieuChi.map((c) => (
                <div key={c.key} className="flex items-start gap-1.5 text-[12px] font-semibold">
                  <span
                    className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                      c.dat ? 'bg-success text-white' : 'border-[1.5px] border-navy/25 text-transparent'
                    }`}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span className={c.dat ? 'text-grey-mid line-through' : 'text-navy'}>{t(c.key)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NHÓM — 4 chip (chỉ 4 lĩnh vực, không "Khác"). */}
        <div>
          <p className="mb-1.5 text-[12px] font-bold text-grey-mid">{t('linhVuc')}</p>
          <div data-kiem="mt-buoc-1" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {suG.map((a) => (
              <OChon key={a} chon={linhVuc === a} onClick={() => setLinhVuc(a)} nhan={nhanTheoArea[a] ?? a} kiem="mt-linh-vuc" />
            ))}
          </div>
          {monList.length > 0 && (
            <div className="mt-2">
              <Field label={t('mon')} htmlFor="mt-mon">
                <ChonCuon
                  id="mt-mon"
                  name="_mon_ui"
                  value={monId}
                  onChange={setMonId}
                  danhSach={monList.map((m) => ({ma: m.id, nhan: m.ten}))}
                  chuaChon={t('monChon')}
                />
              </Field>
            </div>
          )}
        </div>

        {/* NHẬP MỤC TIÊU — kèm đèn gợi ý SMART. */}
        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <label htmlFor="mt-ten" className="text-[12px] font-bold text-grey-mid">
              {t('nhapMucTieu')}
            </label>
            <button
              type="button"
              data-kiem="mt-smart"
              onClick={() => setMoSmart((v) => !v)}
              aria-label={t('smartTitle')}
              className="text-gold-deep hover:text-navy"
            >
              <Lightbulb size={15} strokeWidth={2.5} />
            </button>
          </div>
          {moSmart && (
            <div className="mb-2 rounded-[10px] bg-gold/[0.12] p-2.5 text-[11.5px] font-semibold leading-relaxed text-navy">
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
            className={ctlWithBorder(state.fieldError === 'ten')}
          />
          {err('ten') && <p className="mt-1 text-[12px] font-bold text-status-bad">{err('ten')}</p>}
        </div>

        {/* MÔ TẢ */}
        <Field label={t('moTa')} htmlFor="mt-mo-ta">
          <textarea
            id="mt-mo-ta"
            data-kiem="mt-mo-ta"
            value={moTa}
            onChange={(e) => setMoTa(e.target.value)}
            placeholder={t('moTaPh')}
            rows={2}
            maxLength={1000}
            className={ctlWithBorder(false)}
          />
        </Field>

        {/* HỖ TRỢ CHO — nối mục tiêu của em vào mục tiêu của lớp (chỉ khi tạo mới). */}
        {!dangSua && mucTieuLop.length > 0 && (
          <Field label={t('hoTroCho')} htmlFor="mt-ho-tro">
            <ChonCuon
              id="mt-ho-tro"
              name="_ho_tro_ui"
              value={hoTroCho}
              onChange={setHoTroCho}
              danhSach={mucTieuLop.map((m) => ({ma: m.id, nhan: m.ten}))}
              chuaChon={t('hoTroChon')}
            />
            <span data-kiem="mt-ho-tro" className="hidden" />
            <p className="mt-1 text-[11px] font-semibold text-grey-mid">{t('hoTroGiaiThich')}</p>
          </Field>
        )}

        {/* LOẠI CỘT MỐC — ba khuôn theo hình dạng mục tiêu (0172). */}
        <div>
          <p className="mb-1.5 text-[12px] font-bold text-grey-mid">{t('loaiMocLabel')}</p>
          <div data-kiem="mt-loai-moc" className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <OChon chon={loaiMoc === 'do_luong'} onClick={() => setLoaiMoc('do_luong')} nhan={t('mocDoLuong')} kiem="mt-moc-do-luong" />
            <OChon chon={loaiMoc === 'hanh_dong'} onClick={() => setLoaiMoc('hanh_dong')} nhan={t('mocHanhDong')} kiem="mt-moc-hanh-dong" />
            <OChon chon={loaiMoc === 'ke_hoach'} onClick={() => setLoaiMoc('ke_hoach')} nhan={t('mocKeHoach')} kiem="mt-moc-ke-hoach" />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-grey-mid">
            {loaiMoc === 'do_luong' ? t('mocDoLuongGt') : loaiMoc === 'hanh_dong' ? t('mocHanhDongGt') : t('mocKeHoachGt')}
          </p>
        </div>

        {/* HÀNH ĐỘNG: không có ô số — làm xong là 100%. */}
        {loaiMoc === 'hanh_dong' && (
          <p className="rounded-[10px] bg-navy/[0.05] px-2.5 py-2 text-[12px] font-semibold text-grey-mid">
            {t('mocHanhDongNote')}
          </p>
        )}

        {/* KẾ HOẠCH: các bước cộng dồn tới 100%. */}
        {loaiMoc === 'ke_hoach' && (
          <div data-kiem="mt-cac-buoc" className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-grey-mid">{t('cacBuoc')}</p>
              <span
                className={`text-[12px] font-extrabold ${
                  Math.round(buocList.reduce((s, b) => s + (Number(b.phan_tram) || 0), 0)) === 100
                    ? 'text-success'
                    : 'text-status-bad'
                }`}
              >
                {Math.round(buocList.reduce((s, b) => s + (Number(b.phan_tram) || 0), 0))}%
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {buocList.map((b, i) => (
                <div key={i} className="rounded-[10px] border-[1.5px] border-navy/10 p-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={b.tieu_de}
                      onChange={(e) =>
                        setBuocList((l) => l.map((x, j) => (j === i ? {...x, tieu_de: e.target.value} : x)))
                      }
                      placeholder={t('buocTieuDePh')}
                      maxLength={200}
                      data-kiem="mt-buoc-ten"
                      className={`${inputInline} flex-1`}
                    />
                    <input
                      value={b.phan_tram}
                      onChange={(e) =>
                        setBuocList((l) => l.map((x, j) => (j === i ? {...x, phan_tram: e.target.value} : x)))
                      }
                      type="number"
                      min="0"
                      max="100"
                      inputMode="numeric"
                      placeholder="%"
                      aria-label={t('buocPhanTram')}
                      className={`${inputInline} w-16`}
                    />
                    <span className="text-[12px] font-bold text-grey-mid">%</span>
                    <button
                      type="button"
                      onClick={() => setBuocList((l) => l.filter((_, j) => j !== i))}
                      aria-label={t('buocXoa')}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-status-bad hover:bg-status-bad/10"
                    >
                      <Trash2 size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              data-kiem="mt-them-buoc"
              onClick={() => setBuocList((l) => [...l, buocRong()])}
              className="mt-2 inline-flex min-h-[32px] items-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-navy/25 px-3 text-[12px] font-extrabold text-navy hover:border-navy"
            >
              + {t('themBuoc')}
            </button>
            {err('buoc') && <p className="mt-1.5 text-[12px] font-bold text-status-bad">{err('buoc')}</p>}
          </div>
        )}

        {/* ĐO LƯỜNG — chỉ hỏi đơn vị + hai con số. Tăng/giữ/giảm KHÔNG hỏi nữa: app tự suy từ mức
            đầu và mức đích (chủ dự án 02/09). Đếm là việc của khu "Việc em làm", không của mục tiêu. */}
        {loaiMoc === 'do_luong' && (
          <div data-kiem="mt-buoc-2" className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Field label={t('donViSao')} htmlFor="mt-don-vi" error={err('don_vi_id')}>
                <ChonCuon
                  id="mt-don-vi"
                  name="_don_vi_ui"
                  value={donViId}
                  onChange={setDonViId}
                  danhSach={donViList.map((d) => ({ma: d.id, nhan: d.ma}))}
                  chuaChon={t('donViChon')}
                  loi={state.fieldError === 'don_vi_id'}
                />
                <span data-kiem="mt-don-vi" className="hidden" />
              </Field>
              <Field label={t('giaTriBanDau')} htmlFor="mt-x" error={err('x_so')}>
                <input
                  id="mt-x"
                  data-kiem="mt-x"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={x}
                  disabled={chuaDoX}
                  onChange={(e) => setX(e.target.value)}
                  placeholder={chuaDoX ? '—' : '0'}
                  className={ctlWithBorder(state.fieldError === 'x_so')}
                />
                <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-grey-mid">
                  <input
                    type="checkbox"
                    data-kiem="mt-chua-do-x"
                    checked={chuaDoX}
                    onChange={(e) => setChuaDoX(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-navy/30"
                  />
                  {t('chuaBietX')}
                </label>
              </Field>
              <Field label={t('giaTriMucTieu')} htmlFor="mt-y" error={err('y_so')}>
                <input
                  id="mt-y"
                  data-kiem="mt-y"
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  value={y}
                  onChange={(e) => setY(e.target.value)}
                  className={ctlWithBorder(state.fieldError === 'y_so')}
                />
              </Field>
            </div>

            {/* App tự hiểu tăng/giữ/giảm từ hai số — cho em thấy để yên tâm. */}
            {suyNhan && (
              <p
                data-kiem="mt-suy-chieu"
                className="inline-flex items-center gap-1.5 self-start rounded-full bg-navy/[0.05] px-2.5 py-1 text-[12px] font-semibold text-navy"
              >
                {suy.chieu === 'giam' ? (
                  <ArrowDown size={14} strokeWidth={2.8} className="shrink-0 text-gold-deep" />
                ) : suy.chieu === 'giu' ? (
                  <ArrowRight size={14} strokeWidth={2.8} className="shrink-0 text-gold-deep" />
                ) : (
                  <ArrowUp size={14} strokeWidth={2.8} className="shrink-0 text-gold-deep" />
                )}
                {suyNhan}
              </p>
            )}
          </div>
        )}

        {/* NGÀY ĐẾN HẠN + preset nhanh. */}
        <div>
          <Field label={t('ngayDenHan')} error={err('ket_thuc')}>
            <span data-kiem="mt-han" className="block max-w-[220px]">
              <ONgayVN
                name="_ket_thuc_ui"
                nhan={t('ngayDenHan')}
                value={ketThuc}
                loi={state.fieldError === 'ket_thuc'}
                onChange={setKetThuc}
              />
            </span>
          </Field>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setKetThuc(schoolYearRangeVN().end)}
              className="rounded-full border-[1.5px] border-navy/15 bg-white px-2.5 py-1 text-[11.5px] font-bold text-navy hover:border-navy"
            >
              {t('presetNamNay')}
            </button>
          </div>
        </div>

        {/* ③ ĐỌC LẠI CÂU MỤC TIÊU — ráp từ chính chữ em gõ. */}
        <div data-kiem="mt-buoc-3">
          <p className="mb-1.5 text-[13px] font-extrabold text-navy">{t('buoc3')}</p>
          <div
            data-kiem="mt-cau-rap-lai"
            className={`rounded-[14px] px-3.5 py-3 text-[13px] font-bold leading-relaxed ${
              cauRap ? 'bg-gold/[0.14] text-navy' : 'bg-navy/[0.04] italic text-grey-mid'
            }`}
          >
            {cauRap ?? t('cauChotTrong')}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Lưu nháp giữ ở nháp; nút chính gửi thầy cô duyệt. */}
          <button
            type="submit"
            name="action"
            value="nhap"
            className="inline-flex min-h-[24px] items-center py-1 text-[12px] font-extrabold text-navy underline"
          >
            {t('luuNhap')}
          </button>
          <SubmitButton
            className="btn-gold rounded-[12px] px-4 py-2.5 text-[13px] font-extrabold"
            name="action"
            value="gui"
            wrapClass="contents"
          >
            <span data-kiem="mt-gui">{laChinhEm ? t('gui') : t('luu')}</span>
          </SubmitButton>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[24px] cursor-pointer items-center py-1 text-[12px] font-extrabold text-grey-mid underline"
          >
            {t('thoi')}
          </button>
        </div>
      </form>

      {/* XOÁ — chỉ được khi mục tiêu chưa có số nào ghi dưới nó (RLS quyết). */}
      {dangSua && laChinhEm && (
        <form
          action={xoaMucTieu}
          className="mt-2 flex justify-end"
          onSubmit={(e) => {
            if (!window.confirm(t('xoaHoi'))) e.preventDefault();
          }}
        >
          <input type="hidden" name="muc_tieu_id" value={dangSua.id ?? ''} />
          <input type="hidden" name="student_id" value={studentId} />
          <SubmitButton
            className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[11.5px] font-extrabold text-status-bad underline"
            wrapClass="contents"
          >
            <Trash2 size={12} strokeWidth={2.5} />
            {t('xoa')}
          </SubmitButton>
        </form>
      )}
    </Popup>
  );
}

// Một ô chọn kiểu "chip lớn" — dùng cho cách đo, hướng, kỳ. Thay <select> để bấm nhanh trên điện thoại.
function OChon({chon, onClick, nhan, kiem}: {chon: boolean; onClick: () => void; nhan: string; kiem?: string}) {
  return (
    <button
      type="button"
      data-kiem={kiem}
      onClick={onClick}
      className={`min-h-[40px] rounded-[10px] border-[1.5px] px-2.5 py-2 text-[12.5px] font-bold transition-colors ${
        chon ? 'border-navy bg-navy/[0.06] text-navy' : 'border-navy/15 bg-white text-grey-mid hover:border-navy/40'
      }`}
    >
      {nhan}
    </button>
  );
}

// Giữ tên cũ cho các nơi còn import trong khi PR-4 viết lại màn cô.
export {FormMucTieu3Buoc as FormMucTieu};
