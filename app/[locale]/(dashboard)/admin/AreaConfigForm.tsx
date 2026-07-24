'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {updateArea} from './area-actions';
import {AREA_ICON_MAP, AREA_ICON_NAMES, type AreaMeta, type Area} from '@/lib/areas';

const inp =
  'min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] bg-navy px-3 text-[12px] font-extrabold text-white transition-all hover:bg-navy-700';
const lbl = 'flex flex-col gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';

// Cấu hình 4 lĩnh vực 4DX: nhãn VN/EN · màu · icon · đơn vị mặc định. Xem trước trực tiếp.
export function AreaConfigForm({rows}: {rows: {area: Area; meta: AreaMeta}[]}) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
      {rows.map(({area, meta}) => (
        <AreaCard key={area} area={area} meta={meta} />
      ))}
    </div>
  );
}

function AreaCard({area, meta}: {area: Area; meta: AreaMeta}) {
  const t = useTranslations('admin');
  const [color, setColor] = useState(meta.hex);
  const [icon, setIcon] = useState(meta.icon_name);
  const [labelVi, setLabelVi] = useState(meta.label_vi);
  const Preview = AREA_ICON_MAP[icon] ?? AREA_ICON_MAP.BookOpen;

  return (
    <form action={updateArea} className="rounded-[14px] border-[1.5px] border-navy/10 bg-white/50 p-3">
      <input type="hidden" name="area" value={area} />
      {/* Xem trước: chip icon + màu + nhãn */}
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{background: `${color}22`, color}}
        >
          <Preview size={18} strokeWidth={2.4} />
        </span>
        <span className="font-display text-[15px] font-bold text-navy">{labelVi || meta.label_vi}</span>
        <code className="ml-auto text-[10px] font-bold text-grey-soft">{area}</code>
      </div>

      <div className="flex flex-col gap-2">
        <label className={lbl}>
          {t('labelVi')}
          <input name="label_vi" value={labelVi} onChange={(e) => setLabelVi(e.target.value)} className={inp} required />
        </label>
        <label className={lbl}>
          {t('labelEn')}
          <input name="label_en" defaultValue={meta.label_en} className={inp} required />
        </label>
        <div className="flex gap-2">
          <label className={`${lbl} w-[76px] shrink-0`}>
            {t('color')}
            <input
              name="color_hex"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-[9px] border-[1.5px] border-navy/15 bg-white p-0.5"
            />
          </label>
          <label className={`${lbl} flex-1`}>
            {t('icon')}
            <select name="icon_name" value={icon} onChange={(e) => setIcon(e.target.value)} className={`cursor-pointer ${inp}`}>
              {AREA_ICON_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={lbl}>
          {t('defaultUnit')}
          <input
            name="default_unit"
            defaultValue={meta.default_unit ?? ''}
            placeholder={t('unitPlaceholder')}
            className={inp}
          />
        </label>
        <button type="submit" className={`${navyBtn} mt-0.5 self-start`}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}
