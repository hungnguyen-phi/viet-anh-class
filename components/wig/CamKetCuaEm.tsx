'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, CheckCircle2, Clock, Target} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, btnGold} from '@/components/ui/Field';
import {datCamKetTuan} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// EM TỰ ĐẶT CAM KẾT CHO TUẦN TỚI — mắt xích bị đứt của cả vòng
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Cho tới 16/08/2026, cam kết tuần của một em CHỈ sinh ra được từ ô mà giáo viên gõ trong phòng
// họp. Chủ dự án bảo gỡ ô ấy ("phải là em đặt chứ"), và gỡ xong thì không còn đường nào cả — em
// viết cam kết thành một câu văn trong biên bản, còn bảng của cô đọc bảng `commitments`. Hai bên
// nói về hai thứ khác nhau, và suốt tuần không có gì để tick.
//
// Khối này là nửa cây cầu còn thiếu.
//
// ĐẶT Ở PHÒNG HỌP CỦA EM, ngay dưới phần nhìn lại tuần qua: đó đúng là nhịp mà PRD mô tả — cuối
// tuần nhìn lại, rồi hứa cho tuần tới, trong cùng một lần ngồi. Nhưng nó KHÔNG khoá theo buổi
// họp: chủ dự án đã chốt "điền sau cũng được, miễn là có để mà thực hiện, và gv duyệt sau".
//
// MỘT Ô, KHÔNG PHẢI HAI. Trần là 2 cam kết mỗi tuần, nhưng bày sẵn hai ô trống là mời người ta
// điền cho đủ. Đặt xong một cái thì khối này hiện lại để đặt tiếp — ai cần cái thứ hai sẽ tự làm,
// ai không cần thì không thấy một ô rỗng nào nhìn mình.
export function CamKetCuaEm({
  weekStart,
  weekLabel,
  daCo,
  dayShort,
}: {
  /** Thứ Hai của tuần đang đặt cam kết cho. */
  weekStart: string;
  /** Nhãn tuần để nói rõ đang hứa cho tuần nào — "cam kết" mà không nói tuần nào là một câu lửng. */
  weekLabel: string;
  /** Cam kết em đã đặt cho tuần ấy, kèm trạng thái duyệt. */
  daCo: {id: string; title: string; status: string}[];
  /** Nhãn thứ trong tuần đã dịch sẵn ở máy chủ — T2…CN. */
  dayShort: string[];
}) {
  const t = useTranslations('meeting');
  const tg = useTranslations('goal');
  const [state, formAction] = useActionState(datCamKetTuan, {ok: false});
  // Mặc định T2–T6: gần như luôn là thứ em định chọn, và ai muốn khác thì chạm hai cái là xong.
  const [thu, setThu] = useState<number[]>([1, 2, 3, 4, 5]);
  const doiThu = (d: number) =>
    setThu((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)));

  const conCho = daCo.length < 2;

  return (
    <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="font-display text-[16px] font-bold text-navy">
          {t('step3', {week: weekLabel})}
        </h2>
        <span className="text-[11.5px] font-semibold text-grey-mid">{t('commitmentHint')}</span>
      </div>

      {daCo.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {daCo.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
            >
              <Target size={13} strokeWidth={2.5} className="shrink-0 text-navy/50" />
              <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">{c.title}</span>
              {/* NÓI RÕ ĐANG CHỜ CÔ. Em gửi xong mà màn hình im lặng thì em tưởng chưa gửi được,
                  rồi gửi lại — và đâm vào trần 2 cam kết bằng một câu lỗi khó hiểu. */}
              {c.status === 'sent' ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                  <Clock size={10} strokeWidth={2.5} />
                  {tg('waiting')}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                  <CheckCircle2 size={10} strokeWidth={2.5} />
                  {tg('approved')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {conCho && (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="week" value={weekStart} />
          <Field
            label={t('commitmentNo', {n: daCo.length + 1})}
            htmlFor="ck-em-title"
            error={state.fieldError === 'title' ? state.error : null}
          >
            <input
              id="ck-em-title"
              name="title"
              maxLength={160}
              placeholder={t('commitmentPlaceholder')}
              className={ctlWithBorder(state.fieldError === 'title')}
            />
          </Field>
          {/* VIỆC ĐỂ TICK — TUỲ CHỌN, nhưng ngay tại đây.
              Một lời hứa không có việc để tick là lời hứa không ai đo được: cả tuần ô tick trống
              trơn, tới buổi họp không có gì để nói ngoài trí nhớ. Bắt em sang một màn khác để thêm
              việc là chỗ người ta bỏ dở — nhất là trẻ con, nhất là trên điện thoại. */}
          <Field
            label={t('thisWeekWork')}
            htmlFor="ck-em-viec"
            hint={t('thisWeekWorkHint')}
            error={state.fieldError === 'viec_days' ? state.error : null}
          >
            <input
              id="ck-em-viec"
              name="viec_title"
              maxLength={120}
              placeholder={t('workPlaceholder')}
              className={ctlWithBorder(false)}
            />
          </Field>
          {thu.map((d) => (
            <input key={d} type="hidden" name="viec_days" value={d} />
          ))}
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => doiThu(d)}
                aria-pressed={thu.includes(d)}
                aria-label={dayShort[d - 1]}
                className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[9px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                  thu.includes(d)
                    ? 'border-transparent bg-gold text-navy'
                    : 'border-navy/15 bg-white text-navy/60 hover:border-navy'
                }`}
              >
                {dayShort[d - 1]}
              </button>
            ))}
          </div>

          <SubmitButton className={`${btnGold} w-fit`} wrapClass="contents">
            {tg('send')}
          </SubmitButton>
        </form>
      )}

      {state.error && !state.fieldError && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}
    </section>
  );
}
