'use client';

import {useState} from 'react';
import {Plus} from 'lucide-react';
import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';
import {Field, selectInline, inputInline, btnGhost} from '@/components/ui/Field';
import {SCORE_KINDS, SCORE_KIND_LABEL, type ScoreKind} from '@/components/grades/labels';

const MON_KHAC = '__mon_khac__';
// DB cho tới 20 lần một loại điểm; 10 đã quá đủ cho một học kỳ và danh sách ngắn thì chọn nhanh hơn.
const LAN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Chọn CỘT ĐIỂM đang nhập: môn · loại điểm · lần thứ mấy.
 *
 * VÌ SAO CHỌN CỘT CHỨ KHÔNG LÀM LƯỚI HAI CHIỀU: một lớp 30 em, 8 môn, mỗi môn 4-5 con điểm là
 * hơn một nghìn ô nhập trên cùng một trang. Lưới đó vừa nặng vừa phải cuộn ngang liên tục, mà
 * giáo viên thực tế nhập theo tập bài vừa chấm — tức là đúng MỘT cột (một môn, một loại điểm,
 * một lần) cho cả lớp. Chọn cột rồi nhập một mạch từ trên xuống là đúng nhịp tay của họ, và
 * cũng đúng bộ khoá tự nhiên (review, subject, kind, ordinal) của bảng subject_scores nên lưu
 * được cả cột trong một lượt.
 *
 * Danh sách môn lấy từ thời khoá biểu của lớp cộng các môn đã có điểm; dự án chưa có bảng danh
 * mục môn (0064 giải thích vì sao) nên vẫn phải cho gõ tên môn mới.
 */
export function ColumnPicker({
  subjects,
  subject,
  kind,
  ordinal,
}: {
  subjects: string[];
  subject: string;
  kind: ScoreKind;
  ordinal: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Mở sẵn ô gõ tên môn khi lớp chưa có môn nào để chọn — nếu không thì màn hình là ngõ cụt.
  const [monMoi, setMonMoi] = useState(subjects.length === 0);
  const [tenMon, setTenMon] = useState('');

  const go = (patch: Record<string, string>) => {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    q.delete('flash');
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.6fr_1fr_0.8fr]">
        <Field label="Môn học" htmlFor="grades-subject">
          <select
            id="grades-subject"
            value={monMoi ? MON_KHAC : subject}
            onChange={(e) => {
              if (e.target.value === MON_KHAC) setMonMoi(true);
              else {
                setMonMoi(false);
                go({subject: e.target.value});
              }
            }}
            className={`${selectInline} w-full`}
          >
            {subjects.length === 0 && <option value="">— chưa có môn nào —</option>}
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={MON_KHAC}>+ Môn khác…</option>
          </select>
        </Field>

        <Field label="Loại điểm" htmlFor="grades-kind">
          <select
            id="grades-kind"
            value={kind}
            onChange={(e) => go({kind: e.target.value})}
            className={`${selectInline} w-full`}
          >
            {SCORE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SCORE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Lần thứ" htmlFor="grades-ordinal">
          <select
            id="grades-ordinal"
            value={String(ordinal)}
            onChange={(e) => go({ordinal: e.target.value})}
            className={`${selectInline} w-full`}
          >
            {LAN.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {monMoi && (
        <div className="flex flex-wrap items-end gap-2">
          <Field
            label="Tên môn mới"
            htmlFor="grades-subject-new"
            hint="Gõ đúng tên môn như trong sổ điểm, ví dụ: Toán, Ngữ văn, Tiếng Anh."
            className="flex-1"
          >
            <input
              id="grades-subject-new"
              value={tenMon}
              onChange={(e) => setTenMon(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && tenMon.trim()) {
                  e.preventDefault();
                  go({subject: tenMon.trim()});
                }
              }}
              maxLength={60}
              className={`${inputInline} w-full`}
            />
          </Field>
          <button
            type="button"
            disabled={!tenMon.trim()}
            onClick={() => go({subject: tenMon.trim()})}
            className={btnGhost}
          >
            <Plus size={14} strokeWidth={2.5} />
            Dùng môn này
          </button>
        </div>
      )}
    </div>
  );
}
