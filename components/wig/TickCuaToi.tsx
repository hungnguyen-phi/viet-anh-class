'use client';

import {useOptimistic, useState, useTransition} from 'react';
import {useRouter} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/client';

// THẦY CÔ TICK THƯỚC ĐO CÁ NHÂN CỦA MÌNH — như TickCuaLop nhưng lượt mang student_id CỦA THẦY CÔ
// (thước chu_the='em', pham_vi='tung_em', chủ là thầy cô — 0181). Policy rls_em_ghi_luot cho
// "chính chủ tự ghi" không phân vai; trigger luot_truoc_ghi tự điền nguoi_ghi. Ghi thẳng qua
// supabase client như TickCuaLop — một cú chạm, không bắt chờ revalidate cả trang.
export function TickCuaToi({
  leadId,
  studentId,
  days,
  daTick,
  today,
  moKhoa,
  dayShort,
}: {
  leadId: string;
  /** Id hồ sơ của CHÍNH thầy cô — chủ của thước và của lượt. */
  studentId: string;
  days: string[];
  daTick: string[];
  today: string;
  moKhoa: boolean;
  dayShort: string[];
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [, startTransition] = useTransition();
  const [dangGhi, setDangGhi] = useState<ReadonlySet<string>>(() => new Set());
  const [view, apply] = useOptimistic(daTick, (state: string[], a: {date: string; on: boolean}) =>
    a.on ? [...state, a.date] : state.filter((d) => d !== a.date),
  );

  async function chuyen(date: string) {
    if (!moKhoa || date > today || dangGhi.has(date)) return;
    const on = !view.includes(date);
    setDangGhi((p) => new Set(p).add(date));
    startTransition(() => apply({date, on}));

    const {error} = on
      ? await supabase.from('luot').insert({
          thuoc_id: leadId,
          student_id: studentId,
          ngay: date,
          gia_tri: 1,
        })
      : await supabase
          .from('luot')
          .delete()
          .eq('thuoc_id', leadId)
          .eq('student_id', studentId)
          .eq('ngay', date)
          .eq('nguon', 'tay');

    setDangGhi((p) => {
      const s = new Set(p);
      s.delete(date);
      return s;
    });
    if (error) router.refresh();
    else startTransition(() => router.refresh());
  }

  if (days.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {days.map((d) => {
        const on = view.includes(d);
        const sau = d > today;
        const bay = dangGhi.has(d);
        const thu = dayShort[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7];
        return (
          <button
            key={d}
            type="button"
            onClick={() => chuyen(d)}
            disabled={!moKhoa || sau || bay}
            aria-pressed={on}
            aria-label={`${thu} ${d.slice(8, 10)}/${d.slice(5, 7)}`}
            className={`grid h-11 w-11 place-items-center rounded-[9px] border-[1.5px] text-[11.5px] font-extrabold transition-all disabled:cursor-not-allowed ${
              on
                ? 'border-transparent bg-gold text-navy shadow-[var(--shadow-gold)]'
                : sau || !moKhoa
                  ? 'border-navy/10 bg-white text-grey-soft'
                  : 'cursor-pointer border-navy/15 bg-white text-grey-mid hover:border-navy'
            }`}
          >
            {thu}
          </button>
        );
      })}
    </div>
  );
}
