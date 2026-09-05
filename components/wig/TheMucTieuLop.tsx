import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import {areaLabel} from '@/lib/areas';
import type {AreaMeta} from '@/lib/areas';
import {ngayVN} from '@/lib/dates';
import {DonutRing} from '@/components/charts/DonutRing';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {FormTaiCho, LoiO, NutGui, ONhap} from '@/components/ui/FormTaiCho';
import {ThaoTacMucTieuLop} from '@/components/wig/ThaoTacMucTieuLop';
import type {DangSuaMt, DonViChon} from '@/components/student/FormMucTieu';
import {datBuocXong, datHanhDong} from '@/app/[locale]/(dashboard)/student/actions';
import {ghiSoMucTieuLop, noiWigTruong, goWigTruong} from '@/app/[locale]/(dashboard)/wig/lop-actions';
import {dinhSo, type BuocLop, type DayNoi, type LichSuTuan, type MucTieuV, type TruongWig} from '@/components/wig/kieu-wig';

// BIỂU ĐỒ THẬT — cột dồn = số THẬT của mục tiêu ở cuối mỗi tuần (0175) + một vạch ĐÍCH. Không có
// đường dự đoán/pace nên không thể vẽ sai.
export function BieuDoThat({lichSu, dich, mau}: {lichSu: LichSuTuan; dich: number; mau: string}) {
  if (lichSu.length < 2 || dich <= 0) return null;
  const W = 240;
  const H = 40;
  const n = lichSu.length;
  const bw = W / n;
  const maxSo = Math.max(...lichSu.map((p) => p.so));
  const dinh = Math.max(maxSo * 1.18, 1);
  const dichTrongKhung = dich <= dinh;
  const yDich = 6 + (H - 6) * (1 - dich / dinh);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[200px] max-w-full" style={{height: 40}} preserveAspectRatio="none" role="img" aria-label="Biểu đồ số thật theo tuần">
      {dichTrongKhung && (
        <line x1="0" y1={yDich} x2={W} y2={yDich} stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" className="text-grey-mid" opacity="0.55" />
      )}
      {lichSu.map((p, i) => {
        const h = Math.max(2, (H - 8) * (p.so / dinh));
        return <rect key={i} x={i * bw + bw * 0.16} y={H - h} width={bw * 0.68} height={h} rx="2" fill={mau} opacity={i === n - 1 ? 1 : 0.42} />;
      })}
    </svg>
  );
}

// THẺ MỘT MỤC TIÊU CỦA LỚP — server component (tách khỏi wig/page.tsx 04/09).
// chiDoc = ban giám hiệu / GV không chủ nhiệm xem: giấu mọi nút ghi (RLS vẫn là luật thật).
export async function TheMucTieuLop({
  m,
  meta,
  locale,
  buoc,
  lichSu,
  noiTruong,
  truongWigs,
  tenTruong,
  classId,
  weekQ,
  nhanTheoArea,
  donViList,
  chiDoc,
}: {
  m: MucTieuV;
  meta: AreaMeta;
  locale: string;
  buoc: BuocLop[];
  lichSu: LichSuTuan;
  noiTruong: DayNoi | null;
  truongWigs: TruongWig[];
  tenTruong: Map<string, string>;
  classId: string;
  weekQ: string;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
  chiDoc: boolean;
}) {
  const t = await getTranslations('lopMucTieu');
  const tMt = await getTranslations('mucTieu');
  const dv = m.ten_don_vi ?? '';
  const nhan =
    m.trang_thai === 'nhap'
      ? {text: tMt('nhap'), cls: 'bg-navy/[0.06] text-grey-mid'}
      : m.trang_thai === 'gui'
        ? {text: tMt('choBghDuyet'), cls: 'bg-gold/[0.18] text-gold-text'}
        : m.trang_thai === 'tra_lai'
          ? {text: tMt('traLai'), cls: 'bg-status-bad/[0.12] text-status-bad'}
          : null;
  const nutPhu = 'rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-than font-extrabold text-navy transition-all hover:border-navy focus-visible:ring-2 focus-visible:ring-gold';
  const ctx = (
    <>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="week" value={weekQ} />
    </>
  );

  return (
    <div
      style={{borderColor: `color-mix(in srgb, ${meta.hex} 30%, white)`, background: `color-mix(in srgb, ${meta.hex} 6%, white)`}}
      className="flex flex-col gap-2 rounded-[16px] border-[1.5px] p-3.5"
    >
      <div className="flex flex-wrap items-start gap-3.5">
        {m.pct != null ? (
          <DonutRing pct={Number(m.pct)} color={meta.hex} size={54} />
        ) : (
          <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-chu-thich font-extrabold text-grey-mid">—</span>
        )}
        <div className="min-w-0 flex-1 basis-[190px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-chu-thich font-extrabold" style={{background: meta.soft, color: meta.hex}}>
              {areaLabel(meta, locale)}
            </span>
            <span className="min-w-0 flex-1 font-display text-doc font-bold text-navy">{m.ten ?? areaLabel(meta, locale)}</span>
            {nhan && <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-chu-thich font-extrabold ${nhan.cls}`}>{nhan.text}</span>}
          </div>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-chu-thich font-semibold text-grey-mid">
            {m.nguon_so === 'dem_em' ? (
              <span data-kiem="mt-lop-dem-em" className="text-noi-dung font-extrabold tabular-nums text-navy">
                {t('demEmDat', {dat: m.tu_so ?? 0, tong: m.mau_so ?? 0})}
                <span className="font-bold text-grey-mid">
                  {' · '}
                  {dinhSo(m.so ?? 0)}% / {dinhSo(m.y_so ?? 0)}%
                </span>
              </span>
            ) : m.loai_moc === 'do_luong' && m.y_so != null ? (
              <span className="text-noi-dung font-extrabold tabular-nums text-navy">
                {m.so != null ? dinhSo(m.so) : '—'}
                <span className="font-bold text-grey-mid">
                  {' / '}
                  {dinhSo(m.y_so)} {dv}
                </span>
              </span>
            ) : null}
            <span>{tMt('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
          </p>
          {m.trang_thai === 'tra_lai' && m.ly_do_tra_lai && (
            <p className="mt-1 text-chu-thich font-semibold text-status-bad">{tMt('lyDoTraLai', {note: m.ly_do_tra_lai})}</p>
          )}
        </div>
        {m.y_so != null && lichSu.length >= 2 && (
          <div className="ml-auto shrink-0 self-center">
            <BieuDoThat lichSu={lichSu} dich={Number(m.y_so)} mau={meta.hex} />
          </div>
        )}
      </div>

      {m.mo_ta && (
        <p className="mt-1 rounded-[12px] bg-white/70 px-2.5 py-2 text-center text-chu-thich font-semibold leading-relaxed text-navy">{m.mo_ta}</p>
      )}

      {/* KẾ HOẠCH — checklist các bước. Đã duyệt & không chỉ-đọc: tick (% nhảy qua trigger). */}
      {m.loai_moc === 'ke_hoach' && buoc.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 rounded-[12px] bg-white/70 p-2.5">
          {buoc.map((b) => {
            const noiDung = (
              <>
                <span className="grid h-[22px] w-[22px] shrink-0 place-items-center">
                  {b.xong ? (
                    <span style={{background: meta.hex}} className="grid h-[22px] w-[22px] place-items-center rounded-full text-white">
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <span className="h-[20px] w-[20px] rounded-full border-2 border-navy/25" />
                  )}
                </span>
                <span className={`min-w-0 flex-1 text-than font-semibold leading-snug ${b.xong ? 'text-grey-mid line-through' : 'text-navy'}`}>{b.tieu_de}</span>
                <span className="shrink-0 text-chu-thich font-extrabold tabular-nums text-grey-mid">{Math.round(b.phan_tram)}%</span>
              </>
            );
            return m.trang_thai === 'duyet' && !chiDoc ? (
              <form key={b.id} action={datBuocXong}>
                <input type="hidden" name="buoc_id" value={b.id} />
                <input type="hidden" name="xong" value={b.xong ? '' : '1'} />
                <SubmitButton className="flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-1.5 text-left transition-colors hover:bg-navy/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" wrapClass="contents">
                  {noiDung}
                </SubmitButton>
              </form>
            ) : (
              <div key={b.id} className="flex min-h-[36px] items-center gap-2.5 px-1.5">{noiDung}</div>
            );
          })}
        </div>
      )}

      {m.loai_moc === 'hanh_dong' && m.trang_thai !== 'duyet' && m.trang_thai !== 'dong' && (
        <p className="mt-1 text-chu-thich font-semibold italic text-grey-mid">{t('hanhDongCachDo')}</p>
      )}
      {m.loai_moc === 'hanh_dong' && m.trang_thai === 'duyet' && !chiDoc && (
        <form action={datHanhDong} className="mt-1">
          <input type="hidden" name="muc_tieu_id" value={m.id} />
          <input type="hidden" name="dat" value={m.dat ? '' : '1'} />
          <SubmitButton
            className={
              m.dat
                ? 'inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border-[1.5px] border-success/40 bg-success/[0.12] px-3.5 text-than font-extrabold text-success-dark transition-colors hover:bg-success/20'
                : 'inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] bg-gold px-3.5 text-than font-extrabold text-navy transition-all hover:brightness-95'
            }
            wrapClass="contents"
          >
            <Check size={16} strokeWidth={2.5} />
            {m.dat ? tMt('daXong') : tMt('danhDauDat')}
          </SubmitButton>
        </form>
      )}

      {/* NGUỒN SỐ + HƯỚNG LÊN TRƯỜNG — chỉ khi đã duyệt. Nút đi đường state: thẻ đứng yên, lỗi tại chỗ. */}
      {m.trang_thai === 'duyet' && (
        <div className="mt-1 flex flex-col gap-2 rounded-[12px] bg-white/60 p-2.5">
          {m.nguon_so === 'con' ? (
            <p className="text-chu-thich font-semibold text-grey-mid">{t('nguonTuThayCo')}</p>
          ) : m.nguon_so === 'dem_em' ? (
            <p className="text-chu-thich font-semibold text-grey-mid">{t('nguonDemEm')}</p>
          ) : m.loai_moc === 'do_luong' && m.nguon_so === 'ghi_tay' && !chiDoc ? (
            <FormTaiCho action={ghiSoMucTieuLop} className="flex flex-wrap items-end gap-2">
              {ctx}
              <input type="hidden" name="muc_tieu_id" value={m.id} />
              <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
                {t('ghiSoNhan')}
                <ONhap
                  type="number"
                  name="gia_tri"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  placeholder={dv}
                  className="ctl-h w-32 rounded-[12px] border-[1.5px] bg-white px-3 text-base font-semibold text-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
                />
              </label>
              <NutGui className={nutPhu}>{t('ghiSoLuu')}</NutGui>
              <LoiO ten="gia_tri" />
            </FormTaiCho>
          ) : null}
          {noiTruong ? (
            <div className="flex flex-wrap items-center gap-2 text-chu-thich font-semibold text-grey-mid">
              <span>{t('huongTruong', {ten: tenTruong.get(noiTruong.chaId) ?? ''})}</span>
              {!chiDoc && (
                <FormTaiCho action={goWigTruong} anThanhCong className="contents">
                  {ctx}
                  <input type="hidden" name="muc_tieu_id" value={m.id} />
                  <input type="hidden" name="truong_id" value={noiTruong.chaId} />
                  <NutGui className="rounded-[8px] px-2 text-chu-thich font-bold text-grey-mid hover:text-status-bad focus-visible:ring-2 focus-visible:ring-gold">{t('goTruong')}</NutGui>
                </FormTaiCho>
              )}
            </div>
          ) : truongWigs.length > 0 && !chiDoc ? (
            <FormTaiCho action={noiWigTruong} anThanhCong className="flex flex-wrap items-end gap-2">
              {ctx}
              <input type="hidden" name="muc_tieu_id" value={m.id} />
              <label className="flex min-w-0 flex-col gap-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
                {t('chonTruong')}
                <ONhap as="select" name="truong_id" defaultValue="" className="ctl-h max-w-full rounded-[12px] border-[1.5px] bg-white px-3 text-base font-semibold text-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm">
                  <option value="">{t('chonTruong')}</option>
                  {truongWigs.map((tw) => (
                    <option key={tw.id} value={tw.id}>
                      {tw.ten}
                    </option>
                  ))}
                </ONhap>
              </label>
              <NutGui className={nutPhu}>{t('noiTruongNut')}</NutGui>
              <LoiO ten="truong_id" />
            </FormTaiCho>
          ) : null}
        </div>
      )}

      {!chiDoc && (
        <ThaoTacMucTieuLop
          goal={m as unknown as DangSuaMt}
          classId={classId}
          weekQ={weekQ}
          nhanTheoArea={nhanTheoArea}
          donViList={donViList}
          buocDangSua={buoc.map((b) => ({tieu_de: b.tieu_de, phan_tram: b.phan_tram, bat_dau: null, ket_thuc: null, mo_ta: null}))}
        />
      )}
    </div>
  );
}
