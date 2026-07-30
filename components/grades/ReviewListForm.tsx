import {SubmitButton} from '@/components/ui/SubmitButton';
import {selectInline, inputInline, btnGold} from '@/components/ui/Field';
import {CONDUCTS, CONDUCT_LABEL, type Conduct} from '@/components/grades/labels';
import {saveClassReviews} from '@/app/[locale]/(dashboard)/grades/actions';

export type ReviewRow = {
  studentId: string;
  name: string;
  comment: string;
  conduct: Conduct | '';
  conductScore: string;
  published: boolean;
};

// Ô nhận xét không dùng được `inputCls`: nó khoá chiều cao 44px (ctl-h), còn đây là ô nhiều dòng.
// Giữ nguyên ngôn ngữ hình ảnh của ô nhập (bo 10px, viền 1.5px navy/15, chữ navy đậm), chỉ đổi
// cách quyết định chiều cao.
const taCls =
  'min-w-0 w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-sm font-semibold leading-[1.5] text-navy outline-none transition-colors focus:border-navy';

/**
 * Nhận xét của GVCN + hạnh kiểm — cả lớp trong MỘT form, một nút Lưu.
 *
 * Vì sao gộp: mỗi em một form nghĩa là 30 lần bấm và 30 chặng mạng, trên VPS đang mất gói thì
 * kiểu gì cũng có lần rơi và cô không biết em nào chưa lưu.
 *
 * Vì sao KHÔNG có nút công bố trên từng dòng: form gộp này đã bọc cả 30 hàng, mà HTML không cho
 * lồng form trong form. Công bố vì thế làm theo lớp ở khối riêng bên dưới — cũng đúng nhịp thật
 * (nhập rải rác nhiều ngày, gửi gia đình một thể). Sửa lỗi nhỏ sau khi công bố thì không cần gỡ:
 * RLS vẫn cho GVCN sửa, và trigger audit ghi lại việc sửa-sau-công-bố.
 */
export function ReviewListForm({
  classId,
  termId,
  rows,
}: {
  classId: string;
  termId: string;
  rows: ReviewRow[];
}) {
  const daDien = rows.filter((r) => r.comment.trim() !== '').length;

  return (
    <form action={saveClassReviews} className="glass rounded-[20px]">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="term_id" value={termId} />
      <input type="hidden" name="ids" value={rows.map((r) => r.studentId).join(',')} />

      <div className="flex flex-wrap items-start justify-between gap-2 px-[18px] py-3">
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold text-navy">Nhận xét &amp; hạnh kiểm</div>
          {/* Cảnh báo này nằm ngay trên ô nhập vì đúng chỗ đó mới đọc. Cột comment của phiếu là ô
              GỬI GIA ĐÌNH — migration 0064 ghi rõ: sau khi công bố, phụ huynh và chính em đó đọc
              được nguyên văn. */}
          <p className="mt-0.5 text-[11px] italic text-grey-mid">
            Nhận xét ở đây gửi thẳng cho gia đình sau khi công bố — phụ huynh và chính em đó đọc
            được nguyên văn. Ghi chú nội bộ thì đừng viết vào đây.
          </p>
        </div>
        <span className="rounded-full bg-navy/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold text-navy">
          Đã có nhận xét {daDien}/{rows.length}
        </span>
      </div>

      {rows.map((r, i) => (
        <div
          key={r.studentId}
          className="flex flex-col gap-2 border-t border-navy/[0.08] px-[18px] py-3 sm:flex-row sm:items-start"
        >
          <div className="flex items-center gap-1.5 sm:w-[186px] sm:flex-none sm:pt-2">
            <span className="w-[20px] flex-none text-[12px] font-bold text-grey-mid">{i + 1}</span>
            <span className="min-w-0 truncate text-[13.5px] font-bold text-navy">{r.name}</span>
            {r.published && (
              <span
                title="Phiếu của em này đã công bố — gia đình đang xem được"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
              >
                đã gửi
              </span>
            )}
          </div>

          <textarea
            id={`cmt-${r.studentId}`}
            name={`comment_${r.studentId}`}
            rows={2}
            maxLength={2000}
            defaultValue={r.comment}
            aria-label={`Nhận xét cho ${r.name}`}
            placeholder="Em tiến bộ ở… cần cố gắng thêm ở…"
            className={`${taCls} sm:flex-1`}
          />

          <select
            name={`conduct_${r.studentId}`}
            defaultValue={r.conduct}
            aria-label={`Xếp loại hạnh kiểm của ${r.name}`}
            className={`${selectInline} w-full sm:w-[136px] sm:flex-none`}
          >
            <option value="">— chưa xếp —</option>
            {CONDUCTS.map((c) => (
              <option key={c} value={c}>
                {CONDUCT_LABEL[c]}
              </option>
            ))}
          </select>

          {/* Điểm rèn luyện thang 100: có trường dùng, có trường không (0064 để cả hai cột đều
              được bỏ trống). Bỏ trống thì không ghi gì, không bịa số. */}
          <input
            name={`cscore_${r.studentId}`}
            type="number"
            step="1"
            min="0"
            max="100"
            inputMode="numeric"
            defaultValue={r.conductScore}
            aria-label={`Điểm rèn luyện của ${r.name} (thang 100, có thể bỏ trống)`}
            placeholder="RL"
            className={`${inputInline} w-full text-center sm:w-[78px] sm:flex-none`}
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-navy/[0.08] px-[18px] py-3">
        <SubmitButton className={btnGold} wrapClass="contents">
          Lưu nhận xét &amp; hạnh kiểm
        </SubmitButton>
      </div>
    </form>
  );
}
