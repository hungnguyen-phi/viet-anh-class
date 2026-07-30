import {soVN, CONDUCT_LABEL, CONDUCT_CHIP, type Conduct} from '@/components/grades/labels';

export type ScoreTableRow = {
  studentId: string;
  name: string;
  published: boolean;
  /** Phiếu còn đây nhưng em đã rời lớp giữa đợt — không sửa/công bố thêm được (RLS). */
  daRoiLop: boolean;
  conduct: Conduct | null;
  /** môn → trung bình CÓ HỆ SỐ, lấy nguyên từ view subject_term_summary_v. */
  tb: Record<string, number | null>;
};

/**
 * Bảng điểm cả lớp trong một đợt: hàng = học sinh, cột = môn, ô = trung bình có hệ số.
 *
 * TRUNG BÌNH TỪNG EM KHÔNG TÍNH Ở ĐÂY. Nó lấy thẳng từ view `subject_term_summary_v`
 * (sum(score*weight)/sum(weight)) — migration 0064 dựng view đó chính vì hệ số nhân điểm mà lệch
 * giữa màn hình giáo viên và màn hình phụ huynh là loại lỗi phụ huynh phát hiện trước nhà trường.
 * Thứ duy nhất tính ở đây là TB CỦA CẢ LỚP theo môn (bình quân các em đã có điểm) — view gộp theo
 * phiếu nên không có sẵn con số mức lớp, và đây cũng là con số chỉ để BGH nhìn nhanh, không ghi
 * xuống đâu cả.
 *
 * Bề rộng tối thiểu tính bằng inline style chứ không phải class `min-w-[...]`: số môn thay đổi
 * theo lớp, mà Tailwind v4 chỉ sinh CSS cho chuỗi class thấy được lúc build — ghép chuỗi động là
 * class không tồn tại.
 */
export function ClassScoreTable({
  subjects,
  rows,
}: {
  subjects: string[];
  rows: ScoreTableRow[];
}) {
  const minWidth = 470 + subjects.length * 88;

  const tbLop = (mon: string): number | null => {
    const co = rows.map((r) => r.tb[mon]).filter((v): v is number => typeof v === 'number');
    if (co.length === 0) return null;
    return co.reduce((a, b) => a + b, 0) / co.length;
  };

  return (
    <div className="glass overflow-x-auto rounded-[20px]">
      <div
        className="flex items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]"
        style={{minWidth}}
      >
        <span className="w-[22px] flex-none text-[11px] font-extrabold text-grey-mid">#</span>
        <span className="flex-[1.4] text-[11px] font-extrabold uppercase text-grey-mid">
          Học sinh
        </span>
        {subjects.map((s) => (
          <span
            key={s}
            title={s}
            className="w-[80px] flex-none truncate text-center text-[11px] font-extrabold uppercase text-grey-mid"
          >
            {s}
          </span>
        ))}
        <span className="w-[104px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid">
          Hạnh kiểm
        </span>
        <span className="w-[92px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid">
          Trạng thái
        </span>
      </div>

      {rows.map((r, i) => (
        <div
          key={r.studentId}
          className="flex items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
          style={{minWidth}}
        >
          <span className="w-[22px] flex-none text-[12px] font-bold text-grey-mid">{i + 1}</span>
          <span className="flex min-w-0 flex-[1.4] items-center gap-1.5">
            <span className="min-w-0 truncate text-[13.5px] font-bold text-navy">{r.name}</span>
            {r.daRoiLop && (
              <span
                title="Em đã rời lớp giữa đợt. Phiếu và điểm cũ vẫn giữ nguyên, nhưng không sửa nhận xét/hạnh kiểm và không công bố thêm được nữa."
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-navy/70"
              >
                ○ đã rời lớp
              </span>
            )}
          </span>
          {subjects.map((s) => (
            <span
              key={s}
              className={`w-[80px] flex-none text-center text-[13px] font-bold ${
                typeof r.tb[s] === 'number' ? 'text-navy' : 'text-navy/25'
              }`}
            >
              {soVN(r.tb[s])}
            </span>
          ))}
          <span className="grid w-[104px] flex-none place-items-center">
            {r.conduct ? (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${CONDUCT_CHIP[r.conduct]}`}
              >
                {CONDUCT_LABEL[r.conduct]}
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-navy/25">—</span>
            )}
          </span>
          <span className="grid w-[92px] flex-none place-items-center">
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                r.published ? 'bg-gold/20 text-navy' : 'bg-navy/[0.08] text-grey-mid'
              }`}
            >
              {r.published ? 'đã công bố' : 'bản nháp'}
            </span>
          </span>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="border-t border-navy/[0.08] px-[18px] py-8 text-center text-sm text-grey-mid">
          Lớp chưa có phiếu nào trong đợt này.
        </div>
      )}

      {rows.length > 0 && subjects.length > 0 && (
        <div
          className="flex items-center gap-2 border-t border-navy/[0.08] bg-navy/[0.03] px-[18px] py-[10px]"
          style={{minWidth}}
        >
          <span className="w-[22px] flex-none" />
          <span className="flex-[1.4] text-[11px] font-extrabold uppercase text-grey-mid">
            TB của lớp
          </span>
          {subjects.map((s) => (
            <span
              key={s}
              className="w-[80px] flex-none text-center text-[13px] font-extrabold text-navy"
            >
              {soVN(tbLop(s))}
            </span>
          ))}
          <span className="w-[104px] flex-none" />
          <span className="w-[92px] flex-none" />
        </div>
      )}
    </div>
  );
}
