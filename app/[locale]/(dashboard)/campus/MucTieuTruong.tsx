'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Trash2, X} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, ctlWithBorder, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {taoWigTruong, xoaWigTruong} from './actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA CƠ SỞ — tầng trên cùng, và tầng duy nhất mà số của nó không do ai gõ vào.
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Ba tầng, một luật lặp lại:
//
//   tầng môn      "Toán từ 6.5 trở lên"      mục tiêu năm của EM
//   tầng lớp      "86% học sinh đạt 6/8 môn" mục tiêu cuộn của LỚP
//   tầng trường   "80% lớp đạt 2 mục tiêu"   mục tiêu cuộn của CƠ SỞ  ← màn này
//
// Nên ở đây không có ô "đơn vị", không có "từ … đến …", và không có việc nào để tick. Chỉ có hai
// con số: cần bao nhiêu phần trăm lớp đạt, và mỗi lớp phải đạt mấy mục tiêu năm.
//
// Bảng bên dưới cố ý hiện PHÂN SỐ ("3/12 lớp đạt") cạnh phần trăm: "25%" không nói cho hiệu
// trưởng biết còn thiếu mấy lớp, "3/12" thì nói ngay.

export type WigTruongRow = {
  id: string;
  title: string;
  areaLabel: string;
  areaHex: string;
  areaSoft: string;
  periodLabel: string | null;
  tyLeCan: number;
  soDichCan: number;
  tongDich: number | null;
  tong: number;
  dat: number;
  tyLe: number;
};

export function MucTieuTruong({
  rows,
  areaOptions,
  namOptions,
}: {
  rows: WigTruongRow[];
  areaOptions: {value: string; label: string}[];
  namOptions: {label: string; start: string; end: string}[];
}) {
  const t = useTranslations('wig');
  const [mo, setMo] = useState(false);
  const [tyLe, setTyLe] = useState('');
  const [soDich, setSoDich] = useState('');
  const [tongDich, setTongDich] = useState('');

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-[15px] font-bold text-navy">{t('schoolGoals')}</h2>
        <button type="button" onClick={() => setMo((v) => !v)} className={`ml-auto ${btnGold}`}>
          {mo ? <X size={15} strokeWidth={2.8} /> : <Plus size={15} strokeWidth={2.8} />}
          {mo ? t('cancel') : t('createTitle')}
        </button>
      </div>

      {mo && (
        <form action={taoWigTruong} className="mb-4 flex flex-col gap-3 rounded-[14px] border-[1.5px] border-gold/60 bg-white p-3">
          <Field label={t('wigTitle')} htmlFor="mtt-title">
            <input id="mtt-title" name="title" placeholder={t('schoolGoalPlaceholder')} className={ctlWithBorder(false)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('area')} htmlFor="mtt-area">
              <select id="mtt-area" name="area" className={selectCls} defaultValue={areaOptions[0]?.value ?? ''}>
                {areaOptions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('periodWhich')} htmlFor="mtt-ky">
              <select id="mtt-ky" name="period_label" className={selectCls} defaultValue={namOptions[0]?.label ?? ''}>
                {namOptions.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-[12px] bg-navy/[0.04] p-3">
            <p className="mb-2 text-[12.5px] font-extrabold text-navy">{t('cuonHeadingSchool')}</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('cuonTyLe')} htmlFor="mtt-tyle">
                <div className="flex items-center gap-1.5">
                  <input
                    id="mtt-tyle"
                    name="ty_le_can"
                    type="number"
                    step="any"
                    min="1"
                    max="100"
                    inputMode="decimal"
                    placeholder="80"
                    value={tyLe}
                    onChange={(e) => setTyLe(e.target.value)}
                    className={ctlWithBorder(false)}
                  />
                  <span className="text-[13px] font-extrabold text-grey-mid">%</span>
                </div>
              </Field>
              <Field label={t('cuonSoDichSchool')} htmlFor="mtt-sodich">
                <input
                  id="mtt-sodich"
                  name="so_dich_can"
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  placeholder="2"
                  value={soDich}
                  onChange={(e) => setSoDich(e.target.value)}
                  className={ctlWithBorder(false)}
                />
              </Field>
              <Field label={t('cuonTongDich')} htmlFor="mtt-tongdich">
                <input
                  id="mtt-tongdich"
                  name="tong_dich"
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  placeholder="4"
                  value={tongDich}
                  onChange={(e) => setTongDich(e.target.value)}
                  className={ctlWithBorder(false)}
                />
              </Field>
            </div>
            {/* Đọc lại thành câu tiếng Việt trước khi bấm Lưu — ba ô số rời nhau thì mỗi người
                hiểu một kiểu, câu hoàn chỉnh thì sai là thấy ngay. */}
            <p className="mt-2 text-[12.5px] font-bold text-navy/80">
              {t('cuonCauSchool', {
                tyle: tyLe || '…',
                can: soDich || '…',
                tong: tongDich ? t('cuonTongDichSuffix', {n: tongDich}) : '',
              })}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-grey-mid">{t('cuonGhiChuSchool')}</p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMo(false)} className={btnGhost}>
              {t('cancel')}
            </button>
            <SubmitButton className={btnGold} wrapClass="contents">
              {t('save')}
            </SubmitButton>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-4 text-center text-[12.5px] font-semibold italic leading-relaxed text-grey-mid">
          {t('schoolGoalsEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((w) => {
            const pct = Math.min(100, Math.round((w.tyLe / (w.tyLeCan || 100)) * 100));
            return (
              <div key={w.id}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                    style={{background: w.areaSoft, color: w.areaHex}}
                  >
                    {w.areaLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy" title={w.title}>
                    {w.title}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-navy">
                    {w.tyLe}% / {w.tyLeCan}%
                  </span>
                  <form action={xoaWigTruong} className="contents">
                    <input type="hidden" name="wig_id" value={w.id} />
                    <ConfirmButton
                      message={t('confirmDeleteWig')}
                      label={`${t('deleteWig')} — ${w.title}`}
                      className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-grey-soft transition-colors hover:bg-status-bad/[0.12] hover:text-status-bad"
                    >
                      <Trash2 size={12} strokeWidth={2.5} />
                    </ConfirmButton>
                  </form>
                </div>
                <div className="mt-1.5 h-[8px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
                  <div
                    className="h-full rounded-[5px]"
                    style={{
                      width: `${pct}%`,
                      background: w.tyLe >= w.tyLeCan ? 'var(--color-success)' : 'var(--color-warn)',
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] font-bold text-grey-mid">
                  {t('cuonDatSchool', {dat: w.dat, tong: w.tong})}
                  {' · '}
                  {t('cuonSoDichSchool')} {w.soDichCan}
                  {w.tongDich ? `/${w.tongDich}` : ''}
                  {w.periodLabel ? ` · ${w.periodLabel}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
