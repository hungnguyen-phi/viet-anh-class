'use client';

// GHI SỐ cho thước đo cá nhân loại "điền số" của thầy cô — một ô số + nút ghi, mỗi lần ghi là
// một LƯỢT hôm nay (student_id = thầy cô). Ghi thẳng qua supabase client như TickCuaToi.
import {useState, useTransition} from 'react';
import {useRouter} from '@/i18n/navigation';
import {Plus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {createClient} from '@/lib/supabase/client';

export function GhiSoToi({
  leadId,
  studentId,
  today,
  tongTuan,
  chiTieu,
  donVi,
}: {
  leadId: string;
  studentId: string;
  today: string;
  /** Tổng đã ghi trong tuần đang xem. */
  tongTuan: number;
  chiTieu: number;
  donVi: string;
}) {
  const t = useTranslations('camKet');
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [, startTransition] = useTransition();
  const [so, setSo] = useState('');
  const [dangGhi, setDangGhi] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  async function ghi() {
    const n = Number(so);
    if (!Number.isFinite(n) || n <= 0 || dangGhi) return;
    setDangGhi(true);
    setLoi(null);
    const {error} = await supabase.from('luot').insert({thuoc_id: leadId, student_id: studentId, ngay: today, gia_tri: n});
    setDangGhi(false);
    if (error) setLoi(t('ghiLoi'));
    else {
      setSo('');
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <span className="text-chu-thich font-bold tabular-nums text-grey-mid">
        {t('tongTuan', {so: Math.round(tongTuan * 10) / 10, dich: chiTieu, dv: donVi})}
      </span>
      <input
        type="number"
        value={so}
        onChange={(e) => setSo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void ghi();
          }
        }}
        step="any"
        min="0"
        inputMode="decimal"
        placeholder={donVi}
        aria-label={t('ghiThem')}
        className="ctl-h w-24 rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-base font-semibold text-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:text-sm"
      />
      <button
        type="button"
        onClick={ghi}
        disabled={dangGhi || so.trim() === ''}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 text-than font-extrabold text-navy transition-all hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={12} strokeWidth={2.5} />
        {t('ghiThem')}
      </button>
      {loi && <span role="alert" className="text-chu-thich font-bold text-status-bad">{loi}</span>}
    </div>
  );
}
