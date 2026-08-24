'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Check, CheckCircle2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';

// ════════════════════════════════════════════════════════════════════════════════════════════
// NÚT DUYỆT — một cái gật phải NHÌN THẤY ĐƯỢC
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án 24/08/2026: "khi ấn, nó cứ đứng im như không nhận... phải có ui gì đó báo là nó nhận
// rồi". Bản cũ là <button type=submit> trần trong một server component: không pending, không khoá
// nút, và action thì kết bằng redirect nên cả trang /wig (trang nặng nhất) phải dựng lại cho một
// câu UPDATE. Cô bấm — màn hình y nguyên vài giây — cô bấm nữa.
//
// Ba thứ đổi ở đây, và cả ba đều cần thiết:
//   ① SubmitButton (useFormStatus) → đang gửi thì nút KHOÁ + spinner giữa nút, không nhảy layout,
//      quá 12 giây thì SlowNotice bày đường thoát. Chặn luôn double-submit.
//   ② useActionState → xong là chip "Đã duyệt" thay chỗ nút, NGAY tại dòng đó. Không chờ điều
//      hướng, không mất chỗ cuộn.
//   ③ Action trả state (không redirect) và không revalidate trang đang mở → một vòng mạng cho một
//      câu UPDATE, thay vì một vòng UPDATE + một lượt dựng lại trang.
//
// Hành động được TRUYỀN VÀO (server action là prop hợp lệ) nên cùng một nút dùng cho cả ba chỗ
// gật: mục tiêu của em, cam kết của em ở bảng /wig, và cam kết trên trang của em.

export type DuyetState = {ok: boolean; error?: string};

export function NutDuyet({
  hanhDong,
  o,
  label,
}: {
  hanhDong: (prev: DuyetState, formData: FormData) => Promise<DuyetState>;
  /** Các ô ẩn gửi kèm (commitment_id / wig_id / week / class_id…). Bỏ giá trị rỗng. */
  o: Record<string, string | undefined>;
  /** Tên đọc được cho trình đọc màn hình — bảng nhiều dòng thì "Duyệt" trần nghe giống hệt nhau. */
  label?: string;
}) {
  const t = useTranslations('goal');
  const [state, action] = useActionState<DuyetState, FormData>(hanhDong, {ok: false});

  if (state.ok)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/[0.12] px-2.5 py-0.5 text-[10.5px] font-extrabold text-success-dark">
        <CheckCircle2 size={11} strokeWidth={2.5} />
        {t('approved')}
      </span>
    );

  return (
    <form action={action} className="contents">
      {Object.entries(o).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <SubmitButton
        label={label}
        wrapClass="inline-flex items-center gap-1"
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-gold-deep/40 bg-gold/[0.18] px-2.5 py-0.5 text-[10.5px] font-extrabold text-gold-text transition-all hover:bg-gold/30"
      >
        <Check size={11} strokeWidth={3} />
        {t('approveShort')}
      </SubmitButton>
      {state.error && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-status-bad">
          <AlertCircle size={11} strokeWidth={2.5} />
          {state.error}
        </span>
      )}
    </form>
  );
}
