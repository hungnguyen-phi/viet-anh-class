'use client';

import {useActionState, useEffect, useState, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {Check, CheckCircle2, CornerDownRight, Pencil, Plus, Circle, ListChecks} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, btnGhost, btnGold} from '@/components/ui/Field';
import {Popup} from '@/components/ui/Popup';
import {ONgayVN, ngayVN} from '@/components/ui/ONgayVN';
import {DonutRing} from '@/components/charts/DonutRing';
import {AREAS} from '@/lib/areas';
import {
  FormMucTieu3Buoc,
  type DonViChon,
  type MonChon,
  type MucTieuLopChon,
  type MauMucTieu,
  type BuocThe,
} from '@/components/student/FormMucTieu';
import {
  dongMucTieu,
  duyetMucTieu,
  traLaiMucTieu,
  ghiSoDo,
  datBuocXong,
  datHanhDong,
  type MucTieuState,
} from '@/app/[locale]/(dashboard)/student/actions';
import type {Database} from '@/lib/database.types';

// ════════════════════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA EM — khu ③ của màn /student (PA2, 40-MAN-HINH §B)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mô hình cũ (wigs) đã DROP. Khối này đọc view `muc_tieu_v` — MỌI số (đang ở, %, lẽ ra hôm nay,
// trạng thái) đã tính sẵn ở CSDL qua `private.so_hien_tai`, màn KHÔNG tự cộng gì. Component nhận
// props, không query thẳng (màn cha StudentScoreboard lo phần đọc).
//
// Bốn ô theo lĩnh vực: ô nào có mục tiêu thì hiện THẺ (câu đích · "Đang ở …" · vòng %/huy hiệu ·
// nhãn trạng thái · chip chờ duyệt/trả lại · nút ghi số · dây hướng tới · đóng/sửa/tập trung). Ô
// trống là nút "đặt mục tiêu" mang màu lĩnh vực. Cô chỉ có nút Duyệt / Trả lại; mọi ghi khác là
// của chính em.

type MucTieuV = Database['public']['Views']['muc_tieu_v']['Row'];

/** Một dây `noi` để hiển thị dưới thẻ (hướng tới / góp số vào mục tiêu cha). */
export type NoiHienThi = {id: string; cha_ten: string; vai: string; lop_khac?: boolean};

export function MucTieuCuaCon({
  studentId,
  classId,
  mucTieu,
  laChinhEm,
  canManage,
  namHoc,
  nhanTheoArea,
  mauTheoArea,
  donViList,
  monList = [],
  mucTieuLop = [],
  mauList = [],
  buocTheoMt = {},
  noiTheoMt = {},
  loTrinhTheoMt = {},
}: {
  studentId: string;
  classId: string;
  /** Mục tiêu cấp 'em' của em này, đọc từ `muc_tieu_v`. */
  mucTieu: MucTieuV[];
  laChinhEm: boolean;
  canManage: boolean;
  namHoc: string | null;
  /** Nhãn 4 lĩnh vực đã dịch (area_config). */
  nhanTheoArea: Record<string, string>;
  /** Màu 4 lĩnh vực: hex cho viền/vòng %, soft (rgba) cho nền. */
  mauTheoArea: Record<string, {hex: string; soft: string}>;
  donViList: DonViChon[];
  monList?: MonChon[];
  /** Mục tiêu lớp để em hướng tới. */
  mucTieuLop?: MucTieuLopChon[];
  /** Mẫu mục tiêu của lớp. */
  mauList?: MauMucTieu[];
  /** Các bước của mỗi mục tiêu KẾ HOẠCH — để form sửa hiện lại bước cũ. */
  buocTheoMt?: Record<string, BuocThe[]>;
  /** Dây nối theo id mục tiêu con. */
  noiTheoMt?: Record<string, NoiHienThi[]>;
  /** Khối cam kết tuần + thước đo của TỪNG mục tiêu (dựng ở màn cha) — bày ngay trong thẻ. */
  loTrinhTheoMt?: Record<string, ReactNode>;
}) {
  const t = useTranslations('mucTieu');
  const [bao, setBao] = useState('');
  // moForm giữ lĩnh vực của ô em vừa bấm (đặt mới), hoặc id mục tiêu đang sửa.
  const [moForm, setMoForm] = useState<null | {area: string; suaId?: string; khoa?: boolean}>(null);
  const theoArea = new Map(mucTieu.map((m) => [m.linh_vuc ?? 'knowledge', m]));
  const canGhi = laChinhEm;
  const dangSua = moForm?.suaId ? (mucTieu.find((m) => m.id === moForm.suaId) ?? null) : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {bao && (
        <p className="inline-flex items-start gap-1.5 rounded-[12px] bg-success/[0.10] px-2.5 py-2 text-chu-thich font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} className="mt-px shrink-0" />
          {bao}
        </p>
      )}

      <div className="grid items-start gap-3 sm:grid-cols-2">
        {AREAS.map((a) => {
          const mt = theoArea.get(a);
          const nhan = nhanTheoArea[a] ?? a;
          const mau = mauTheoArea[a] ?? {hex: 'var(--color-navy)', soft: 'rgba(38,39,93,0.06)'};
          if (mt)
            return (
              <TheMucTieu
                key={a}
                mt={mt}
                nhanLinhVuc={nhan}
                mau={mau}
                studentId={studentId}
                laChinhEm={laChinhEm}
                canManage={canManage}
                noi={noiTheoMt[mt.id ?? ''] ?? []}
                buoc={buocTheoMt[mt.id ?? ''] ?? []}
                loTrinh={loTrinhTheoMt[mt.id ?? ''] ?? null}
                onSua={() => setMoForm({area: a, suaId: mt.id ?? undefined})}
                onDone={setBao}
              />
            );
          // Ô trống MANG MÀU lĩnh vực — bốn ô nhận ra nhau bằng màu ngay cả khi chưa có mục tiêu.
          return canGhi ? (
            <button
              key={a}
              type="button"
              data-kiem="o-trong-muc-tieu"
              data-area={a}
              onClick={() => setMoForm({area: a, khoa: true})}
              style={{
                borderColor: `color-mix(in srgb, ${mau.hex} 30%, white)`,
                background: `color-mix(in srgb, ${mau.hex} 9%, white)`,
              }}
              className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed p-4 text-navy transition-colors hover:bg-white/70"
            >
              <span style={{background: mau.hex}} className="cham-44 grid h-9 w-9 place-items-center rounded-full text-white">
                <Plus size={20} strokeWidth={2.5} />
              </span>
              <span className="text-than font-extrabold">{nhan}</span>
              {namHoc && <span className="text-chu-thich font-semibold text-grey-mid">{namHoc}</span>}
            </button>
          ) : (
            <div
              key={a}
              style={{
                borderColor: `color-mix(in srgb, ${mau.hex} 24%, white)`,
                background: `color-mix(in srgb, ${mau.hex} 7%, white)`,
              }}
              className="flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[16px] border-[1.5px] border-dashed p-4"
            >
              <span className="text-than font-extrabold text-navy">{nhan}</span>
              <span className="text-chu-thich font-semibold italic text-grey-mid">{t('trong')}</span>
            </div>
          );
        })}
      </div>

      {canGhi && (
        <button
          type="button"
          data-kiem="nut-them-muc-tieu"
          onClick={() => setMoForm({area: theoArea.has('knowledge') ? 'leadership_skills' : 'knowledge'})}
          className={`${btnGhost} self-start`}
        >
          <Plus size={14} strokeWidth={2.5} />
          {t('them')}
        </button>
      )}

      {moForm && (
        <FormMucTieu3Buoc
          studentId={studentId}
          classId={classId}
          laChinhEm={laChinhEm}
          areaPreset={moForm.area}
          khoaLinhVuc={moForm.khoa ?? false}
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          monList={monList}
          mauList={mauList}
          mucTieuLop={mucTieuLop}
          dangSua={dangSua}
          buocDangSua={dangSua ? (buocTheoMt[dangSua.id ?? ''] ?? []) : []}
          onClose={() => setMoForm(null)}
          onDone={setBao}
        />
      )}
    </div>
  );
}

// ── MỘT THẺ MỤC TIÊU ────────────────────────────────────────────────────────────────────────
function TheMucTieu({
  mt,
  nhanLinhVuc,
  mau,
  studentId,
  laChinhEm,
  canManage,
  noi,
  buoc,
  loTrinh,
  onSua,
  onDone,
}: {
  mt: MucTieuV;
  nhanLinhVuc: string;
  mau: {hex: string; soft: string};
  studentId: string;
  laChinhEm: boolean;
  canManage: boolean;
  noi: NoiHienThi[];
  buoc: BuocThe[];
  loTrinh: ReactNode;
  onSua: () => void;
  onDone: (msg: string) => void;
}) {
  const t = useTranslations('mucTieu');
  const canGhi = laChinhEm;
  const coQuang = mt.pct != null; // kiểu có quãng mới vẽ vòng %
  const laKeHoach = mt.loai_moc === 'ke_hoach';
  const laHanhDong = mt.loai_moc === 'hanh_dong';
  // Ghi số tay CHỈ cho đo lường; kế hoạch tick bước, hành động bấm "đã đạt".
  const ghiTay = mt.loai_moc === 'do_luong' && (mt.nguon_so === 'ghi_tay' || mt.nguon_so === 'thanh_phan');

  return (
    <div
      data-kiem="the-muc-tieu"
      data-id={mt.id ?? ''}
      style={{
        borderColor: `color-mix(in srgb, ${mau.hex} 30%, white)`,
        background: `color-mix(in srgb, ${mau.hex} 9%, white)`,
      }}
      className="relative flex flex-col gap-3 rounded-[16px] border-[1.5px] p-4"
    >
      <div className="flex items-start gap-3.5">
        {/* Ghi số: nút nhỏ góc phải hàng đầu — không chiếm một dòng riêng. */}
        {ghiTay && canGhi && mt.trang_thai !== 'dong' && (
          <div className="absolute right-3 top-3 z-[1]">
            <GhiSo mtId={mt.id ?? ''} dv={mt.ten_don_vi ?? ''} onDone={onDone} />
          </div>
        )}
        {coQuang ? (
          <DonutRing pct={mt.pct ?? 0} color={mau.hex} size={60} />
        ) : (
          <span
            className={`grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full text-center text-chu-thich font-extrabold leading-tight ${
              mt.dat ? 'bg-success/15 text-success-dark' : 'bg-navy/[0.07] text-grey-mid'
            }`}
          >
            {mt.dat ? t('daDat') : t('chuaDat')}
          </span>
        )}

        <div className={`min-w-0 flex-1 ${ghiTay && canGhi && mt.trang_thai !== 'dong' ? 'pr-16' : ''}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              style={{background: `color-mix(in srgb, ${mau.hex} 16%, white)`}}
              className="rounded-full px-2 py-0.5 text-chu-thich font-extrabold text-navy"
            >
              {nhanLinhVuc}
            </span>
            <span className="font-display text-doc font-bold leading-tight text-navy">{mt.ten}</span>
            <ChipTrangThai mt={mt} />
          </div>

          {/* Số: gộp MỘT dòng "1/10 Sách · trước 03/02/2027" như thẻ của thầy cô (góp ý 03/09) —
              hai dòng "Từ 0 lên…" + "Đang ở…" nói cùng một chuyện. Kiểu khác (giữ, trần…) giữ cauDich. */}
          {mt.so != null && mt.y_so != null && (mt.kieu_dich ?? 'toi') === 'toi' ? (
            <p className="mt-1 text-than font-bold tabular-nums text-navy">
              {dinhSo(mt.so)}
              <span className="font-semibold text-grey-mid">/{dinhSo(mt.y_so)} {mt.ten_don_vi ?? ''}{mt.ket_thuc ? ` · ${t('truocNgay', {ngay: ngayVN(mt.ket_thuc)})}` : ''}</span>
            </p>
          ) : (
            <>
              <p className="mt-1 text-than font-semibold tabular-nums text-grey-mid">{cauDich(mt, t)}</p>
              {mt.so != null && (
                <p className="mt-1 text-than font-bold text-navy">{t('dangO', {so: dinhSo(mt.so), dv: mt.ten_don_vi ?? ''})}</p>
              )}
            </>
          )}

          {/* DÂY — hướng tới / góp số vào mục tiêu cha. */}
          {noi.map((n) => (
            <span
              key={n.id}
              className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-gold/[0.16] px-2 py-0.5 text-chu-thich font-extrabold text-gold-text"
            >
              <CornerDownRight size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />
              <span className="truncate">
                {t(n.lop_khac ? 'gopVaoLopCu' : n.vai === 'gop_so' ? 'gopVao' : 'huongVao', {ten: n.cha_ten})}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* NHẬN XÉT TRẢ LẠI — hiện ngay trên thẻ để em biết sửa gì. */}
      {mt.trang_thai === 'tra_lai' && mt.ly_do_tra_lai && (
        <p className="rounded-[12px] bg-status-bad/[0.07] px-2.5 py-2 text-chu-thich font-semibold leading-relaxed text-navy">
          {t('lyDoTraLai', {note: mt.ly_do_tra_lai})}
        </p>
      )}


      {/* KẾ HOẠCH — checklist các bước: tick 1 bước → % tự nhảy (buoc.xong_at → trigger). */}
      {laKeHoach && buoc.length > 0 && mt.trang_thai !== 'dong' && (
        <div className="flex flex-col gap-1.5 rounded-[12px] bg-white/60 p-2.5">
          <p className="flex items-center gap-1.5 text-chu-thich font-extrabold uppercase tracking-wide text-grey-mid">
            <ListChecks size={14} strokeWidth={2.5} />
            {t('cacBuoc')}
          </p>
          {buoc.map((b) => {
            const noiDungBuoc = (
              <>
                <span className="grid h-[22px] w-[22px] shrink-0 place-items-center">
                  {b.xong ? (
                    <span style={{background: mau.hex}} className="grid h-[22px] w-[22px] place-items-center rounded-full text-white">
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <Circle size={20} strokeWidth={2} className="text-navy/25" />
                  )}
                </span>
                <span className={`min-w-0 flex-1 text-than font-semibold leading-snug ${b.xong ? 'text-grey-mid line-through' : 'text-navy'}`}>
                  {b.tieu_de}
                </span>
                <span className="shrink-0 text-chu-thich font-extrabold tabular-nums text-grey-mid">{Math.round(b.phan_tram)}%</span>
              </>
            );
            return canGhi ? (
              <form key={b.id} action={datBuocXong} data-kiem="buoc-tick">
                <input type="hidden" name="buoc_id" value={b.id} />
                <input type="hidden" name="xong" value={b.xong ? '' : '1'} />
                <SubmitButton
                  className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-1.5 text-left transition-colors hover:bg-navy/[0.04]"
                  wrapClass="contents"
                >
                  {noiDungBuoc}
                </SubmitButton>
              </form>
            ) : (
              <div key={b.id} className="flex min-h-[36px] items-center gap-2.5 px-1.5">
                {noiDungBuoc}
              </div>
            );
          })}
        </div>
      )}

      {/* HÀNH ĐỘNG — một nút "đã đạt" (0↔100%), không gõ số. */}
      {laHanhDong && canGhi && mt.trang_thai !== 'dong' && (
        <form action={datHanhDong}>
          <input type="hidden" name="muc_tieu_id" value={mt.id ?? ''} />
          <input type="hidden" name="dat" value={mt.dat ? '' : '1'} />
          <SubmitButton
            className={
              mt.dat
                ? 'inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[12px] border-[1.5px] border-success/40 bg-success/[0.12] px-3.5 text-than font-extrabold text-success-dark transition-colors hover:bg-success/20'
                : `${btnGold} min-h-[44px]`
            }
            wrapClass="contents"
          >
            {mt.dat ? (
              <>
                <CheckCircle2 size={16} strokeWidth={2.5} />
                {t('daXong')}
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} />
                {t('danhDauDat')}
              </>
            )}
          </SubmitButton>
        </form>
      )}

      {/* CAM KẾT TUẦN + THƯỚC ĐO của chính mục tiêu này — nằm TRONG thẻ (như thẻ của thầy cô). */}
      {mt.trang_thai === 'duyet' && loTrinh}

      {/* Hàng nút. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-navy/[0.06] pt-2.5">
        {canManage && mt.trang_thai === 'gui' && (
          <>
            <form action={duyetMucTieu}>
              <input type="hidden" name="muc_tieu_id" value={mt.id ?? ''} />
              <input type="hidden" name="student_id" value={studentId} />
              <SubmitButton className={btnGold} wrapClass="contents">
                <Check size={14} strokeWidth={2.5} />
                {t('duyet')}
              </SubmitButton>
            </form>
            <NutTraLai mtId={mt.id ?? ''} studentId={studentId} ten={mt.ten ?? ''} />
          </>
        )}

        {laChinhEm && (
          <>
            <button
              type="button"
              onClick={onSua}
              aria-label={t('sua')}
              title={t('sua')}
              className="cham-44 grid h-7 w-7 cursor-pointer place-items-center rounded-[8px] text-navy transition-colors hover:bg-navy/[0.06]"
            >
              <Pencil size={14} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Nhãn trạng thái đo (tt_*) + chip vòng duyệt.
function ChipTrangThai({mt}: {mt: MucTieuV}) {
  const t = useTranslations('mucTieu');
  const chips: {key: string; cls: string}[] = [];
  if (mt.trang_thai === 'gui') chips.push({key: 'choDuyet', cls: 'bg-gold/25 text-gold-text'});
  else if (mt.trang_thai === 'tra_lai') chips.push({key: 'traLai', cls: 'bg-status-bad/[0.12] text-status-bad'});
  else if (mt.trang_thai === 'nhap') chips.push({key: 'nhap', cls: 'bg-navy/[0.07] text-grey-mid'});
  else if (mt.trang_thai === 'dong') chips.push({key: 'daDong', cls: 'bg-navy/[0.07] text-grey-mid'});
  const ttDo = mt.trang_thai_do;
  const ttKey = ttDo && ['dat', 'dang_thang', 'dang_giu', 'dang_lam', 'chua_biet', 'can_co', 'vuot', 'truot', 'mien', 'dong'].includes(ttDo)
    ? `tt_${ttDo}`
    : null;
  return (
    <>
      {mt.trang_thai !== 'dong' && ttKey && (
        <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold text-navy">{t(ttKey)}</span>
      )}
      {chips.map((c) => (
        <span key={c.key} className={`rounded-full px-2 py-0.5 text-chu-thich font-extrabold ${c.cls}`}>
          {t(c.key)}
        </span>
      ))}
    </>
  );
}

// GHI SỐ — ô nhỏ để em điền số đo hôm nay (nguon_so='ghi_tay'), gọi ghiSoDo.
function GhiSo({mtId, dv, onDone}: {mtId: string; dv: string; onDone: (msg: string) => void}) {
  const t = useTranslations('mucTieu');
  const [mo, setMo] = useState(false);
  const [gia, setGia] = useState('');
  const [ngay, setNgay] = useState('');
  const [state, formAction] = useActionState<MucTieuState, FormData>(ghiSoDo, {ok: false});
  useEffect(() => {
    if (!state.ok) return;
    onDone(state.message ?? '');
    setMo(false);
    setGia('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Nút nhỏ ở góc phải thẻ (đỡ tốn một dòng riêng); bấm → Popup điền số.
  return (
    <>
      <button
        type="button"
        data-kiem="nut-ghi"
        onClick={() => setMo(true)}
        className="cham-44 shrink-0 cursor-pointer rounded-[8px] border-[1.5px] border-navy/20 bg-white/80 px-2.5 py-1 text-chu-thich font-extrabold text-navy transition-all hover:border-navy"
      >
        {t('ghiSo')}
      </button>
      {mo && (
        <Popup title={t('ghiSo')} onClose={() => setMo(false)} width="max-w-[420px]">
          <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="muc_tieu_id" value={mtId} />
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('ghiSoHoi', {ngay: ngay ? ngayVN(ngay) : ''})} htmlFor="gs-gia" error={state.fieldError === 'gia_tri' ? state.error : null}>
          <input
            id="gs-gia"
            data-kiem="o-so"
            name="gia_tri"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            value={gia}
            onChange={(e) => setGia(e.target.value)}
            placeholder={dv}
            className={ctlWithBorder(state.fieldError === 'gia_tri')}
          />
        </Field>
        <Field label={t('ghiSoNgay')}>
          <ONgayVN name="ngay" nhan={t('ghiSoNgay')} value={ngay} onChange={setNgay} />
        </Field>
      </div>
      {state.error && !state.fieldError && <p className="text-chu-thich font-bold text-status-bad">{state.error}</p>}
      <div className="flex items-center gap-3">
        <SubmitButton className={btnGold} wrapClass="contents">
          {t('ghiSoLuu')}
        </SubmitButton>
        <button type="button" onClick={() => setMo(false)} className="text-chu-thich font-extrabold text-grey-mid underline">
          {t('thoi')}
        </button>
      </div>
          </form>
        </Popup>
      )}
    </>
  );
}

// Nút Đóng mục tiêu — hỏi lý do (dat/doi/bo).
function NutDong({mtId, studentId}: {mtId: string; studentId: string}) {
  const t = useTranslations('mucTieu');
  const [mo, setMo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-[24px] cursor-pointer items-center text-chu-thich font-extrabold text-grey-mid underline"
      >
        {t('dong')}
      </button>
      {mo && (
        <Popup title={t('dong')} onClose={() => setMo(false)} width="max-w-[420px]">
          <form action={dongMucTieu} className="flex flex-col gap-3">
            <input type="hidden" name="muc_tieu_id" value={mtId} />
            <input type="hidden" name="student_id" value={studentId} />
            <p className="text-than font-bold text-navy">{t('dongVi')}</p>
            <div className="flex flex-col gap-1.5">
              {(['dat', 'doi', 'bo'] as const).map((ld, i) => (
                <label key={ld} className="flex cursor-pointer items-center gap-2 text-than font-semibold text-navy">
                  <input type="radio" name="ly_do_dong" value={ld} defaultChecked={i === 0} className="h-4 w-4" />
                  {t(ld === 'dat' ? 'dongDat' : ld === 'doi' ? 'dongDoi' : 'dongBo')}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('dong')}
              </SubmitButton>
              <button type="button" onClick={() => setMo(false)} className="text-chu-thich font-extrabold text-grey-mid underline">
                {t('thoi')}
              </button>
            </div>
          </form>
        </Popup>
      )}
    </>
  );
}

// Nút Trả lại của cô — đòi một câu nhận xét.
function NutTraLai({mtId, studentId, ten}: {mtId: string; studentId: string; ten: string}) {
  const t = useTranslations('mucTieu');
  const [mo, setMo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-[24px] cursor-pointer items-center text-chu-thich font-extrabold text-status-bad underline"
      >
        {t('traLaiNut')}
      </button>
      {mo && (
        <Popup title={t('traLaiNut')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={traLaiMucTieu} className="flex flex-col gap-3">
            <input type="hidden" name="muc_tieu_id" value={mtId} />
            <input type="hidden" name="student_id" value={studentId} />
            <p className="text-than font-bold text-navy">{ten}</p>
            <textarea
              name="note"
              required
              maxLength={300}
              rows={3}
              className="w-full rounded-[12px] border-[1.5px] border-navy/15 bg-white px-3 py-2.5 text-than font-semibold text-navy outline-none focus:border-navy"
            />
            <div className="flex items-center gap-3">
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('traLaiNut')}
              </SubmitButton>
              <button type="button" onClick={() => setMo(false)} className="text-chu-thich font-extrabold text-grey-mid underline">
                {t('thoi')}
              </button>
            </div>
          </form>
        </Popup>
      )}
    </>
  );
}

// ── Chuỗi câu đích + nguồn ────────────────────────────────────────────────────────────────────
type TFn = ReturnType<typeof useTranslations>;

function dinhSo(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Câu đích: tuDen / tuDenGiam / chuaBietDen / giuMuc / moiKyKhongQua / caNamKhongQua.
function cauDich(mt: MucTieuV, t: TFn): string {
  const dv = mt.ten_don_vi ?? '';
  const y = mt.y_so != null ? dinhSo(mt.y_so) : (mt.y_chu ?? '');
  const x = mt.x_so != null ? dinhSo(mt.x_so) : '0';
  const ngay = mt.ket_thuc ? ngayVN(mt.ket_thuc) : '';
  const kd = mt.kieu_dich ?? 'toi';
  if (kd === 'chu') return String(mt.y_chu ?? '');
  if (kd === 'giu') return t('giuMuc', {dau: mt.chieu === 'giam' ? '≤' : '≥', y, dv});
  if (kd === 'toc_do_ky') return t('moiKyKhongQua', {ky: mt.ky === 'thang' ? t('kyThang') : t('kyTuan'), y, dv});
  if (kd === 'tran_tich_luy') return t('caNamKhongQua', {y, dv});
  if (mt.chua_do_x) return t('chuaBietDen', {y, dv, ngay});
  if (mt.chieu === 'giam') return t('tuDenGiam', {x, y, dv, ngay});
  return t('tuDen', {x, y, dv, ngay});
}

// Nguồn số: em ghi / thầy cô ghi / máy cộng / máy hệ thống / gộp con / gộp phần.
function nguonChu(mt: MucTieuV, t: TFn): string {
  const ngay = mt.ngay_nguon ? ngayVN(mt.ngay_nguon) : '';
  switch (mt.nguon) {
    case 'ghi_tay':
      return t('nguonEm', {ngay});
    case 'he_thong':
      return t('nguonHeThong', {nguon: '', ngay});
    case 'may_tu_thuoc':
      return t('nguonMay', {n: mt.so_nguon ?? 0});
    case 'may_tu_con':
      return t('nguonCon', {n: mt.so_nguon ?? 0});
    case 'may_tu_thanh_phan':
      return t('nguonThanhPhan', {n: mt.so_nguon ?? 0});
    default:
      return t('nguonEm', {ngay});
  }
}
