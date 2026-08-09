'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Pencil, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {suaWig, deleteWig} from '@/app/[locale]/(dashboard)/wig/actions';

// ════════════════════════════════════════════════════════════════════════════
// LỚP ĐANG ĐI TỚI ĐÂU — năm, tháng, tuần, mỗi cấp một thanh.
// ════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án xin đúng thứ này: "tại cột bên phải mỗi wig sẽ hiện luôn thanh tiến độ 1 năm thì
// được bao nhiêu / mục tiêu, tháng thì bao nhiêu / mục tiêu".
//
// Trước đây tiến độ năm nằm ở đầu một khung dài, tiến độ tháng nằm lồng bên trong khung đó, tiến
// độ tuần lồng thêm một tầng nữa — ba con số cùng trả lời một câu hỏi mà phải cuộn qua ba tầng
// khung mới đọc hết. Xếp thẳng ba dòng cạnh nhau thì thấy ngay chỗ đứt: năm đang 27% mà tháng
// chưa đặt mục tiêu nào.
//
// CẤP NÀO CHƯA CÓ THÌ VẪN CHIẾM MỘT DÒNG, ghi "chưa đặt mục tiêu tháng". Ẩn đi thì cái thiếu trở
// nên vô hình — mà cái thiếu mới đúng là thứ cần làm tiếp.

export type DongTienDo = {
  id: string | null; // null = cấp này chưa có mục tiêu nào
  cap: 'year' | 'month' | 'week';
  title: string;
  periodLabel: string | null;
  baseline: number | null;
  target: number;
  unit: string;
  actual: number;
  pct: number;
  status: string | null;
  // Lĩnh vực hiện tại — chỉ form sửa của cấp NĂM dùng (tháng/tuần thừa hưởng từ cha).
  area: string | null;
};

const MAU: Record<string, string> = {
  on_track: 'var(--color-success)',
  mid: 'var(--color-warn)',
  off_track: 'var(--color-status-bad)',
};

export function BangTienDo({
  nhom,
  weekParam,
  classParam,
  areaOptions,
}: {
  // Một nhóm = một mục tiêu NĂM và cả chuỗi tháng → tuần của nó trong tuần đang xem.
  nhom: {areaLabel: string; areaHex: string; areaSoft: string; dong: DongTienDo[]}[];
  weekParam: string;
  classParam?: string;
  // Bốn lĩnh vực (kiến thức/kĩ năng/tiếng Anh/thể chất) — cho ô đổi lĩnh vực trong form sửa.
  areaOptions: {value: string; label: string}[];
}) {
  const t = useTranslations('wig');
  const [sua, setSua] = useState<string>('');

  if (nhom.length === 0) {
    return (
      <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-4 text-center text-[12.5px] font-semibold italic leading-relaxed text-grey-mid">
        {t('noWigs')}
      </p>
    );
  }

  const tenCap = (c: DongTienDo['cap']) =>
    c === 'year' ? t('year') : c === 'month' ? t('month') : t('week');

  return (
    <div className="flex flex-col gap-4">
      {nhom.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-2.5">
          <span
            className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
            style={{background: g.areaSoft, color: g.areaHex}}
          >
            {g.areaLabel}
          </span>

          {g.dong.map((d) => {
            if (sua && d.id === sua) {
              return <SuaForm key={d.cap} dong={d} areaOptions={areaOptions} onDong={() => setSua('')} />;
            }
            const pct = Math.round(d.pct * 100);
            return (
              <div key={d.cap} className="group">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-grey-soft">
                    {tenCap(d.cap)}
                    {d.periodLabel ? ` · ${d.periodLabel}` : ''}
                  </span>
                  {d.id && (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSua(d.id!)}
                        aria-label={`${t('edit')} — ${d.title}`}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-[7px] text-grey-soft transition-colors hover:bg-navy/[0.07] hover:text-navy"
                      >
                        <Pencil size={12} strokeWidth={2.5} />
                      </button>
                      <form action={deleteWig} className="contents">
                        {classParam && <input type="hidden" name="class_id" value={classParam} />}
                        <input type="hidden" name="wig_id" value={d.id} />
                        <input type="hidden" name="week" value={weekParam} />
                        <ConfirmButton
                          message={t('confirmDeleteWig')}
                          label={`${t('deleteWig')} — ${d.title}`}
                          className="grid h-6 w-6 cursor-pointer place-items-center rounded-[7px] text-grey-soft transition-colors hover:bg-status-bad/[0.12] hover:text-status-bad"
                        >
                          <Trash2 size={12} strokeWidth={2.5} />
                        </ConfirmButton>
                      </form>
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex items-baseline gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] font-bold ${
                      d.id ? 'text-navy' : 'italic text-grey-mid'
                    }`}
                    title={d.title}
                  >
                    {d.title}
                  </span>
                  <span
                    className={`shrink-0 text-[12.5px] font-extrabold tabular-nums ${
                      d.id ? 'text-navy' : 'text-grey-soft'
                    }`}
                  >
                    {d.id ? `${d.actual} / ${d.target} ${d.unit}` : '—'}
                  </span>
                </div>

                <div className="mt-1.5 h-[8px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
                  <div
                    className="h-full rounded-[5px]"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: MAU[d.status ?? ''] ?? 'var(--color-grey-soft)',
                    }}
                  />
                </div>
                {d.id && d.baseline != null && (
                  <p className="mt-1 text-[10.5px] font-semibold text-grey-mid">
                    {t('from')} {d.baseline} → {d.target} {d.unit}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Sửa tên / mốc xuất phát / mục tiêu / đơn vị. KHÔNG có ô ngày — xem ghi chú ở suaWig: ngày sinh
// ra từ nhãn kỳ, cho sửa tay là mở lại đúng cái cửa đã gây sự cố lệch tuần.
// Cấp NĂM sửa được cả LĨNH VỰC (người thử 08/2026 xin đúng thứ này) — tháng/tuần thì không, chúng
// thừa hưởng lĩnh vực từ mục tiêu năm, và server tự lan lĩnh vực mới xuống các con.
function SuaForm({
  dong,
  areaOptions,
  onDong,
}: {
  dong: DongTienDo;
  areaOptions: {value: string; label: string}[];
  onDong: () => void;
}) {
  const t = useTranslations('wig');
  const [state, formAction] = useActionState(suaWig, {ok: false});

  useEffect(() => {
    if (state.ok) onDong();
  }, [state.ok, onDong]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-gold/60 bg-white p-3">
      <input type="hidden" name="wig_id" value={dong.id ?? ''} />
      <h2 className="font-display text-[13px] font-bold text-navy">
        {t('editWig')} · {dong.periodLabel ?? ''}
      </h2>

      {dong.cap === 'year' && (
        <Field label={t('area')} htmlFor={`sw-a-${dong.id}`}>
          <select id={`sw-a-${dong.id}`} name="area" defaultValue={dong.area ?? ''} className={selectCls}>
            {areaOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={t('wigTitle')} htmlFor={`sw-t-${dong.id}`} error={err('title')}>
        <input
          id={`sw-t-${dong.id}`}
          name="title"
          defaultValue={dong.title}
          aria-invalid={state.fieldError === 'title'}
          className={ctlWithBorder(state.fieldError === 'title')}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label={t('baseline')} htmlFor={`sw-b-${dong.id}`} error={err('baseline')}>
          <input
            id={`sw-b-${dong.id}`}
            name="baseline"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            defaultValue={dong.baseline ?? ''}
            placeholder="0"
            aria-invalid={state.fieldError === 'baseline'}
            className={ctlWithBorder(state.fieldError === 'baseline')}
          />
        </Field>
        <Field label={t('targetTo')} htmlFor={`sw-m-${dong.id}`} error={err('target_value')}>
          <input
            id={`sw-m-${dong.id}`}
            name="target_value"
            type="number"
            step="any"
            min="0.01"
            inputMode="decimal"
            defaultValue={dong.target}
            aria-invalid={state.fieldError === 'target_value'}
            className={ctlWithBorder(state.fieldError === 'target_value')}
          />
        </Field>
        <Field label={t('unit')} htmlFor={`sw-u-${dong.id}`} error={err('unit')}>
          <input id={`sw-u-${dong.id}`} name="unit" defaultValue={dong.unit} className={inputCls} />
        </Field>
      </div>

      {state.error && !state.fieldError && (
        <p className="inline-flex items-start gap-1.5 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDong} className={btnGhost}>
          {t('cancel')}
        </button>
        <SubmitButton className={btnGold} wrapClass="contents">
          {t('save')}
        </SubmitButton>
      </div>
    </form>
  );
}
