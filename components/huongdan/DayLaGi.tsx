'use client';

// KHỐI "ĐÂY LÀ GÌ?" ĐẦU BA FORM (Mục tiêu · Cam kết tuần · Thước đo dẫn dắt) — 04/09/2026.
//
// Chủ dự án: "nêu khái niệm ra, nên đặt vào đó là cái gì, để cùng tiến lên một mục tiêu". Ba
// phần ngắn: (1) khái niệm một câu lớp 5; (2) sơ đồ ba tầng Thước đo (mỗi ngày) → Cam kết (mỗi
// tuần) → Mục tiêu (cả năm), tô sáng tầng đang tạo; (3) ví dụ hai dòng đúng ngữ cảnh.
// Thu gọn được; nhớ trạng thái theo localStorage; LẦN ĐẦU mở sẵn, sau đó thu gọn mặc định để
// không đẩy nút Lưu ra khỏi màn 360.
import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ChevronDown, Lightbulb} from 'lucide-react';

export type TangHd = 'mucTieu' | 'camKet' | 'thuoc';
export type VaiHd = 'em' | 'gvToi' | 'gvLop' | 'nguoiLon';

function khoa(tang: TangHd) {
  return `va:hd:daylagi:${tang}`;
}

export function DayLaGi({tang, vai = 'em'}: {tang: TangHd; vai?: VaiHd}) {
  const t = useTranslations('huongDan');
  const [mo, setMo] = useState(false);
  const [san, setSan] = useState(false);
  useEffect(() => {
    // Lần đầu (chưa có khoá) mở sẵn; đã từng xem thì thu gọn.
    let daXem = false;
    try { daXem = localStorage.getItem(khoa(tang)) === '1'; } catch { /* private */ }
    setMo(!daXem);
    setSan(true);
  }, [tang]);
  const doi = () => {
    setMo((v) => {
      const moi = !v;
      try { localStorage.setItem(khoa(tang), '1'); } catch { /* private */ }
      return moi;
    });
  };
  // Ví dụ theo vai: em / thầy cô (mục tiêu của tôi) / lớp; người lớn khác dùng bản gvLop.
  const vd = vai === 'em' ? 'em' : vai === 'gvToi' ? 'gvToi' : 'gvLop';
  const id = `daylagi-${tang}`;

  return (
    <section className="rounded-[12px] border-[1.5px] border-gold/50 bg-gold/[0.08]">
      <button
        type="button"
        aria-expanded={san ? mo : false}
        aria-controls={id}
        onClick={doi}
        className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Lightbulb size={16} strokeWidth={2.5} className="shrink-0 text-gold-deep" />
        <span className="flex-1 font-display text-noi-dung font-bold text-navy">{t(`dayLaGi.${tang}.tieuDe`)}</span>
        <ChevronDown size={16} strokeWidth={2.5} className={`shrink-0 text-grey-mid transition-transform ${mo ? 'rotate-180' : ''}`} />
      </button>
      {san && mo && (
        <div id={id} className="flex flex-col gap-3 px-3 pb-3">
          {/* (1) Khái niệm */}
          <p className="text-noi-dung leading-relaxed text-navy">{t(`dayLaGi.${tang}.khaiNiem.${vai === 'em' ? 'em' : 'nguoiLon'}`)}</p>
          {/* (2) Sơ đồ ba tầng */}
          <SoDoBaTang sang={tang} />
          <p className="text-chu-thich font-semibold text-grey-mid">{t('dayLaGi.chuoi')}</p>
          {/* (3) Ví dụ — rút từ mục tiêu thật của trường năm 2024-2025 (ẩn danh). */}
          <div className="rounded-[12px] bg-white/80 px-3 py-2">
            <p className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{t('dayLaGi.viDu')}</p>
            <p className="mt-0.5 text-than leading-relaxed text-navy">{t(`dayLaGi.viDuTheo.${vd}.mucTieu`)}</p>
            <p className="text-than leading-relaxed text-navy">→ {t(`dayLaGi.viDuTheo.${vd}.camKet`)}</p>
            <p className="text-than leading-relaxed text-navy">→ {t(`dayLaGi.viDuTheo.${vd}.thuoc`)}</p>
          </div>
          {/* (4) Hai lỗi hay gặp nhất (≈1/10 mục tiêu và thước đo các em từng viết): không có số; gộp hai việc. */}
          <div className="rounded-[12px] border border-status-bad/25 bg-white/80 px-3 py-2">
            <p className="text-nhan font-extrabold uppercase tracking-wide text-status-bad">{t('dayLaGi.dungViet')}</p>
            <p className="mt-0.5 text-than leading-relaxed text-navy">
              <span className="text-grey-mid line-through">{t(`dayLaGi.${vai === 'em' ? 'loi' : 'loiNguoiLon'}.${tang}.sai`)}</span>
              {' → '}
              <span className="font-bold">{t(`dayLaGi.${vai === 'em' ? 'loi' : 'loiNguoiLon'}.${tang}.dung`)}</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// Sơ đồ ba tầng — SVG inline, tô sáng tầng đang tạo.
function SoDoBaTang({sang}: {sang: TangHd}) {
  const t = useTranslations('huongDan');
  const tang: {k: TangHd; nhan: string; phu: string}[] = [
    {k: 'thuoc', nhan: t('dayLaGi.tang.thuoc'), phu: t('dayLaGi.tang.thuocPhu')},
    {k: 'camKet', nhan: t('dayLaGi.tang.camKet'), phu: t('dayLaGi.tang.camKetPhu')},
    {k: 'mucTieu', nhan: t('dayLaGi.tang.mucTieu'), phu: t('dayLaGi.tang.mucTieuPhu')},
  ];
  return (
    <div className="flex items-stretch gap-1" role="img" aria-label={t('dayLaGi.soDoMoTa')}>
      {tang.map((x, idx) => {
        const on = x.k === sang;
        return (
          <div key={x.k} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className={`min-w-0 flex-1 rounded-[12px] border-[1.5px] px-2 py-1.5 text-center ${
                on ? 'border-navy bg-navy text-white shadow-sm' : 'border-navy/15 bg-white text-navy'
              }`}
            >
              <div className="truncate text-than font-extrabold">{x.nhan}</div>
              <div className={`truncate text-nhan font-bold ${on ? 'text-white/80' : 'text-grey-mid'}`}>{x.phu}</div>
            </div>
            {idx < 2 && (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-navy/50">
                <path d="M2 7h8m-3-3 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Dòng "Nên viết gì" dưới nhãn ô nhập. */
export function GoiYO({k}: {k: string}) {
  const t = useTranslations('huongDan');
  return <p className="mb-1 text-chu-thich font-semibold text-grey-mid">{t(`goiYO.${k}`)}</p>;
}
