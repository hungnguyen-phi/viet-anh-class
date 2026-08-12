'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold} from '@/components/ui/Field';
import {luuMucTieuCuaEm, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// FORM ĐẶT MỤC TIÊU — ba câu hỏi, nằm trong một hộp thoại
// ════════════════════════════════════════════════════════════════════════════
//
// Tách khỏi MucTieuCuaCon vì nay có HAI chỗ mở đúng cái form này: màn của em, và bức tường WIG bên
// trang giáo viên (cô chọn tên em rồi đặt hộ). Một bản dùng chung để hai đường ghi không bao giờ
// lệch luật nhau — đây là chỗ quyết định `set_by`, và `set_by` là thước đo của cả chương trình.
//
// VÌ SAO LÀ HỘP THOẠI chứ không phải khối mở sẵn giữa trang: form chỉ dùng vài lần một năm, còn
// màn của em thì mở mỗi ngày. Để nó nằm sẵn giữa trang nghĩa là mỗi ngày em phải cuộn qua một form
// trống dài nửa màn hình mới tới việc hôm nay. Chủ dự án chốt 12/08/2026: "cho cái form thành cái
// popup là được rồi".

export type ViecCuaEm = {title: string; target_value: number; active_weekdays: number[] | null};

export type DangSua = {
  id: string;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  end_date: string;
  source_wig_id: string | null;
  viec: ViecCuaEm | null;
} | null;

export type WigLop = {id: string; area: string; title: string};

const DOW = [1, 2, 3, 4, 5, 6, 7];

export function FormMucTieu({
  studentId,
  classId,
  kind = 'academic',
  tenEm,
  wigLop,
  dangSua,
  laChinhEm,
  dayShort,
  onClose,
  onDone,
}: {
  studentId: string;
  classId: string;
  /**
   * HỌC TẬP hay RIÊNG CỦA CON. Trước đây đóng cứng 'academic' ngay trong ô hidden, nên đường tạo
   * mục tiêu riêng — máy chủ nhận được, CSDL cho phép (wigs_em_uidx: 1 academic + 1 personal) —
   * không có một cái nút nào để đi tới.
   *
   * Mục tiêu RIÊNG không nối vào WIG lớp: wig_source_ck (0100) bắt source_wig_id phải null. Nên
   * bước ① không hỏi "góp vào trận nào của lớp" nữa — hỏi một câu mà mọi câu trả lời đều bị CSDL
   * từ chối là mời người dùng gõ vào một cái bẫy.
   */
  kind?: 'academic' | 'personal';
  /** Tên em — chỉ dùng khi cô đặt hộ, để tiêu đề hộp thoại nói rõ đang gõ cho AI. */
  tenEm?: string;
  wigLop: WigLop[];
  dangSua: DangSua;
  laChinhEm: boolean;
  dayShort: string[];
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieuCuaEm, {ok: false});
  const [thu, setThu] = useState<number[]>(dangSua?.viec?.active_weekdays ?? [1, 3, 5]);

  // Các ô rời rạc rất khó ráp lại thành một ý, nhất là với học sinh. Giữ giá trị ở đây để ghép
  // chúng thành MỘT CÂU HOÀN CHỈNH ngay dưới nút Gửi.
  const [g, setG] = useState({
    title: dangSua?.title ?? '',
    baseline: dangSua?.baseline != null ? String(dangSua.baseline) : '',
    target: dangSua?.target_value != null ? String(dangSua.target_value) : '',
    unit: dangSua?.unit ?? '',
    due: dangSua?.end_date ?? '',
    viec: dangSua?.viec?.title ?? '',
  });
  const duCau = Boolean(g.title && g.target && g.unit && g.due);

  // Lưu xong thì ĐÓNG. Trước đây form cứ nằm mở sau khi gửi, nên màn hình có đồng thời một thẻ
  // "đã gửi cô xem" và một form còn nguyên chữ — không đọc ra được cái nào là thật.
  useEffect(() => {
    if (!state.ok) return;
    onDone?.(state.message ?? '');
    onClose();
    // Chỉ chạy khi kết quả từ máy chủ đổi; onClose/onDone là hàm mới mỗi lần render cha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const doiThu = (d: number) =>
    setThu((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)));

  return (
    <Popup
      title={
        kind === 'personal'
          ? t('formTitlePersonal')
          : laChinhEm
          ? t('formTitle')
          : t('formTitleFor', {ten: tenEm ?? ''})
      }
      onClose={onClose}
      width="max-w-[620px]"
    >
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="kind" value={kind} />
        {thu.map((d) => (
          <input key={d} type="hidden" name="viec_days" value={d} />
        ))}

        {state.error && !state.fieldError && (
          <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
            <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}

        {/* ① Con muốn tiến bộ ở việc gì. */}
        <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
          <p className="mb-2 text-[13px] font-extrabold text-navy">
            {kind === 'personal' ? t('step1Personal') : t('step1')}
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label={t('what')} htmlFor="mt-title" error={err('title')}>
              <input
                id="mt-title"
                name="title"
                value={g.title}
                onChange={(e) => setG((p) => ({...p, title: e.target.value}))}
                placeholder={t('whatPlaceholder')}
                className={ctlWithBorder(state.fieldError === 'title')}
              />
            </Field>
            {kind === 'academic' && (
              <Field label={t('joinBattle')} htmlFor="mt-source">
                <select
                  id="mt-source"
                  name="source_wig_id"
                  defaultValue={dangSua?.source_wig_id ?? ''}
                  className={selectCls}
                >
                  <option value="">{t('noBattle')}</option>
                  {wigLop.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </div>

        {/* ② "Từ X đến Y trước ngày nào" — công thức của canon, nằm gọn một hàng. */}
        <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
          <p className="mb-2 text-[13px] font-extrabold text-navy">{t('step2')}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1fr_1fr_1.4fr]">
            <Field label={t('now')} htmlFor="mt-baseline" error={err('baseline')}>
              <input
                id="mt-baseline"
                name="baseline"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={g.baseline}
                onChange={(e) => setG((p) => ({...p, baseline: e.target.value}))}
                placeholder="0"
                className={ctlWithBorder(state.fieldError === 'baseline')}
              />
            </Field>
            <Field label={t('to')} htmlFor="mt-target" error={err('target_value')}>
              <input
                id="mt-target"
                name="target_value"
                type="number"
                step="any"
                min="0.01"
                inputMode="decimal"
                value={g.target}
                onChange={(e) => setG((p) => ({...p, target: e.target.value}))}
                className={ctlWithBorder(state.fieldError === 'target_value')}
              />
            </Field>
            <Field label={t('unit')} htmlFor="mt-unit" error={err('unit')}>
              <input
                id="mt-unit"
                name="unit"
                value={g.unit}
                onChange={(e) => setG((p) => ({...p, unit: e.target.value}))}
                placeholder={t('unitPlaceholder')}
                className={ctlWithBorder(state.fieldError === 'unit')}
              />
            </Field>
            <Field
              label={t('due')}
              htmlFor="mt-due"
              error={err('due_on')}
              className="col-span-2 sm:col-span-1"
            >
              <input
                id="mt-due"
                name="due_on"
                type="date"
                value={g.due}
                onChange={(e) => setG((p) => ({...p, due: e.target.value}))}
                className={ctlWithBorder(state.fieldError === 'due_on')}
              />
            </Field>
          </div>
        </div>

        {/* ③ Mỗi tuần con làm gì. Bỏ trống được: khi ấy đây là đích ghi nhận ngoài (0101). */}
        <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
          <p className="mb-2 text-[13px] font-extrabold text-navy">{t('step3')}</p>
          <Field label={t('workTitle')} htmlFor="mt-viec" hint={t('workOptional')}>
            <input
              id="mt-viec"
              name="viec_title"
              value={g.viec}
              onChange={(e) => setG((p) => ({...p, viec: e.target.value}))}
              placeholder={t('workPlaceholder')}
              className={inputCls}
            />
          </Field>

          {/* Ô "mấy lần/tuần" từng đứng ở đây. Bỏ hẳn: mỗi ngày chỉ tick được MỘT lượt
              (uq_lead_progress_daily, 0020), nên số lần mỗi tuần luôn đúng bằng số thứ được bật —
              hỏi thành hai chỗ chỉ tạo ra cơ hội cho chúng đá nhau ("chọn 5 thứ, đích 3 lần"). */}
          {g.viec && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[12px] font-extrabold text-navy">{t('whichDays')}</p>
              <div className="flex flex-wrap gap-1.5">
                {DOW.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => doiThu(d)}
                    aria-pressed={thu.includes(d)}
                    className={`grid h-9 w-11 cursor-pointer select-none place-items-center rounded-[10px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                      thu.includes(d)
                        ? 'border-transparent bg-gold text-navy'
                        : 'border-navy/15 bg-white text-navy/60 hover:border-navy'
                    }`}
                  >
                    {dayShort[i]}
                  </button>
                ))}
              </div>
              <p
                className={`mt-1.5 text-[12px] font-bold ${thu.length === 0 ? 'text-status-bad' : 'text-grey-mid'}`}
              >
                {thu.length === 0 ? t('pickADay') : t('perWeekCount', {n: thu.length})}
              </p>
            </div>
          )}

          <p className="mt-2 text-[11px] font-semibold italic leading-relaxed text-grey-mid">
            {t('leadRule')}
          </p>
        </div>

        {/* CÂU MỤC TIÊU — ráp từ chính những ô em vừa gõ. */}
        <div
          className={`rounded-[14px] px-3.5 py-3 text-[13px] font-bold leading-relaxed ${
            duCau ? 'bg-gold/[0.14] text-navy' : 'bg-navy/[0.04] italic text-grey-mid'
          }`}
        >
          {duCau
            ? t('preview', {
                what: g.title,
                from: g.baseline || '0',
                to: g.target,
                unit: g.unit,
                due: g.due,
              })
            : t('previewEmpty')}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className={btnGold} wrapClass="contents">
            {laChinhEm ? t('send') : t('saveForStudent')}
          </SubmitButton>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[12px] font-extrabold text-grey-mid underline"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </Popup>
  );
}
