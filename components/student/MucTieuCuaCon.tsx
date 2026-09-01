'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, CheckCircle2, CornerDownRight, Pencil, Plus, Target, Focus} from 'lucide-react';
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
} from '@/components/student/FormMucTieu';
import {
  datTapTrung,
  dongMucTieu,
  duyetMucTieu,
  traLaiMucTieu,
  ghiSoDo,
  noiNguon,
  goNguon,
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
  noiTheoMt = {},
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
  /** Dây nối theo id mục tiêu con. */
  noiTheoMt?: Record<string, NoiHienThi[]>;
}) {
  const t = useTranslations('mucTieu');
  const [bao, setBao] = useState('');
  // moForm giữ lĩnh vực của ô em vừa bấm (đặt mới), hoặc id mục tiêu đang sửa.
  const [moForm, setMoForm] = useState<null | {area: string; suaId?: string}>(null);
  const theoArea = new Map(mucTieu.map((m) => [m.linh_vuc ?? 'knowledge', m]));
  const canGhi = laChinhEm;
  const dangSua = moForm?.suaId ? (mucTieu.find((m) => m.id === moForm.suaId) ?? null) : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {bao && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {bao}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {AREAS.map((a) => {
          const mt = theoArea.get(a);
          const nhan = nhanTheoArea[a] ?? a;
          const mau = mauTheoArea[a] ?? {hex: '#26275d', soft: 'rgba(38,39,93,0.06)'};
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
                mucTieuLop={mucTieuLop}
                noi={noiTheoMt[mt.id ?? ''] ?? []}
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
              onClick={() => setMoForm({area: a})}
              style={{
                borderColor: `color-mix(in srgb, ${mau.hex} 30%, white)`,
                background: `color-mix(in srgb, ${mau.hex} 9%, white)`,
              }}
              className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed p-4 text-navy transition-colors hover:bg-white/70"
            >
              <span style={{background: mau.hex}} className="grid h-9 w-9 place-items-center rounded-full text-white">
                <Plus size={18} strokeWidth={2.8} />
              </span>
              <span className="text-[13px] font-extrabold">{nhan}</span>
              {namHoc && <span className="text-[11px] font-semibold text-grey-mid">{namHoc}</span>}
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
              <span className="text-[13px] font-extrabold text-navy">{nhan}</span>
              <span className="text-[11.5px] font-semibold italic text-grey-mid">{t('trong')}</span>
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
          <Plus size={14} strokeWidth={2.8} />
          {t('them')}
        </button>
      )}

      {moForm && (
        <FormMucTieu3Buoc
          studentId={studentId}
          classId={classId}
          laChinhEm={laChinhEm}
          areaPreset={moForm.area}
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          monList={monList}
          mauList={mauList}
          mucTieuLop={mucTieuLop}
          dangSua={dangSua}
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
  mucTieuLop,
  noi,
  onSua,
  onDone,
}: {
  mt: MucTieuV;
  nhanLinhVuc: string;
  mau: {hex: string; soft: string};
  studentId: string;
  laChinhEm: boolean;
  canManage: boolean;
  mucTieuLop: MucTieuLopChon[];
  noi: NoiHienThi[];
  onSua: () => void;
  onDone: (msg: string) => void;
}) {
  const t = useTranslations('mucTieu');
  const canGhi = laChinhEm;
  const coQuang = mt.pct != null; // kiểu có quãng mới vẽ vòng %
  const ghiTay = mt.nguon_so === 'ghi_tay' || mt.nguon_so === 'thanh_phan';

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
        {coQuang ? (
          <DonutRing pct={mt.pct ?? 0} color={mau.hex} size={60} />
        ) : (
          <span
            className={`grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full text-center text-[10.5px] font-extrabold leading-tight ${
              mt.dat ? 'bg-success/15 text-success-dark' : 'bg-navy/[0.07] text-grey-mid'
            }`}
          >
            {mt.dat ? t('daDat') : t('chuaDat')}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              style={{background: `color-mix(in srgb, ${mau.hex} 16%, white)`}}
              className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
            >
              {nhanLinhVuc}
            </span>
            <span className="font-display text-[16px] font-bold leading-tight text-navy">{mt.ten}</span>
            {mt.dang_tap_trung && (
              <span className="inline-flex items-center gap-1 rounded-full bg-navy/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold text-navy">
                <Focus size={10} strokeWidth={2.8} />
                {t('dangTapTrung')}
              </span>
            )}
            <ChipTrangThai mt={mt} />
          </div>

          <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-grey-mid">{cauDich(mt, t)}</p>

          {/* ĐANG Ở — số hiện tại + nguồn. */}
          <p className="mt-1 text-[12.5px] font-bold text-navy">
            {mt.so == null ? (
              <span className="font-semibold italic text-grey-mid">{t('chuaCoSo')}</span>
            ) : (
              <>
                {t('dangO', {so: dinhSo(mt.so), dv: mt.ten_don_vi ?? ''})}
                <span className="ml-1 font-semibold text-grey-mid">· {nguonChu(mt, t)}</span>
              </>
            )}
          </p>
          {coQuang && mt.le_ra != null && (
            <p className="mt-0.5 text-[11.5px] font-semibold text-grey-mid">
              {t('leRaHomNay', {so: dinhSo(mt.le_ra), dv: mt.ten_don_vi ?? ''})}
            </p>
          )}

          {/* DÂY — hướng tới / góp số vào mục tiêu cha. */}
          {noi.map((n) => (
            <span
              key={n.id}
              className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-gold/[0.16] px-2 py-0.5 text-[11px] font-extrabold text-gold-text"
            >
              <CornerDownRight size={11} strokeWidth={2.5} className="shrink-0" aria-hidden />
              <span className="truncate">
                {t(n.lop_khac ? 'gopVaoLopCu' : n.vai === 'gop_so' ? 'gopVao' : 'huongVao', {ten: n.cha_ten})}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* NHẬN XÉT TRẢ LẠI — hiện ngay trên thẻ để em biết sửa gì. */}
      {mt.trang_thai === 'tra_lai' && mt.ly_do_tra_lai && (
        <p className="rounded-[10px] bg-status-bad/[0.07] px-2.5 py-2 text-[12px] font-semibold leading-relaxed text-navy">
          {t('lyDoTraLai', {note: mt.ly_do_tra_lai})}
        </p>
      )}

      {/* GHI SỐ — chỉ mục tiêu ĐO (ghi tay). */}
      {ghiTay && canGhi && mt.trang_thai !== 'dong' && <GhiSo mtId={mt.id ?? ''} dv={mt.ten_don_vi ?? ''} onDone={onDone} />}

      {/* Hàng nút. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-navy/[0.06] pt-2.5">
        {canManage && mt.trang_thai === 'gui' && (
          <>
            <form action={duyetMucTieu}>
              <input type="hidden" name="muc_tieu_id" value={mt.id ?? ''} />
              <input type="hidden" name="student_id" value={studentId} />
              <SubmitButton className={btnGold} wrapClass="contents">
                <Check size={13} strokeWidth={3} />
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
              className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[12px] font-extrabold text-navy underline"
            >
              <Pencil size={12} strokeWidth={2.5} />
              {t('sua')}
            </button>
            {mt.trang_thai === 'duyet' && (
              <form action={datTapTrung}>
                <input type="hidden" name="muc_tieu_id" value={mt.id ?? ''} />
                <input type="hidden" name="student_id" value={studentId} />
                <input type="hidden" name="bat" value={mt.dang_tap_trung ? '' : '1'} />
                <SubmitButton
                  className="inline-flex min-h-[24px] items-center gap-1 text-[12px] font-extrabold text-navy underline"
                  wrapClass="contents"
                >
                  <Target size={12} strokeWidth={2.5} />
                  {mt.dang_tap_trung ? t('boTapTrung') : t('tapTrung')}
                </SubmitButton>
              </form>
            )}
            {mt.trang_thai !== 'dong' && <NutDong mtId={mt.id ?? ''} studentId={studentId} />}
            {mucTieuLop.length > 0 && mt.trang_thai === 'duyet' && (
              <NutNoi mtId={mt.id ?? ''} studentId={studentId} mucTieuLop={mucTieuLop} noi={noi} />
            )}
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
  const ttKey = ttDo && ['dat', 'dang_thang', 'dang_giu', 'sat_nut', 'dang_lam', 'chua_biet', 'can_co', 'vuot', 'truot', 'mien', 'dong'].includes(ttDo)
    ? `tt_${ttDo}`
    : null;
  return (
    <>
      {mt.trang_thai !== 'dong' && ttKey && (
        <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-extrabold text-navy">{t(ttKey)}</span>
      )}
      {chips.map((c) => (
        <span key={c.key} className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${c.cls}`}>
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
  if (!mo)
    return (
      <button
        type="button"
        data-kiem="nut-ghi"
        onClick={() => setMo(true)}
        className={`${btnGhost} self-start`}
      >
        {t('ghiSo')}
      </button>
    );
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[10px] bg-white/70 p-2.5">
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
      {state.error && !state.fieldError && <p className="text-[12px] font-bold text-status-bad">{state.error}</p>}
      <div className="flex items-center gap-3">
        <SubmitButton className={btnGold} wrapClass="contents">
          {t('ghiSoLuu')}
        </SubmitButton>
        <button type="button" onClick={() => setMo(false)} className="text-[12px] font-extrabold text-grey-mid underline">
          {t('thoi')}
        </button>
      </div>
    </form>
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
        className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline"
      >
        {t('dong')}
      </button>
      {mo && (
        <Popup title={t('dong')} onClose={() => setMo(false)} width="max-w-[420px]">
          <form action={dongMucTieu} className="flex flex-col gap-3">
            <input type="hidden" name="muc_tieu_id" value={mtId} />
            <input type="hidden" name="student_id" value={studentId} />
            <p className="text-[13px] font-bold text-navy">{t('dongVi')}</p>
            <div className="flex flex-col gap-1.5">
              {(['dat', 'doi', 'bo'] as const).map((ld, i) => (
                <label key={ld} className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-navy">
                  <input type="radio" name="ly_do_dong" value={ld} defaultChecked={i === 0} className="h-4 w-4" />
                  {t(ld === 'dat' ? 'dongDat' : ld === 'doi' ? 'dongDoi' : 'dongBo')}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('dong')}
              </SubmitButton>
              <button type="button" onClick={() => setMo(false)} className="text-[12px] font-extrabold text-grey-mid underline">
                {t('thoi')}
              </button>
            </div>
          </form>
        </Popup>
      )}
    </>
  );
}

// Nút Nối dây — em tự hướng tới mục tiêu lớp (chi_huong; policy cho, không cần RPC — chốt C15).
function NutNoi({
  mtId,
  studentId,
  mucTieuLop,
  noi,
}: {
  mtId: string;
  studentId: string;
  mucTieuLop: MucTieuLopChon[];
  noi: NoiHienThi[];
}) {
  const t = useTranslations('mucTieu');
  const [mo, setMo] = useState(false);
  const daNoi = new Set(noi.map((n) => n.cha_ten));
  const conLai = mucTieuLop.filter((m) => !daNoi.has(m.ten));
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[12px] font-extrabold text-navy underline"
      >
        <CornerDownRight size={12} strokeWidth={2.5} />
        {t('noiThem')}
      </button>
      {mo && (
        <Popup title={t('noiThem')} onClose={() => setMo(false)} width="max-w-[460px]">
          <div className="flex flex-col gap-2">
            {noi.map((n) => (
              <form key={n.id} action={goNguon} className="flex items-center justify-between gap-2 rounded-[10px] bg-navy/[0.04] px-3 py-2">
                <span className="truncate text-[12.5px] font-bold text-navy">{n.cha_ten}</span>
                <input type="hidden" name="noi_id" value={n.id} />
                <input type="hidden" name="student_id" value={studentId} />
                <SubmitButton className="text-[11.5px] font-extrabold text-status-bad underline" wrapClass="contents">
                  {t('noiGo')}
                </SubmitButton>
              </form>
            ))}
            {conLai.length === 0 ? (
              <p className="text-[12px] font-semibold italic text-grey-mid">{t('noiTrong')}</p>
            ) : (
              conLai.map((m) => (
                <form key={m.id} action={noiNguon} className="flex items-center justify-between gap-2 rounded-[10px] border-[1.5px] border-navy/12 px-3 py-2">
                  <span className="truncate text-[12.5px] font-bold text-navy">{m.ten}</span>
                  <input type="hidden" name="student_id" value={studentId} />
                  <input type="hidden" name="cha_id" value={m.id} />
                  <input type="hidden" name="con_muc_tieu_id" value={mtId} />
                  <input type="hidden" name="vai" value="chi_huong" />
                  <SubmitButton className="text-[11.5px] font-extrabold text-navy underline" wrapClass="contents">
                    {t('noiChiHuong')}
                  </SubmitButton>
                </form>
              ))
            )}
          </div>
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
        className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-status-bad underline"
      >
        {t('traLaiNut')}
      </button>
      {mo && (
        <Popup title={t('traLaiNut')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={traLaiMucTieu} className="flex flex-col gap-3">
            <input type="hidden" name="muc_tieu_id" value={mtId} />
            <input type="hidden" name="student_id" value={studentId} />
            <p className="text-[13px] font-bold text-navy">{ten}</p>
            <textarea
              name="note"
              required
              maxLength={300}
              rows={3}
              className="w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2.5 text-[13px] font-semibold text-navy outline-none focus:border-navy"
            />
            <div className="flex items-center gap-3">
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('traLaiNut')}
              </SubmitButton>
              <button type="button" onClick={() => setMo(false)} className="text-[12px] font-extrabold text-grey-mid underline">
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
