'use client';

// MỤC TIÊU CỦA LỚP hiện trên MÀN EM — CHỈ ĐỌC. Cùng đọc view muc_tieu_v như màn cô nên
// con % ở đây LÀ CHÍNH con % cô thấy (một con số sự thật). Em không sửa mục tiêu lớp; em
// đẩy nó lên bằng cách tick phần việc của mình (khu Việc).
import {useTranslations} from 'next-intl';
import {DonutRing} from '@/components/charts/DonutRing';
import {ngayVN} from '@/lib/dates';

export type MucTieuLopThe = {
  id: string;
  ten: string;
  linh_vuc: string;
  loai_moc: string | null;
  pct: number | null;
  so: number | null;
  y_so: number | null;
  ten_don_vi: string | null;
  ket_thuc: string | null;
};

function dinhSo(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function MucTieuLopChoEm({
  mucTieu,
  mauTheoArea,
  nhanTheoArea,
}: {
  mucTieu: MucTieuLopThe[];
  mauTheoArea: Record<string, {hex: string; soft: string}>;
  nhanTheoArea: Record<string, string>;
}) {
  const t = useTranslations('mucTieu');
  if (mucTieu.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {mucTieu.map((m) => {
        const area = m.linh_vuc ?? 'knowledge';
        const mau = mauTheoArea[area] ?? {hex: '#26275d', soft: '#ecedf5'};
        const dv = m.ten_don_vi ?? '';
        return (
          <div
            key={m.id}
            style={{
              borderColor: `color-mix(in srgb, ${mau.hex} 30%, white)`,
              background: `color-mix(in srgb, ${mau.hex} 6%, white)`,
            }}
            className="flex items-start gap-3.5 rounded-[14px] border-[1.5px] p-3.5"
          >
            {m.pct != null ? (
              <DonutRing pct={Number(m.pct)} color={mau.hex} size={54} />
            ) : (
              <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-[11px] font-extrabold text-grey-mid">
                —
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                  style={{background: mau.soft, color: mau.hex}}
                >
                  {nhanTheoArea[area] ?? ''}
                </span>
                <span className="min-w-0 flex-1 font-display text-[15px] font-bold text-navy">{m.ten}</span>
              </div>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-grey-mid">
                {m.loai_moc === 'do_luong' && m.y_so != null ? (
                  <span className="text-[13.5px] font-extrabold tabular-nums text-navy">
                    {m.so != null ? dinhSo(m.so) : '–'}
                    <span className="font-bold text-grey-mid">
                      {' / '}
                      {dinhSo(m.y_so)} {dv}
                    </span>
                  </span>
                ) : null}
                <span>{t('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
