import {getTranslations} from 'next-intl/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, selectInline, inputInline, btnGold} from '@/components/ui/Field';
import {tenCot, type ScoreKind} from '@/components/grades/labels';
import {saveScoreColumn} from '@/app/[locale]/(dashboard)/grades/actions';

export type ScoreCell = {reviewId: string; name: string; current: string};

/**
 * Nhập MỘT CỘT điểm cho cả lớp trong một lần bấm.
 *
 * Ô nhập bố trí 3 cột trên máy tính để 30 em gọn trong 10 dòng — giáo viên nhìn hết cả lớp mà
 * không phải cuộn, và thứ tự Tab vẫn chạy theo đúng thứ tự danh sách.
 *
 * Tên em CHÍNH LÀ nhãn của ô nhập (<label htmlFor>): vừa đúng a11y (dự án đã bị người thử phàn
 * nàn chuyện ô không có nhãn), vừa cho phép bấm vào tên là nhảy con trỏ vào ô điểm.
 */
export async function ScoreColumnForm({
  classId,
  termId,
  subjectId,
  subjectName,
  kind,
  ordinal,
  weight,
  rows,
}: {
  classId: string;
  termId: string;
  /** ID trong danh mục môn — thứ DUY NHẤT gửi lên máy chủ. */
  subjectId: string;
  /** Tên môn — CHỈ để hiện ra. Gửi tên đi là quay lại đúng cái bệnh 0069 đang chữa. */
  subjectName: string;
  kind: ScoreKind;
  ordinal: number;
  weight: number;
  rows: ScoreCell[];
}) {
  const t = await getTranslations('grades');
  return (
    <form action={saveScoreColumn} className="glass rounded-[20px] p-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="term_id" value={termId} />
      <input type="hidden" name="subject_id" value={subjectId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="ordinal" value={ordinal} />
      {/* Danh sách phiếu gửi kèm để server biết phải đọc những ô nào — cũng là cách phân biệt
          "ô để trống" (xoá điểm) với "em không có trong danh sách". */}
      <input type="hidden" name="ids" value={rows.map((r) => r.reviewId).join(',')} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-noi-dung font-bold text-navy">
            {t('enterForClass', {column: tenCot(subjectName, kind, ordinal, t)})}
          </h2>
          <p className="mt-0.5 text-chu-thich italic text-grey-mid">
            {t('columnFormHint')}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Field label={t('fWeight')} htmlFor="grades-weight">
            <select
              id="grades-weight"
              name="weight"
              defaultValue={String(weight)}
              className={`${selectInline} w-[76px]`}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton className={btnGold} wrapClass="contents">
            {t('saveColumn')}
          </SubmitButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r, i) => (
          <div
            key={r.reviewId}
            className="flex items-center gap-2 rounded-[12px] border-[1.5px] border-navy/[0.08] bg-white/60 px-2.5 py-1.5"
          >
            <span className="w-[20px] flex-none text-chu-thich font-bold text-grey-mid">{i + 1}</span>
            <label
              htmlFor={`s-${r.reviewId}`}
              className="min-w-0 flex-1 cursor-pointer truncate text-than font-bold text-navy"
            >
              {r.name}
            </label>
            <input
              id={`s-${r.reviewId}`}
              name={`s_${r.reviewId}`}
              type="number"
              step="any"
              min="0"
              max="10"
              inputMode="decimal"
              defaultValue={r.current}
              className={`${inputInline} w-[78px] text-center`}
            />
          </div>
        ))}
      </div>
    </form>
  );
}
