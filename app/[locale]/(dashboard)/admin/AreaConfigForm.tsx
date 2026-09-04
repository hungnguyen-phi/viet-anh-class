'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {RotateCcw} from 'lucide-react';
import {resetArea, updateArea} from './area-actions';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {AREA_ICON_MAP, AREA_ICON_NAMES, type AreaMeta, type Area} from '@/lib/areas';

const resetBtn =
  'h-8 cursor-pointer whitespace-nowrap rounded-[8px] border-[1.5px] border-navy/15 bg-white/70 px-2.5 text-chu-thich font-extrabold text-grey-mid transition-all hover:border-navy hover:text-navy';
const inp =
  'min-w-0 rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-base sm:text-than font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-[8px] bg-navy px-3 text-chu-thich font-extrabold text-white transition-all hover:bg-navy-700';
const lbl = 'flex flex-col gap-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid';

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
    <div className="rounded-[12px] border-[1.5px] border-navy/10 bg-white/50 p-3">
      <form action={updateArea} id={`area-${area}`}>
      <input type="hidden" name="area" value={area} />
      {/* Xem trước: chip icon + màu + nhãn */}
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px]"
          style={{background: `${color}22`, color}}
        >
          <Preview size={18} strokeWidth={2.5} />
        </span>
        <span className="font-display text-noi-dung font-bold text-navy">{labelVi || meta.label_vi}</span>
        <code className="ml-auto text-nhan font-bold text-grey-soft">{area}</code>
      </div>

      <div className="flex flex-col gap-2">
        <label className={lbl}>
          {t('labelVi')}
          <input name="label_vi"
                aria-label={t('name') + ' (VI)'} value={labelVi} onChange={(e) => setLabelVi(e.target.value)} className={inp} required />
        </label>
        <label className={lbl}>
          {t('labelEn')}
          <input name="label_en"
                aria-label={t('name') + ' (EN)'} defaultValue={meta.label_en} className={inp} required />
        </label>
        <div className="flex gap-2">
          <label className={`${lbl} w-[76px] shrink-0`}>
            {t('color')}
            <input
              name="color_hex"
                aria-label="Màu"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white p-0.5"
            />
          </label>
          <label className={`${lbl} flex-1`}>
            {t('icon')}
            <select name="icon_name"
                aria-label="Biểu tượng" value={icon} onChange={(e) => setIcon(e.target.value)} className={`cursor-pointer ${inp}`}>
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
            placeholder={t('unitPlaceholder')} aria-label={t('unitPlaceholder')}
            className={inp}
          />
        </label>
        <SubmitButton className={`${navyBtn} mt-0.5 self-start`}>
          {t('save')}
        </SubmitButton>
      </div>
      </form>

      {/* Khôi phục mặc định = xoá dòng cấu hình, lĩnh vực rơi về nhãn/màu gốc.
          Form RIÊNG đặt cạnh form sửa: <form> lồng trong <form> là HTML không hợp lệ, trình duyệt
          sẽ âm thầm bỏ cái bên trong và nút này thành nút không làm gì. */}
      <form action={resetArea} className="mt-2 border-t border-navy/[0.08] pt-2">
        <input type="hidden" name="area" value={area} />
        <ConfirmButton message={t('confirmResetArea')} className={resetBtn}>
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw size={12} strokeWidth={2.5} />
            {t('resetArea')}
          </span>
        </ConfirmButton>
      </form>
    </div>
  );
}
