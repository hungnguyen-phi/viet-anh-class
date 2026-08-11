'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, CheckCircle2, SlidersHorizontal} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold, inputCls} from '@/components/ui/Field';
import {chinhNhip, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';

// CHỈNH NHỊP — kéo lại mốc tháng cho khớp năm học thật.
//
// App rải đều khi cô khai mục tiêu năm (lib/wig-nhip.ts). Nhưng năm học không đều: có Tết, có
// tuần thi, có tháng vào hè. Đây là chỗ cô kéo lại.
//
// TỔNG LUÔN PHẢI BẰNG ĐÍCH NĂM, và con số ấy hiện ngay lúc cô đang gõ chứ không đợi bấm Lưu —
// không có ràng buộc ấy thì "nhịp" thành một dãy số rời rạc, và cảnh báo lệch nhịp trong phòng
// họp sẽ nói dối theo hướng không ai đoán được.
//
// App KHÔNG tự bù phần chênh sang tháng khác: tự bù nghĩa là sửa một con số cô không nhìn thấy.
export function ChinhNhip({
  namId,
  tieuDe,
  can,
  unit,
  thang,
}: {
  namId: string;
  tieuDe: string;
  can: number;
  unit: string;
  thang: {id: string; label: string; target: number}[];
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(chinhNhip, {ok: false});
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(thang.map((m) => [m.id, String(m.target)])),
  );

  const tong = Object.values(v).reduce((s, x) => s + (Number(x) || 0), 0);
  const khop = Math.round(tong) === Math.round(can);
  const lonNhat = Math.max(...thang.map((m) => Number(v[m.id]) || 0), 1);

  return (
    <details className="glass rounded-[20px] p-[18px]">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-2">
        <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-navy">
          <SlidersHorizontal size={16} strokeWidth={2.5} />
          {t('paceTitle')}
        </h2>
        <span className="text-[11.5px] font-semibold text-grey-mid">{tieuDe}</span>
      </summary>

      {state.error && (
        <p className="mt-2.5 inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="mt-2.5 inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="nam_id" value={namId} />
        {thang.map((m) => (
          <div key={m.id} className="flex items-center gap-2.5">
            <span className="w-[64px] shrink-0 text-[12px] font-extrabold tabular-nums text-navy">
              {m.label}
            </span>
            {/* Thanh chỉ để NHÌN ra tháng nào cao thấp — con số mới là thứ được gửi đi. */}
            <span className="hidden h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-navy/[0.06] sm:block">
              <span
                className="block h-full rounded-full bg-gold"
                style={{width: `${Math.round(((Number(v[m.id]) || 0) / lonNhat) * 100)}%`}}
              />
            </span>
            <input
              name={`moc_${m.id}`}
              type="number"
              step="any"
              min="0.01"
              inputMode="decimal"
              value={v[m.id] ?? ''}
              onChange={(e) => setV((p) => ({...p, [m.id]: e.target.value}))}
              className={`${inputCls} w-[104px] shrink-0 tabular-nums`}
            />
          </div>
        ))}

        <p
          className={`mt-1 text-[12px] font-extrabold tabular-nums ${khop ? 'text-success-dark' : 'text-status-bad'}`}
        >
          {t('paceTotal', {tong: Math.round(tong), can: Math.round(can), unit})}
        </p>

        <div>
          {/* Nút vẫn bấm được khi lệch: máy chủ kiểm lại và trả câu nói rõ lệch bao nhiêu. Chặn ở
              trình duyệt thôi là kiểu chặn mà người dùng không hiểu vì sao nút không ăn. */}
          <SubmitButton className={btnGold} wrapClass="contents">
            {t('paceSave')}
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}
