'use client';

import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';
import {Field, selectInline} from '@/components/ui/Field';
import {useTranslations} from 'next-intl';
import {SCORE_KINDS, type ScoreKind} from '@/components/grades/labels';

// DB cho tới 20 lần một loại điểm; 10 đã quá đủ cho một học kỳ và danh sách ngắn thì chọn nhanh hơn.
const LAN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Đúng hai thứ ô chọn cần: id để gửi đi, tên để người đọc. */
export type MonChon = {id: string; name: string};

/**
 * Chọn CỘT ĐIỂM đang nhập: môn · loại điểm · lần thứ mấy.
 *
 * VÌ SAO CHỌN CỘT CHỨ KHÔNG LÀM LƯỚI HAI CHIỀU: một lớp 30 em, 8 môn, mỗi môn 4-5 con điểm là
 * hơn một nghìn ô nhập trên cùng một trang. Lưới đó vừa nặng vừa phải cuộn ngang liên tục, mà
 * giáo viên thực tế nhập theo tập bài vừa chấm — tức là đúng MỘT cột (một môn, một loại điểm,
 * một lần) cho cả lớp. Chọn cột rồi nhập một mạch từ trên xuống là đúng nhịp tay của họ, và
 * cũng đúng bộ khoá tự nhiên (review, subject_id, kind, ordinal) của bảng subject_scores nên lưu
 * được cả cột trong một lượt.
 *
 * KHÔNG CÒN Ô GÕ TÊN MÔN TỰ DO. Trước 0069 chỗ này cho gõ tay, và đó chính là cách "Ngữ văn" với
 * "Ngữ Văn" thành hai môn khác nhau trong cùng một lớp. Giờ môn là một dòng trong danh mục
 * (bảng subjects) và ô này chỉ chọn, không tạo — địa chỉ mang theo ID của môn, không mang tên.
 */
export function ColumnPicker({
  subjects,
  subjectId,
  kind,
  ordinal,
}: {
  subjects: MonChon[];
  subjectId: string;
  kind: ScoreKind;
  ordinal: number;
}) {
  const t = useTranslations('grades');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (patch: Record<string, string>) => {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    q.delete('flash');
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.6fr_1fr_0.8fr]">
        <Field label={t('fSubject')} htmlFor="grades-subject">
          <select
            id="grades-subject"
            value={subjectId}
            onChange={(e) => go({subject: e.target.value})}
            disabled={subjects.length === 0}
            className={`${selectInline} w-full`}
          >
            {subjects.length === 0 && <option value="">{t('noSubjectOption')}</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fScoreKind')} htmlFor="grades-kind">
          <select
            id="grades-kind"
            value={kind}
            onChange={(e) => go({kind: e.target.value})}
            className={`${selectInline} w-full`}
          >
            {SCORE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`scoreKinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fOrdinal')} htmlFor="grades-ordinal">
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

      {/* Nói trước đường đi khi thiếu môn, để không ai đi tìm ô gõ tay đã bỏ. */}
      <p className="text-[11px] italic text-grey-mid">
        {t('columnHint')}
        mục môn của trường rồi gắn cho lớp — cố ý không cho gõ tay tên môn, vì mỗi người gõ một
        kiểu là điểm của cùng một môn nằm rời ra hai chỗ.
      </p>
    </div>
  );
}
