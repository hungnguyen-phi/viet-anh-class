import {getTranslations, getLocale} from 'next-intl/server';
import {Check, X} from 'lucide-react';
import {AREAS, areaLabel, type Area, type AreaMeta} from '@/lib/areas';

// Panel "cầm scoreboard mà họp" (PRD Màn 5/6): WIG tuần thắng/thua ×4 + lead hoàn thành/tổng,
// cho tuần đang họp.
//
// CHỈ HIỂN THỊ, KHÔNG TỰ HỎI CSDL NỮA (audit tốc độ 10/08/2026).
//
// Bản cũ tự bắn ba truy vấn: wig_progress_v, area_config, rồi lead_measures — và vì nó là
// component con render SAU khi cha đã xong, ba truy vấn ấy nằm ở HAI TẦNG CHỜ sâu nhất trang,
// tức là người dùng đã chờ hết cả trang rồi mới bắt đầu chờ tiếp cái panel này. Tệ hơn: cả ba
// đều hỏi lại đúng dữ liệu cha vừa lấy về (cùng view, cùng bảng, cùng khoảng tuần).
//
// Luật lọc theo NGÀY (không theo period_label) vẫn giữ nguyên, chỉ chuyển lên cha — xem chú thích
// ở StudentScoreboard chỗ dựng `wonByArea`. Lý do của luật ấy: period_label là ô CHỮ TỰ DO trên
// panel sửa WIG, sửa hai ô ngày mà quên ô nhãn là panel này mù, báo "chưa có số liệu tuần này"
// trong khi bảng tick ngay dưới đang hiện 18/30 (sự cố 7B1).
export async function MeetingScoreboard({
  weekLabel,
  areaMeta,
  wonByArea,
  leadsDone,
  leadsTotal,
}: {
  weekLabel: string;
  /** Màu/nhãn 4 lĩnh vực — cha đã đọc area_config rồi, đừng đọc lại. */
  areaMeta: Record<Area, AreaMeta>;
  /** Lĩnh vực nào có WIG tuần này, và WIG ấy đã đạt chưa. Không có khoá = chưa đặt WIG. */
  wonByArea: Map<string, boolean>;
  leadsDone: number;
  leadsTotal: number;
}) {
  const t = await getTranslations('meeting');
  const locale = await getLocale();

  const hasData = wonByArea.size > 0 || leadsTotal > 0;

  return (
    <div className="glass rounded-[20px] p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="font-display text-[14px] font-bold text-navy">{t('scoreThisWeek')}</span>
        <span className="rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-grey-mid">
          {weekLabel}
        </span>
        {leadsTotal > 0 && (
          <span className="ml-auto rounded-full bg-navy px-2.5 py-1 text-[11px] font-extrabold text-white">
            {t('leadDone')}: {leadsDone}/{leadsTotal}
          </span>
        )}
      </div>
      {!hasData ? (
        <p className="text-[12px] italic text-grey-mid">{t('noWeekData')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {AREAS.map((a) => {
            const am = areaMeta[a];
            const has = wonByArea.has(a);
            const won = wonByArea.get(a) ?? false;
            return (
              <div
                key={a}
                className="flex items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 px-2.5 py-2"
              >
                <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{background: am.hex}} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-navy">
                  {areaLabel(am, locale)}
                </span>
                {has ? (
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                    style={{
                      background: won ? 'var(--color-success)' : 'rgba(192,57,43,0.12)',
                      color: won ? '#fff' : 'var(--color-status-bad)',
                    }}
                  >
                    {won ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                ) : (
                  <span className="text-[10.5px] font-semibold text-grey-soft">—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
