import {getTranslations} from 'next-intl/server';

// ════════════════════════════════════════════════════════════════════════════
// DẢI CHỈ SỐ — 4 con số của PRD v3 mục 6.3, đọc trong một dòng chip
// ════════════════════════════════════════════════════════════════════════════
//
// Lead hoàn thành / tổng (+%) và cam kết thắng/thua (+% thắng), tuần đang xem + luỹ kế.
// Dùng ở cả màn của em lẫn trang /wig của giáo viên — MỘT cách đếm, một cách hiện
// (nguồn: metrics_tuan_v, 0147). Emerald chỉ dành cho THẮNG, đúng luật màu chức năng.

export type ChiSo = {
  tong_lead: number;
  lead_xong: number;
  tong_ck: number;
  ck_thang: number;
  ck_thua: number;
};

export const CHI_SO_RONG: ChiSo = {tong_lead: 0, lead_xong: 0, tong_ck: 0, ck_thang: 0, ck_thua: 0};

export function gopChiSo(rows: {[K in keyof ChiSo]?: number | null}[]): ChiSo {
  const s = {...CHI_SO_RONG};
  for (const r of rows) {
    s.tong_lead += r.tong_lead ?? 0;
    s.lead_xong += r.lead_xong ?? 0;
    s.tong_ck += r.tong_ck ?? 0;
    s.ck_thang += r.ck_thang ?? 0;
    s.ck_thua += r.ck_thua ?? 0;
  }
  return s;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 100) / b) : null);

export async function DaiChiSo({
  tuan,
  luyKe,
  pips,
}: {
  tuan: ChiSo;
  luyKe: ChiSo;
  /** Dãy pip thắng/thua theo TUẦN, cũ → mới (v3 6.1.1) — mỗi cam kết đã chấm một ô. */
  pips?: {thang: number; thua: number}[];
}) {
  const t = await getTranslations('metrics');
  // Chưa có gì để đếm thì đừng bày một dải số 0 — im lặng tốt hơn một hàng "0/0".
  if (tuan.tong_lead === 0 && tuan.tong_ck === 0 && luyKe.tong_ck === 0 && luyKe.tong_lead === 0)
    return null;

  const pLead = pct(tuan.lead_xong, tuan.tong_lead);
  const daCham = tuan.ck_thang + tuan.ck_thua;
  const pLeadLk = pct(luyKe.lead_xong, luyKe.tong_lead);
  const chamLk = luyKe.ck_thang + luyKe.ck_thua;
  const pThangLk = pct(luyKe.ck_thang, chamLk);

  const chip = 'inline-flex items-center gap-1 rounded-full bg-navy/[0.05] px-2.5 py-1 text-[11.5px] font-bold text-navy';
  // Dãy pip: bung mỗi tuần thành các ô ✓/✗, giữ 12 ô mới nhất — đủ đọc nhịp một học kỳ ngắn.
  const oPip = (pips ?? [])
    .flatMap((w) => [
      ...Array.from({length: w.thang}, () => 'win' as const),
      ...Array.from({length: w.thua}, () => 'lose' as const),
    ])
    .slice(-12);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {oPip.length > 0 && (
        <span className="inline-flex items-center gap-[3px]" aria-label={t('pipsLabel')}>
          {oPip.map((v, i) => (
            <span
              key={i}
              className={`grid h-[14px] w-[14px] place-items-center rounded-[4px] text-[9px] font-black text-white ${
                v === 'win' ? 'bg-success' : 'bg-status-bad'
              }`}
            >
              {v === 'win' ? '✓' : '✗'}
            </span>
          ))}
        </span>
      )}
      {tuan.tong_lead > 0 && (
        <span className={chip}>
          {t('leadWeek', {x: tuan.lead_xong, y: tuan.tong_lead})}
          {pLead !== null && <b className="tabular-nums text-grey-mid">· {pLead}%</b>}
        </span>
      )}
      {daCham > 0 && (
        <span className={chip}>
          {t('winWeek', {x: tuan.ck_thang, y: daCham})}
          {tuan.ck_thang > 0 && <b className="text-success-dark">✓</b>}
        </span>
      )}
      {(luyKe.tong_lead > 0 || chamLk > 0) && (
        <span className={`${chip} bg-transparent text-grey-mid`}>
          {t('cum')}
          {pLeadLk !== null && <b className="tabular-nums">{t('cumLead', {p: pLeadLk})}</b>}
          {pThangLk !== null && <b className="tabular-nums text-success-dark">{t('cumWin', {p: pThangLk})}</b>}
        </span>
      )}
    </div>
  );
}
