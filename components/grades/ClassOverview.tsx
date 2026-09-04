import {getTranslations} from 'next-intl/server';
import {CONDUCTS, CONDUCT_TEXT, type Conduct} from '@/components/grades/labels';

/**
 * Nhìn nhanh cả lớp trong một đợt: phân bố hạnh kiểm + đã công bố tới đâu.
 *
 * Đây là phần ban giám hiệu xin ("biết các thông tin về điểm số, rèn luyện của học sinh") nên
 * CHỈ HIỆN SỐ, không có một nút ghi nào — RLS của 0064 chặn hiệu trưởng sửa điểm và nhận xét,
 * vẽ nút ra chỉ để bấm vào rồi báo lỗi thì thà đừng vẽ.
 */
export async function ClassOverview({
  rows,
}: {
  rows: {conduct: Conduct | null; published: boolean}[];
}) {
  const t = await getTranslations('grades');
  const dem = (c: Conduct) => rows.filter((r) => r.conduct === c).length;
  const chuaXep = rows.filter((r) => r.conduct === null).length;
  const daCongBo = rows.filter((r) => r.published).length;

  return (
    <section>
      <h2 className="mb-3 font-display text-tieu-de font-bold text-navy">{t('conductTitle')}</h2>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {CONDUCTS.map((c) => (
          <div key={c} className="glass glass-hover rounded-[20px] p-4 text-center">
            <div className={`font-display text-hien-thi font-bold ${CONDUCT_TEXT[c]}`}>{dem(c)}</div>
            <div className="mt-1 text-xs font-extrabold text-txt">{t(`conducts.${c}`)}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-chu-thich font-semibold text-grey-mid">
        Đã công bố <b className="text-navy">{daCongBo}</b>/{rows.length} phiếu
        {chuaXep > 0 && <> · còn {chuaXep} em chưa xếp hạnh kiểm</>}
      </p>
    </section>
  );
}
