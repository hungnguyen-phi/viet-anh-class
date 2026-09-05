import {getTranslations} from 'next-intl/server';
import {Trash2, Lock} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {ngayVN} from '@/lib/dates';
import {areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {DonutRing} from '@/components/charts/DonutRing';
import {FormTaiCho, LoiO, NutGui, ONhap} from '@/components/ui/FormTaiCho';
import {NutTaoMucTieuTruong} from '@/components/wig/NutTaoMucTieuTruong';
import type {DonViChon} from '@/components/student/FormMucTieu';
import {dongMucTieuTruong, ghiSoMucTieuTruong, xoaMucTieuTruong} from '@/app/[locale]/(dashboard)/truong/truong-actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// KHU MỤC TIÊU CỦA TRƯỜNG — server component, sống TRONG popup "Mục tiêu của lớp và trường"
// trên /wig (04/09). Chỉ hiện CƠ SỞ của lớp đang xem. laQuanTri (admin/BGH) mới thấy nút tạo /
// ghi số / đóng / xoá — GVCN chỉ xem để nối hướng. Mọi nút đi đường state (FormTaiCho): popup
// đứng yên, lỗi hiện tại chỗ, không redirect.
// ════════════════════════════════════════════════════════════════════════════════════════════

export async function KhuMucTieuTruong({
  campusId,
  locale,
  laQuanTri,
  nhanTheoArea,
  donViList,
}: {
  campusId: string;
  locale: string;
  laQuanTri: boolean;
  nhanTheoArea: Record<string, string>;
  donViList: DonViChon[];
}) {
  const t = await getTranslations('truongWig');
  const tMt = await getTranslations('mucTieu');
  const tf = await getTranslations('formChung');
  const supabase = await createClient();
  const areaMeta = await getAreaMeta();

  const {data: mtRows} = await supabase
    .from('muc_tieu_v')
    .select('id, ten, linh_vuc, loai_moc, trang_thai, ket_thuc, x_so, y_so, ten_don_vi, so, pct, nguon_so, tu_so, mau_so')
    .eq('campus_id', campusId)
    .eq('cap', 'truong')
    .neq('trang_thai', 'dong');
  const mucTieu = (mtRows ?? []) as {
    id: string;
    ten: string | null;
    linh_vuc: Area | null;
    loai_moc: string | null;
    trang_thai: string | null;
    ket_thuc: string | null;
    x_so: number | null;
    y_so: number | null;
    ten_don_vi: string | null;
    so: number | null;
    pct: number | null;
    nguon_so: string | null;
    tu_so: number | null;
    mau_so: number | null;
  }[];

  // Các lớp đã nối vào từng mục tiêu trường (con là mục tiêu LỚP) — sau 0182 chỉ còn giữ hướng.
  const ids = mucTieu.map((m) => m.id);
  const {data: noiRows} = ids.length
    ? await supabase
        .from('noi')
        .select('cha_id, vai, con:con_muc_tieu_id(id, ten, class_id, classes(name))')
        .in('cha_id', ids)
        .not('con_muc_tieu_id', 'is', null)
    : {data: null};
  type NoiRow = {
    cha_id: string;
    vai: string;
    con: {id: string; ten: string | null; class_id: string | null; classes: {name: string} | {name: string}[] | null} | null;
  };
  const lopTheoTruong = new Map<string, {ten: string; lop: string}[]>();
  for (const n of ((noiRows ?? []) as unknown as NoiRow[]).filter((n) => n.vai === 'chi_huong')) {
    if (!n.con) continue;
    const cls = Array.isArray(n.con.classes) ? n.con.classes[0] : n.con.classes;
    const arr = lopTheoTruong.get(n.cha_id) ?? [];
    arr.push({ten: n.con.ten ?? '', lop: cls?.name ?? ''});
    lopTheoTruong.set(n.cha_id, arr);
  }

  const dinhSo = (n: number) => (Math.round(n * 10) / 10).toString();
  const nutPhu = 'rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-than font-extrabold text-navy transition-all hover:border-navy focus-visible:ring-2 focus-visible:ring-gold';

  return (
    <section className="flex flex-col gap-3 rounded-[16px] bg-navy/[0.03] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-noi-dung font-bold text-navy">{t('khu')}</h3>
        {laQuanTri && (
          <div className="ml-auto">
            <NutTaoMucTieuTruong campusId={campusId} nhanTheoArea={nhanTheoArea} donViList={donViList} />
          </div>
        )}
      </div>
      <p className="text-chu-thich font-semibold text-grey-mid">{t('giaiThich')}</p>

      {mucTieu.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-[16px] border-[1.5px] border-dashed border-navy/25 px-5 py-6 text-center">
          <Lock size={20} strokeWidth={2.5} className="text-grey-mid" />
          <p className="max-w-[440px] text-than font-semibold leading-relaxed text-grey-mid">
            {laQuanTri ? t('trong') : t('trongGvcn')}
          </p>
        </div>
      ) : (
        mucTieu.map((m) => {
          const meta = areaMeta[(m.linh_vuc ?? 'knowledge') as Area];
          const dsLop = lopTheoTruong.get(m.id) ?? [];
          return (
            <div
              key={m.id}
              style={{
                borderColor: `color-mix(in srgb, ${meta.hex} 30%, white)`,
                background: `color-mix(in srgb, ${meta.hex} 6%, white)`,
              }}
              className="flex flex-col gap-2 rounded-[16px] border-[1.5px] p-3.5"
            >
              <div className="flex flex-wrap items-start gap-3.5">
                {m.pct != null ? (
                  <DonutRing pct={Number(m.pct)} color={meta.hex} size={54} />
                ) : (
                  <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-chu-thich font-extrabold text-grey-mid">
                    —
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-chu-thich font-extrabold"
                      style={{background: meta.soft, color: meta.hex}}
                    >
                      {areaLabel(meta, locale)}
                    </span>
                    <span className="min-w-0 flex-1 font-display text-doc font-bold text-navy">{m.ten ?? ''}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-chu-thich font-semibold text-grey-mid">
                    {m.nguon_so === 'dem_em' ? (
                      <span className="text-noi-dung font-extrabold tabular-nums text-navy">
                        {t('demEmDat', {dat: m.tu_so ?? 0, tong: m.mau_so ?? 0})}
                        <span className="font-bold text-grey-mid">
                          {' · '}
                          {dinhSo(Number(m.so ?? 0))}% / {dinhSo(Number(m.y_so ?? 0))}%
                        </span>
                      </span>
                    ) : m.y_so != null ? (
                      <span className="text-noi-dung font-extrabold tabular-nums text-navy">
                        {m.so != null ? dinhSo(Number(m.so)) : '—'}
                        <span className="font-bold text-grey-mid">
                          {' / '}
                          {dinhSo(Number(m.y_so))} {m.ten_don_vi ?? ''}
                        </span>
                      </span>
                    ) : null}
                    <span>{tMt('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
                  </p>
                  {m.nguon_so === 'dem_em' && <p className="mt-0.5 text-chu-thich font-semibold text-grey-mid">{t('nguonDemEm')}</p>}
                </div>
                {laQuanTri && (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <FormTaiCho action={dongMucTieuTruong} xacNhan={tf('dongMucTieuHoi')} nhanXacNhan={t('dong')} anThanhCong>
                      <input type="hidden" name="muc_tieu_id" value={m.id} />
                      <input type="hidden" name="ly_do_dong" value="bo" />
                      <NutGui className={nutPhu}>{t('dong')}</NutGui>
                    </FormTaiCho>
                    <FormTaiCho action={xoaMucTieuTruong} xacNhan={tf('xoaMucTieuHoi')} nhanXacNhan={t('xoa')} nguyHiem anThanhCong>
                      <input type="hidden" name="muc_tieu_id" value={m.id} />
                      <NutGui
                        label={t('xoa')}
                        className="grid h-11 w-11 place-items-center rounded-[12px] text-status-bad transition-colors after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] hover:bg-status-bad/10 focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </NutGui>
                    </FormTaiCho>
                  </div>
                )}
              </div>

              {/* Ghi số — trường đo theo cách riêng, ban giám hiệu điền lại con số mới nhất. */}
              {laQuanTri && m.trang_thai === 'duyet' && m.loai_moc === 'do_luong' && m.nguon_so === 'ghi_tay' && (
                <FormTaiCho action={ghiSoMucTieuTruong} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="muc_tieu_id" value={m.id} />
                  <label className="flex flex-col gap-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
                    {t('ghiSoNhan')}
                    <ONhap
                      type="number"
                      name="gia_tri"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      placeholder={m.ten_don_vi ?? ''}
                      className="ctl-h w-32 rounded-[12px] border-[1.5px] bg-white px-3 text-base font-semibold text-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
                    />
                  </label>
                  <NutGui className={nutPhu}>{t('ghiSoLuu')}</NutGui>
                  <LoiO ten="gia_tri" />
                </FormTaiCho>
              )}

              {/* Các lớp đã hướng vào mục tiêu này. */}
              <div className="mt-1 rounded-[12px] bg-white/60 p-2.5">
                <p className="mb-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{t('lopDaNoi')}</p>
                {dsLop.length === 0 ? (
                  <p className="text-chu-thich font-semibold italic text-grey-mid">{t('chuaLopNao')}</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dsLop.map((l, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-than">
                        <span className="font-extrabold text-navy">{l.lop}</span>
                        <span className="min-w-0 flex-1 font-semibold text-grey-mid">{l.ten}</span>
                        <span className="inline-flex shrink-0 items-center rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-extrabold text-grey-mid">
                          {t('chiGiuHuong')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
