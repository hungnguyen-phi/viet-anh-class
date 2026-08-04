'use client';

import {useActionState, useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, CheckCircle2, ChevronDown, Lock, Plus, X} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {taoWig} from '@/app/[locale]/(dashboard)/wig/actions';
import type {PeriodOption} from '@/lib/dates';

// ════════════════════════════════════════════════════════════════════════════
// MỘT NÚT "+ Tạo mục tiêu" Ở GÓC PHẢI — thay cho ba khung form xếp dọc cả trang.
// ════════════════════════════════════════════════════════════════════════════
//
// Trước đây trang /wig bày SẴN mọi form tạo: một khung "1 · Tạo WIG năm" ở đầu trang, rồi bên
// trong mỗi WIG năm lại một khung "2 · Tạo WIG tuần", rồi bên trong mỗi WIG tháng lại một khung
// nữa. Lớp có 3 mục tiêu năm là 4 form trống nằm chờ, mỗi form 6 ô. Chủ dự án mô tả đúng cảm giác
// ấy: "nhìn từ trên xuống 1 lượt thấy toàn là ô xếp dọc nhau, toàn là chữ, tôi không biết mình
// nên làm gì luôn".
//
// Nay form chỉ xuất hiện khi người ta thật sự muốn tạo. Trang đọc còn lại đúng thứ đáng đọc:
// mục tiêu tuần này, và lớp đang đi tới đâu.
//
// RÀNG BUỘC CHUỖI NĂM → THÁNG → TUẦN nằm ngay trên ba cái tab: chưa có mục tiêu năm thì tab
// "Tháng" khoá, và bên cạnh nói rõ vì sao khoá. Khoá mà không nói lý do thì người dùng chỉ thấy
// một nút bấm không ăn.

type WigOption = {id: string; title: string; start_date: string; end_date: string};

export function TaoWigMenu({
  classId,
  areas,
  namOptions,
  thangOptions,
  tuanOptions,
  wigNam,
  wigThang,
  kyMacDinh,
}: {
  classId: string;
  areas: {value: string; label: string}[];
  // Danh sách kỳ để CHỌN — tính ở server để không lệch hydrate (xem lib/dates.ts).
  namOptions: PeriodOption[];
  thangOptions: PeriodOption[];
  tuanOptions: PeriodOption[];
  // Mục tiêu năm/tháng đang có của lớp, để chọn làm cha.
  wigNam: WigOption[];
  wigThang: WigOption[];
  // Nhãn kỳ chọn sẵn cho từng loại — theo TUẦN ĐANG XEM, không phải theo hôm nay.
  kyMacDinh: {year: string; month: string; week: string};
}) {
  const t = useTranslations('wig');
  const [open, setOpen] = useState(false);
  const [loai, setLoai] = useState<'year' | 'month' | 'week'>('year');
  const boxRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(taoWig, {ok: false});

  const coNam = wigNam.length > 0;
  const coThang = wigThang.length > 0;

  // Mở ra thì đứng sẵn ở loại XA NHẤT mà lớp đã đủ điều kiện tạo: chưa có gì → Năm; có năm rồi →
  // Tháng; có tháng rồi → Tuần. Đó gần như luôn là thứ người ta định làm, và nó cũng dạy luôn
  // cái chuỗi mà không cần một dòng hướng dẫn nào.
  useEffect(() => {
    if (open) setLoai(coThang ? 'week' : coNam ? 'month' : 'year');
  }, [open, coNam, coThang]);

  // Bấm ra ngoài / Esc thì đóng. Không đóng khi vừa lưu xong: người ta hay tạo mấy cái liền tay.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const kyOptions = loai === 'year' ? namOptions : loai === 'month' ? thangOptions : tuanOptions;
  const chaOptions = loai === 'month' ? wigNam : wigThang;

  const tab = (gt: 'year' | 'month' | 'week', nhan: string, mo: boolean, viSao: string) => (
    <button
      type="button"
      key={gt}
      onClick={() => mo && setLoai(gt)}
      disabled={!mo}
      title={mo ? undefined : viSao}
      aria-pressed={loai === gt}
      className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-[12.5px] font-extrabold transition-all disabled:cursor-not-allowed ${
        loai === gt
          ? 'bg-navy text-white shadow-[0_3px_10px_-2px_rgba(38,39,93,0.45)]'
          : mo
            ? 'text-navy/70 hover:bg-navy/[0.07] hover:text-navy'
            : 'text-grey-soft'
      }`}
    >
      {!mo && <Lock size={11} strokeWidth={2.5} />}
      {nhan}
    </button>
  );

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={btnGold}
      >
        <Plus size={15} strokeWidth={2.8} />
        {t('createTitle')}
        <ChevronDown size={14} strokeWidth={2.8} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('createTitle')}
          // Điện thoại: trải gần hết bề ngang, neo dưới thanh nav. Máy tính: thả xuống từ chính
          // cái nút. Một khối 400px neo phải trên màn 360px là tràn ra ngoài mép và mất một nửa.
          className="fixed inset-x-3 top-[88px] z-40 max-h-[76vh] overflow-y-auto rounded-[18px] bg-white p-4 shadow-pop ring-1 ring-navy/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[430px]"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-[14.5px] font-bold text-navy">{t('createTitle')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('cancel')}
              className="ml-auto grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          <div className="mb-1 flex gap-1 rounded-[12px] bg-navy/[0.05] p-1">
            {tab('year', t('year'), true, '')}
            {tab('month', t('month'), coNam, t('needYearFirst'))}
            {tab('week', t('week'), coThang, t('needMonthFirst'))}
          </div>
          <p className="mb-3 text-[11px] font-semibold leading-relaxed text-grey-mid">
            {loai === 'year' ? t('chainYear') : loai === 'month' ? t('chainMonth') : t('chainWeek')}
          </p>

          {/* key theo loại: đổi tab là dựng lại form, không để sót giá trị của loại trước. */}
          <form key={loai} action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="period" value={loai} />

            {loai !== 'year' && (
              <Field
                label={loai === 'month' ? t('parentYear') : t('parentMonth')}
                htmlFor="wig-parent"
                error={err('parent_wig_id')}
              >
                <select id="wig-parent" name="parent_wig_id" className={selectCls} defaultValue={chaOptions[0]?.id ?? ''}>
                  {chaOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={t('wigTitle')} htmlFor="wig-title" error={err('title')} hint={t('wigTitleHint')}>
              <input
                id="wig-title"
                name="title"
                placeholder={t('wigTitlePlaceholder')}
                aria-invalid={state.fieldError === 'title'}
                className={ctlWithBorder(state.fieldError === 'title')}
              />
            </Field>

            {loai === 'year' && (
              <Field label={t('area')} htmlFor="wig-area" error={err('area')}>
                <select id="wig-area" name="area" className={selectCls} defaultValue="">
                  <option value="" disabled>
                    — {t('area')} —
                  </option>
                  {areas.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.3fr]">
              <Field label={t('baseline')} htmlFor="wig-baseline" error={err('baseline')}>
                <input
                  id="wig-baseline"
                  name="baseline"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  placeholder="0"
                  aria-invalid={state.fieldError === 'baseline'}
                  className={ctlWithBorder(state.fieldError === 'baseline')}
                />
              </Field>
              <Field label={t('targetTo')} htmlFor="wig-target" error={err('target_value')}>
                <input
                  id="wig-target"
                  name="target_value"
                  type="number"
                  step="any"
                  min="0.01"
                  inputMode="decimal"
                  aria-invalid={state.fieldError === 'target_value'}
                  className={ctlWithBorder(state.fieldError === 'target_value')}
                />
              </Field>
              <Field label={t('unit')} htmlFor="wig-unit" error={err('unit')} className="col-span-2 sm:col-span-1">
                <input
                  id="wig-unit"
                  name="unit"
                  placeholder={t('unitPlaceholder')}
                  aria-invalid={state.fieldError === 'unit'}
                  className={ctlWithBorder(state.fieldError === 'unit')}
                />
              </Field>
            </div>

            {/* CHỈ GỬI NHÃN KỲ, không gửi ngày. Server tra ngày từ nhãn (xem ngayCuaKy trong
                actions.ts) nên không còn đường nào để một mục tiêu mang ngày lệch với nhãn của
                chính nó — đúng cái bẫy đã gây sự cố 7B1. */}
            <Field label={t('periodWhich')} htmlFor="wig-ky" error={err('period_label')}>
              <select id="wig-ky" name="period_label" className={selectCls} defaultValue={kyMacDinh[loai]}>
                {kyOptions.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label} · {o.start.slice(8, 10)}/{o.start.slice(5, 7)} → {o.end.slice(8, 10)}/{o.end.slice(5, 7)}
                  </option>
                ))}
              </select>
            </Field>

            {state.error && !state.fieldError && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12.5px] font-bold text-status-bad">
                <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.error}
              </p>
            )}
            {state.ok && state.message && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12.5px] font-bold text-success-dark">
                <CheckCircle2 size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.message}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
                {t('cancel')}
              </button>
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('save')}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
