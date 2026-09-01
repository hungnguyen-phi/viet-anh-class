'use client';

import {useActionState, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AlertCircle, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder, inputInline, BORDER_ERR} from '@/components/ui/Field';
import {ONgayVN, ngayVN} from '@/components/ui/ONgayVN';
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

// Kiểu vòng đời của mục tiêu, dịch từ các lựa chọn của em sang enum CSDL.
type CheDo = 'len' | 'giu' | 'bot' | 'chu';
type KieuSo = 'dem' | 'do';
type BotKy = 'tuan' | 'thang' | 'nam';

// Từ (che_do, kieu_so, bot_ky) → (kieu_dich, chieu, ky, nguon_so) đúng enum CSDL.
function suyDich(che_do: CheDo, bot_ky: BotKy): {kieu_dich: string; chieu: string; ky: string} {
  if (che_do === 'chu') return {kieu_dich: 'chu', chieu: 'tang', ky: ''};
  if (che_do === 'giu') return {kieu_dich: 'giu', chieu: 'giu', ky: ''};
  if (che_do === 'bot')
    return bot_ky === 'nam'
      ? {kieu_dich: 'tran_tich_luy', chieu: 'giam', ky: ''}
      : {kieu_dich: 'toc_do_ky', chieu: 'giam', ky: bot_ky};
  return {kieu_dich: 'toi', chieu: 'tang', ky: ''};
}

// Đọc ngược mục tiêu đang sửa (enum CSDL) → lựa chọn của form.
function docNguoc(mt: MucTieuV): {che_do: CheDo; bot_ky: BotKy; kieu_so: KieuSo} {
  const kd = mt.kieu_dich ?? 'toi';
  if (kd === 'chu') return {che_do: 'chu', bot_ky: 'nam', kieu_so: 'do'};
  if (kd === 'giu') return {che_do: 'giu', bot_ky: 'nam', kieu_so: mt.nguon_so === 'thuoc' ? 'dem' : 'do'};
  if (kd === 'tran_tich_luy') return {che_do: 'bot', bot_ky: 'nam', kieu_so: 'do'};
  if (kd === 'toc_do_ky')
    return {che_do: 'bot', bot_ky: mt.ky === 'thang' ? 'thang' : 'tuan', kieu_so: 'do'};
  return {che_do: 'len', bot_ky: 'nam', kieu_so: mt.nguon_so === 'thuoc' ? 'dem' : 'do'};
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
  dangSua?: DangSuaMt;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const t = useTranslations('mucTieu');
  const locale = useLocale();
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieu, {ok: false});

  const nguoc = dangSua ? docNguoc(dangSua) : null;
  const [ten, setTen] = useState(dangSua?.ten ?? '');
  const [linhVuc, setLinhVuc] = useState<string>(dangSua?.linh_vuc ?? areaPreset ?? AREAS[0]);
  const [monId, setMonId] = useState<string>(dangSua?.subject_id ?? '');
  const [cheDo, setCheDo] = useState<CheDo>(nguoc?.che_do ?? 'len');
  const [kieuSo, setKieuSo] = useState<KieuSo>(nguoc?.kieu_so ?? 'do');
  const [botKy, setBotKy] = useState<BotKy>(nguoc?.bot_ky ?? 'tuan');
  const [chuaDoX, setChuaDoX] = useState(dangSua?.chua_do_x ?? false);
  const [x, setX] = useState(dangSua?.x_so != null ? String(dangSua.x_so) : '');
  const [y, setY] = useState(dangSua?.y_so != null ? String(dangSua.y_so) : '');
  const [yChu, setYChu] = useState(dangSua?.y_chu ?? '');
  const [donViId, setDonViId] = useState<string>(dangSua?.don_vi_id ?? '');
  // Không còn ô chọn ngày bắt đầu — giữ giá trị cũ khi sửa, còn tạo mới thì để trống (máy chủ
  // lấy hôm nay). Không có setter vì màn của em không đổi ngày bắt đầu nữa.
  const [batDau] = useState(dangSua?.bat_dau ?? '');
  const [ketThuc, setKetThuc] = useState(dangSua?.ket_thuc ?? '');
  // Bước mẫu chỉ mở khi có mẫu lớp cùng vai (chọn mẫu → prefill).
  const [moMau, setMoMau] = useState(false);
  // KIỂU NÂNG CAO GIẤU BỚT (chủ dự án 02/09: form phải đơn giản cho học sinh).
  // Mặc định mọi mục tiêu là "tăng lên" (từ X đến Y) — kiểu phần lớn các em cần. Ba kiểu còn lại
  // (giữ mức / giảm bớt / không đo bằng số) nằm sau một dòng "Kiểu mục tiêu khác", mở ra mới thấy.
  // Nếu đang SỬA một mục tiêu vốn thuộc kiểu khác thì mở sẵn để em thấy đúng cái mình đã đặt.
  const [moKhac, setMoKhac] = useState((nguoc?.che_do ?? 'len') !== 'len');

  // Lưu xong thì ĐÓNG — không để form còn nguyên chữ đứng cạnh thẻ "đã gửi".
  useEffect(() => {
    if (!state.ok) return;
    onDone?.(state.message ?? '');
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const dich = suyDich(cheDo, botKy);
  const nguonSo = cheDo === 'len' || cheDo === 'giu' ? (kieuSo === 'dem' ? 'thuoc' : 'ghi_tay') : 'ghi_tay';
  const nhanDv = donViList.find((d) => d.id === donViId)?.ma ?? '';

  // Câu ráp SỐNG — ghép từ chính những ô em vừa gõ (§F4 cauChot*).
  const cauRap = useMemo(() => {
    if (!ten.trim()) return null;
    if (cheDo === 'chu') return yChu.trim() ? t('cauChotChu', {ten, chu: yChu}) : null;
    if (!y.trim() || !nhanDv || !ketThuc) return null;
    if (cheDo === 'giu') return t('cauChotGiu', {ten, dau: '≥', y, dv: nhanDv});
    if (cheDo === 'bot') {
      if (botKy === 'nam') return t('cauChotNam', {ten, y, dv: nhanDv});
      return t('cauChotKy', {ten, ky: botKy === 'thang' ? t('kyThang') : t('kyTuan'), y, dv: nhanDv});
    }
    if (chuaDoX) return t('cauChotChuaX', {ten, y, dv: nhanDv});
    if (!x.trim()) return null;
    return t('cauChot', {ten, x, chieu: t('chieuTang'), y, dv: nhanDv});
  }, [ten, cheDo, kieuSo, botKy, chuaDoX, x, y, yChu, nhanDv, ketThuc, t]);

  function chonMau(m: MauMucTieu) {
    setTen(m.ten);
    setLinhVuc(m.linh_vuc);
    setMonId(m.subject_id ?? '');
    setDonViId(m.don_vi_id ?? '');
    const n = docNguoc({
      ...(dangSua ?? ({} as MucTieuV)),
      kieu_dich: m.kieu_dich,
      chieu: m.chieu,
      ky: m.kieu_dich === 'toc_do_ky' ? 'tuan' : null,
      nguon_so: dangSua?.nguon_so ?? 'ghi_tay',
    } as MucTieuV);
    setCheDo(n.che_do);
    setBotKy(n.bot_ky);
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
        <input type="hidden" name="kieu_dich" value={dich.kieu_dich} />
        <input type="hidden" name="chieu" value={dich.chieu} />
        <input type="hidden" name="ky" value={dich.ky} />
        <input type="hidden" name="nguon_so" value={nguonSo} />
        <input type="hidden" name="chua_do_x" value={cheDo === 'len' && chuaDoX ? '1' : ''} />
        <input type="hidden" name="x_so" value={cheDo === 'len' && !chuaDoX ? x : ''} />
        <input type="hidden" name="y_so" value={cheDo === 'chu' ? '' : y} />
        <input type="hidden" name="y_chu" value={cheDo === 'chu' ? yChu : ''} />
        <input type="hidden" name="don_vi_id" value={cheDo === 'chu' ? '' : donViId} />
        <input type="hidden" name="bat_dau" value={batDau} />
        <input type="hidden" name="ket_thuc" value={ketThuc} />

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

        {/* ─────────────────────────────────────────────────────────────────────────────────
            FORM ĐIỀN-VÀO-CÂU (viết lại 02/09: bản trước bắt em hiểu "đếm/đo", "từ-đến", "đơn vị"
            như mô hình dữ liệu — người lớn cũng thấy khó. Nay em nói MỘT CÂU tự nhiên: chọn nhóm,
            "em muốn …", rồi "bây giờ được [x], muốn tới [y] [đơn vị], trước [ngày]". Mọi lựa chọn
            kỹ thuật (đếm tự động hay tự ghi, giữ/giảm/không-số) DỒN HẾT vào "Cách khác", mặc định
            là kiểu phần lớn các em cần: tăng lên và tự ghi số.
            ───────────────────────────────────────────────────────────────────────────────── */}

        {/* NHÓM — 4 chip, chọn một (chỉ 4 lĩnh vực, không "Khác"). */}
        <div data-kiem="mt-buoc-1">
          <p className="mb-1.5 text-[12px] font-bold text-grey-mid">{t('linhVuc')}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {suG.map((a) => (
              <OChon key={a} chon={linhVuc === a} onClick={() => setLinhVuc(a)} nhan={nhanTheoArea[a] ?? a} kiem="mt-linh-vuc" />
            ))}
          </div>
        </div>

        {/* EM MUỐN GÌ */}
        <Field label={t('buoc1')} htmlFor="mt-ten" error={err('ten')}>
          <input
            id="mt-ten"
            data-kiem="mt-ten"
            value={ten}
            onChange={(e) => setTen(e.target.value)}
            placeholder={t('tenPh')}
            maxLength={200}
            className={ctlWithBorder(state.fieldError === 'ten')}
          />
        </Field>
        {monList.length > 0 && (
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
        )}

        {/* CÂU SỐ — đọc như một câu. Không-số thì là một ô lời; còn lại là "bây giờ/muốn tới/đơn vị". */}
        {cheDo === 'chu' ? (
          <Field label={t('yChu')} htmlFor="mt-y" error={err('y_chu')}>
            <textarea
              id="mt-y"
              data-kiem="mt-y"
              value={yChu}
              onChange={(e) => setYChu(e.target.value)}
              rows={2}
              maxLength={300}
              className={ctlWithBorder(state.fieldError === 'y_chu')}
            />
          </Field>
        ) : (
          <div data-kiem="mt-buoc-2" className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
            {/* Giảm bớt theo kỳ — chỉ hiện khi đã chọn ở "Cách khác". */}
            {cheDo === 'bot' && (
              <div className="mb-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <OChon chon={botKy === 'tuan'} onClick={() => setBotKy('tuan')} nhan={t('giamTuan', {y: y || '…'})} />
                <OChon chon={botKy === 'thang'} onClick={() => setBotKy('thang')} nhan={t('giamThang', {y: y || '…'})} />
                <OChon chon={botKy === 'nam'} onClick={() => setBotKy('nam')} nhan={t('giamNam', {y: y || '…'})} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13.5px] font-bold text-navy">
              {cheDo === 'len' && !chuaDoX && (
                <>
                  <span>{t('napBayGio')}</span>
                  <input
                    id="mt-x"
                    data-kiem="mt-x"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={x}
                    onChange={(e) => setX(e.target.value)}
                    placeholder="0"
                    aria-label={t('tu')}
                    className={`${inputInline} w-24 ${state.fieldError === 'x_so' ? BORDER_ERR : ''}`}
                  />
                  <span>,</span>
                </>
              )}
              <span>{cheDo === 'giu' ? t('napGiu') : t('napMuonToi')}</span>
              <input
                id="mt-y"
                data-kiem="mt-y"
                type="number"
                step="any"
                min="0.01"
                inputMode="decimal"
                value={y}
                onChange={(e) => setY(e.target.value)}
                aria-label={t('den')}
                className={`${inputInline} w-24 ${state.fieldError === 'y_so' ? BORDER_ERR : ''}`}
              />
              <span className="min-w-[120px]">
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
              </span>
            </div>
            {(err('x_so') || err('y_so') || err('don_vi_id')) && (
              <p className="mt-1.5 text-[12px] font-bold text-status-bad">
                {err('x_so') || err('y_so') || err('don_vi_id')}
              </p>
            )}
            {cheDo === 'len' && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-grey-mid">
                <input
                  type="checkbox"
                  data-kiem="mt-chua-do-x"
                  checked={chuaDoX}
                  onChange={(e) => setChuaDoX(e.target.checked)}
                  className="h-4 w-4 rounded border-navy/30"
                />
                {t('chuaBietX')}
              </label>
            )}
          </div>
        )}

        {/* NGÀY — chỉ "trước ngày"; máy chủ tự lấy hôm nay làm ngày bắt đầu. */}
        <Field label={t('truocNgay')} error={err('ket_thuc')}>
          <span data-kiem="mt-han" className="block max-w-[220px]">
            <ONgayVN
              name="_ket_thuc_ui"
              nhan={t('truocNgay')}
              value={ketThuc}
              loi={state.fieldError === 'ket_thuc'}
              onChange={setKetThuc}
            />
          </span>
        </Field>

        {/* Nhắc nhịp — chỉ khi em chọn "máy tự cộng" ở Cách khác. */}
        {cheDo === 'len' && kieuSo === 'dem' && (
          <p className="rounded-[10px] bg-navy/[0.05] px-2.5 py-2 text-[12px] font-semibold text-grey-mid">
            {t('phepTinhDem')}
          </p>
        )}

        {/* CÁCH KHÁC — dồn hết lựa chọn kỹ thuật: cách tính số + kiểu mục tiêu. */}
        {moKhac ? (
          <div className="flex flex-col gap-2 rounded-[12px] bg-navy/[0.03] p-2.5">
            {cheDo !== 'bot' && (
              <>
                <p className="text-[11.5px] font-bold text-grey-mid">{t('cachTinhSo')}</p>
                <div data-kiem="mt-kieu-dich" className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <OChon chon={kieuSo === 'do'} onClick={() => setKieuSo('do')} nhan={t('kieuDo')} />
                  <OChon chon={kieuSo === 'dem'} onClick={() => setKieuSo('dem')} nhan={t('kieuDem')} />
                </div>
              </>
            )}
            <p className="mt-1 text-[11.5px] font-bold text-grey-mid">{t('kieuMucTieu')}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <OChon chon={cheDo === 'len'} onClick={() => setCheDo('len')} nhan={t('chieuTang')} kiem="mt-chieu-tang" />
              <OChon chon={cheDo === 'giu'} onClick={() => setCheDo('giu')} nhan={t('giuMucNam')} kiem="mt-chieu-giu" />
              <OChon chon={cheDo === 'bot'} onClick={() => setCheDo('bot')} nhan={t('chieuGiam')} kiem="mt-chieu-giam" />
              <OChon chon={cheDo === 'chu'} onClick={() => setCheDo('chu')} nhan={t('khongSo')} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-kiem="mt-mo-khac"
            onClick={() => setMoKhac(true)}
            className="inline-flex min-h-[24px] items-center py-1 text-[12px] font-bold text-grey-mid underline hover:text-navy"
          >
            {t('cachKhac')}
          </button>
        )}

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
