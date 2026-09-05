'use client';

// LUỒNG SỐ — sơ đồ động cho thẻ "Số chảy thế nào" của tour giáo viên (05/09/2026).
//
// Chủ dự án: "luồng hoạt động, xong rồi có animation thì tốt hơn: Cam kết → mục tiêu cá nhân →
// mục tiêu lớp [cùng đơn vị] là xong, không cần nói các em ở màn giáo viên". Ba ô một hàng, một
// viên số vàng chạy qua ba bậc rồi lặp; ô nào viên số tới thì sáng viền. Mũi tên cuối ghi
// "cùng đơn vị" — điều kiện duy nhất người dùng cần nhớ.
//
// Chuyển động chỉ bằng CSS (globals.css: va-luong / va-luong-sang) nên prefers-reduced-motion tự
// rút về tĩnh: viên số đứng ở bậc cuối, sơ đồ vẫn đọc được. role="img" + aria-label tả bằng lời.
import {useTranslations} from 'next-intl';

const TRE = ['0s', '1.05s', '2.1s']; // pha sáng viền khớp lúc viên số dừng ở từng ô (chu kỳ 4.2s)

export function LuongSo() {
  const t = useTranslations('huongDan');
  const o = [t('luong.camKet'), t('luong.mucTieuToi'), t('luong.mucTieuLop')];
  return (
    <div className="mt-3 w-full" role="img" aria-label={t('luong.moTa')}>
      <div className="relative flex items-stretch gap-1 pb-5 pt-7">
        {/* Viên số chạy — tuyệt đối trên hàng ô, left theo % tâm ô. */}
        <span
          aria-hidden
          className="animate-luong pointer-events-none absolute top-0 inline-flex h-6 min-w-[36px] items-center justify-center rounded-full bg-gold px-2 font-display text-chu-thich font-bold text-navy shadow-sm"
        >
          +3
        </span>
        {o.map((nhan, idx) => (
          <div key={nhan} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              style={{animationDelay: TRE[idx]}}
              className="animate-luong-sang min-w-0 flex-1 rounded-[12px] border-[1.5px] border-navy/15 bg-white px-1.5 py-2 text-center text-than font-extrabold leading-tight text-navy"
            >
              {nhan}
            </div>
            {idx < 2 && (
              <span className="relative flex shrink-0 items-center self-stretch text-navy/50">
                <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
                  <path d="M2 7h10m-3-3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {idx === 1 && (
                  <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold/25 px-1.5 text-nhan font-extrabold text-navy">
                    {t('luong.cungDonVi')}
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
