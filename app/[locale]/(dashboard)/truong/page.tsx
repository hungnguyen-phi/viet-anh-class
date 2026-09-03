import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Trash2, Lock} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {Flash} from '@/components/ui/Flash';
import {Link} from '@/i18n/navigation';
import {ngayVN} from '@/lib/dates';
import {AREAS, areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {DonutRing} from '@/components/charts/DonutRing';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {NutTaoMucTieuTruong} from '@/components/wig/NutTaoMucTieuTruong';
import {dongMucTieuTruong, xoaMucTieuTruong} from './truong-actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// /truong — MỤC TIÊU CỦA TRƯỜNG (cap='truong'), chỉ admin/BGH (chốt 03/09).
//
// Chuỗi hội tụ: cam kết thầy cô → mục tiêu cá nhân thầy cô → mục tiêu lớp → mục tiêu TRƯỜNG.
// Ở đây: tạo mục tiêu trường theo cơ sở (admin tạo là duyệt luôn — duyet_duoc_chu_the), xem các
// lớp đã nối vào (chi_huong = giữ hướng; gop_so = máy cộng số), đóng/xoá. Số của mục tiêu trường
// đi qua muc_tieu_v như mọi cấp — màn này KHÔNG tự cộng gì.
// ════════════════════════════════════════════════════════════════════════════════════════════

export default async function TruongPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{campus?: string}>;
}) {
  const {locale} = await params;
  const {campus: campusParam} = await searchParams;
  setRequestLocale(locale);
  await requireRole(['admin', 'principal']);
  const t = await getTranslations('truongWig');
  const tMt = await getTranslations('mucTieu');
  const supabase = await createClient();
  const [areaMeta, {data: campusRows}, {data: dvRows}] = await Promise.all([
    getAreaMeta(),
    supabase.from('campuses').select('id, name').order('name'),
    supabase.from('don_vi').select('id, ma, nhan_vi, nhan_en').eq('is_active', true).order('ma'),
  ]);
  const campuses = (campusRows ?? []) as {id: string; name: string}[];
  const campus = campuses.find((c) => c.id === campusParam) ?? campuses[0];
  const nhanTheoArea = Object.fromEntries(AREAS.map((a) => [a, areaLabel(areaMeta[a], locale)]));
  const donViList = ((dvRows ?? []) as {id: string; ma: string; nhan_vi: string; nhan_en: string}[]).map((d) => ({
    id: d.id,
    ma: d.ma,
    nhan: locale === 'vi' ? d.nhan_vi : d.nhan_en,
  }));

  if (!campus) {
    return <p className="text-[13px] font-semibold text-grey-mid">{t('khongCoCoSo')}</p>;
  }

  const {data: mtRows} = await supabase
    .from('muc_tieu_v')
    .select('id, ten, linh_vuc, loai_moc, trang_thai, ket_thuc, x_so, y_so, ten_don_vi, so, pct, nguon_so')
    .eq('campus_id', campus.id)
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
  }[];

  // Các lớp đã nối vào từng mục tiêu trường (con là mục tiêu LỚP).
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
  const lopTheoTruong = new Map<string, {ten: string; lop: string; gop: boolean}[]>();
  const daGop = new Map<string, Set<string>>(); // cha → con ids có gop_so (để gộp hai vai một dòng)
  for (const n of ((noiRows ?? []) as unknown as NoiRow[]).filter((n) => n.vai === 'gop_so')) {
    if (!n.con) continue;
    const s = daGop.get(n.cha_id) ?? new Set<string>();
    s.add(n.con.id);
    daGop.set(n.cha_id, s);
  }
  for (const n of ((noiRows ?? []) as unknown as NoiRow[]).filter((n) => n.vai === 'chi_huong')) {
    if (!n.con) continue;
    const cls = Array.isArray(n.con.classes) ? n.con.classes[0] : n.con.classes;
    const arr = lopTheoTruong.get(n.cha_id) ?? [];
    arr.push({ten: n.con.ten ?? '', lop: cls?.name ?? '', gop: daGop.get(n.cha_id)?.has(n.con.id) ?? false});
    lopTheoTruong.set(n.cha_id, arr);
  }

  const dinhSo = (n: number) => (Math.round(n * 10) / 10).toString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-[22px] font-bold text-navy">
          {t('title')} · {campus.name}
        </h1>
        {campuses.length > 1 && (
          <div className="flex items-center gap-1.5">
            {campuses.map((c) => (
              <Link
                key={c.id}
                href={{pathname: '/truong', query: {campus: c.id}}}
                className={`rounded-[10px] border-[1.5px] px-2.5 py-1.5 text-[12px] font-extrabold transition-all ${
                  c.id === campus.id ? 'border-navy bg-navy text-white' : 'border-navy/20 bg-white text-navy hover:border-navy'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Flash />

      <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[15px] font-bold text-navy">{t('khu')}</h2>
          <div className="ml-auto">
            <NutTaoMucTieuTruong campusId={campus.id} nhanTheoArea={nhanTheoArea} donViList={donViList} />
          </div>
        </div>
        <p className="text-[11.5px] font-semibold text-grey-mid">{t('giaiThich')}</p>

        {mucTieu.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 rounded-[16px] border-[1.5px] border-dashed border-navy/25 px-5 py-7 text-center">
            <Lock size={18} strokeWidth={2.5} className="text-grey-mid" />
            <p className="max-w-[440px] text-[12.5px] font-semibold leading-relaxed text-grey-mid">{t('trong')}</p>
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
                className="flex flex-col gap-2 rounded-[14px] border-[1.5px] p-3.5"
              >
                <div className="flex flex-wrap items-start gap-3.5">
                  {m.pct != null ? (
                    <DonutRing pct={Number(m.pct)} color={meta.hex} size={54} />
                  ) : (
                    <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-[11px] font-extrabold text-grey-mid">
                      —
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                        style={{background: meta.soft, color: meta.hex}}
                      >
                        {areaLabel(meta, locale)}
                      </span>
                      <span className="min-w-0 flex-1 font-display text-[15px] font-bold text-navy">{m.ten ?? ''}</span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-grey-mid">
                      {m.y_so != null && (
                        <span className="text-[13.5px] font-extrabold tabular-nums text-navy">
                          {m.so != null ? dinhSo(Number(m.so)) : '–'}
                          <span className="font-bold text-grey-mid">
                            {' / '}
                            {dinhSo(Number(m.y_so))} {m.ten_don_vi ?? ''}
                          </span>
                        </span>
                      )}
                      <span>{tMt('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
                      {m.nguon_so === 'con' && <span>{t('nguonTuLop')}</span>}
                    </p>
                  </div>
                  {/* Đóng / Xoá. */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <form action={dongMucTieuTruong}>
                      <input type="hidden" name="campus" value={campus.id} />
                      <input type="hidden" name="muc_tieu_id" value={m.id} />
                      <input type="hidden" name="ly_do_dong" value="bo" />
                      <SubmitButton
                        className="rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1 text-[11px] font-extrabold text-navy transition-all hover:border-navy"
                        wrapClass="contents"
                      >
                        {t('dong')}
                      </SubmitButton>
                    </form>
                    <form action={xoaMucTieuTruong}>
                      <input type="hidden" name="campus" value={campus.id} />
                      <input type="hidden" name="muc_tieu_id" value={m.id} />
                      <SubmitButton
                        label={t('xoa')}
                        className="grid h-7 w-7 place-items-center rounded-[8px] text-status-bad transition-colors hover:bg-status-bad/10"
                        wrapClass="contents"
                      >
                        <Trash2 size={13} strokeWidth={2.5} />
                      </SubmitButton>
                    </form>
                  </div>
                </div>

                {/* Các lớp đã hướng vào mục tiêu này. */}
                <div className="mt-1 rounded-[12px] bg-white/60 p-2.5">
                  <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{t('lopDaNoi')}</p>
                  {dsLop.length === 0 ? (
                    <p className="text-[11.5px] font-semibold italic text-grey-mid">{t('chuaLopNao')}</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {dsLop.map((l, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                          <span className="font-extrabold text-navy">{l.lop}</span>
                          <span className="min-w-0 flex-1 font-semibold text-grey-mid">{l.ten}</span>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                              l.gop ? 'bg-success/[0.12] text-success-dark' : 'bg-navy/[0.06] text-grey-mid'
                            }`}
                          >
                            {l.gop ? t('coGopSo') : t('chiGiuHuong')}
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
    </div>
  );
}
