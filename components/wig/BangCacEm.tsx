import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';

// ════════════════════════════════════════════════════════════════════════════════════════════
// CÁC EM TUẦN NÀY — mỗi em một dòng, nhìn từ phía thầy cô (khu "Các em" của /wig, 40-C).
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mô hình PA2: MỌI số trên màn đi qua hàm lõi, không màn nào tự cộng. Bảng này đọc đúng một hàm
// definer tự gác `bang_lop_em(p_class, p_tuan)` — hàm trả về, cho từng em: tên, số mục tiêu đang
// chạy, việc đủ nhịp / tổng việc, cam kết giữ / tổng cam kết, và đã ghi nhận buổi họp với bạn hay
// chưa. Thầy cô CHỈ ĐỌC ở đây; muốn duyệt thì vào khu "Chờ duyệt", muốn ghi bù cho em thì mở bảng
// của em (nút "Xem bảng của em"). Bảng này không có nút "đặt hộ / sửa / xoá" — lời hứa là của em.
export async function BangCacEm({
  classId,
  monday,
  weekQ,
  classParam,
}: {
  classId: string;
  monday: string;
  weekQ: string;
  classParam?: string;
}) {
  const t = await getTranslations('lopMucTieu');
  const supabase = await createClient();
  const {data} = await supabase.rpc('bang_lop_em', {p_class: classId, p_tuan: monday});

  const em = (data ?? [])
    .slice()
    .sort((a, b) => (a.ho_ten ?? '').localeCompare(b.ho_ten ?? '', 'vi'));

  // Giữ ngữ cảnh tuần/lớp khi bấm sang bảng của em, để thầy cô không rơi về "tuần này" của em.
  const emHref = (id: string) => ({
    pathname: `/student/${id}` as const,
    query: {...(classParam ? {class: classParam} : {}), ...(weekQ ? {week: weekQ} : {})},
  });

  const th = 'px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid';
  const num = 'px-3 py-2.5 text-right text-[13px] font-extrabold tabular-nums text-navy';

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-3 font-display text-[15px] font-bold text-navy">{t('khuCacEm')}</h2>
      {em.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-grey-mid">{t('cacEmTrong')}</p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="bg-navy/[0.03]">
                <th className={th}>{t('cotEm')}</th>
                <th className={`${th} text-right`}>{t('cotMucTieu')}</th>
                <th className={`${th} text-right`}>{t('cotViec')}</th>
                <th className={`${th} text-right`}>{t('cotCamKet')}</th>
                <th className={`${th} text-center`}>{t('cotHop')}</th>
              </tr>
            </thead>
            <tbody>
              {em.map((e) => (
                <tr key={e.student_id} className="border-t border-navy/[0.07] align-middle">
                  <td className="px-3 py-2.5">
                    <Link
                      href={emHref(e.student_id)}
                      className="inline-flex min-h-[24px] items-center text-[13px] font-bold text-navy hover:underline"
                    >
                      {e.ho_ten}
                    </Link>
                  </td>
                  <td className={num}>
                    {e.mt_tong > 0 ? e.mt_tong : <span className="font-semibold text-grey-mid">—</span>}
                  </td>
                  <td className={num}>
                    {e.thuoc_tong > 0 ? (
                      `${e.thuoc_dat}/${e.thuoc_tong}`
                    ) : (
                      <span className="font-semibold text-grey-mid">—</span>
                    )}
                  </td>
                  <td className={num}>
                    {e.ck_tong > 0 ? (
                      `${e.ck_thang}/${e.ck_tong}`
                    ) : (
                      <span className="font-semibold text-grey-mid">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {e.pdr_da_ky ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                        <Check size={11} strokeWidth={3} />
                        {t('hopDaKy')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                        {t('hopChua')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
