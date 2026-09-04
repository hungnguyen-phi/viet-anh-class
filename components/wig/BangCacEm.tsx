import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import {tenHienThi} from '@/lib/ten-hien-thi';

// ════════════════════════════════════════════════════════════════════════════════════════════
// CÁC EM TUẦN NÀY — mỗi em một dòng, nhìn từ phía thầy cô (khu "Các em" của /wig, 40-C).
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mô hình PA2: MỌI số trên màn đi qua hàm lõi, không màn nào tự cộng. Bảng này đọc đúng một hàm
// definer tự gác `bang_lop_em(p_class, p_tuan)` — hàm trả về, cho từng em: tên, số mục tiêu đang
// chạy, thước đo đủ nhịp / tổng, cam kết giữ / tổng, và đã ghi nhận buổi họp với bạn hay chưa.
// Thầy cô CHỈ ĐỌC ở đây; muốn duyệt thì vào khu "Chờ duyệt", muốn ghi bù cho em thì mở bảng của
// em. Bảng này không có nút "đặt hộ / sửa / xoá" — lời hứa là của em.
//
// Hai bố cục (audit 04/09): dưới 640px bảng 5 cột bị cắt còn cột tên mà không có dấu hiệu cuộn —
// 700 em và thầy cô dùng điện thoại. Nên < 640px mỗi em là MỘT THẺ với 4 chip; ≥ 640px giữ bảng.
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

  // Tên rơi theo MỘT luật (lib/ten-hien-thi): hồ sơ trống tên thì lấy phần trước @ — không in ô trống.
  const ids = (data ?? []).map((e) => e.student_id);
  const {data: hoSo} = ids.length
    ? await supabase.from('profiles').select('id, email').in('id', ids)
    : {data: [] as {id: string; email: string | null}[]};
  const emailCua = new Map((hoSo ?? []).map((p) => [p.id, p.email]));

  const em = (data ?? [])
    .map((e) => ({...e, ten: tenHienThi(e.ho_ten, emailCua.get(e.student_id))}))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

  // Giữ ngữ cảnh tuần/lớp khi bấm sang bảng của em, để thầy cô không rơi về "tuần này" của em.
  const emHref = (id: string) => ({
    pathname: `/student/${id}` as const,
    query: {...(classParam ? {class: classParam} : {}), ...(weekQ ? {week: weekQ} : {})},
  });

  const trong = <span className="font-semibold text-grey-mid">—</span>;
  const soMt = (e: (typeof em)[number]) => (e.mt_tong > 0 ? String(e.mt_tong) : null);
  const soThuoc = (e: (typeof em)[number]) => (e.thuoc_tong > 0 ? `${e.thuoc_dat}/${e.thuoc_tong}` : null);
  const soCk = (e: (typeof em)[number]) => (e.ck_tong > 0 ? `${e.ck_thang}/${e.ck_tong}` : null);
  const chipHop = (daKy: boolean) =>
    daKy ? (
      <span className="inline-flex min-h-[24px] items-center gap-1 rounded-full bg-success/[0.12] px-2 text-[10.5px] font-extrabold text-success-dark">
        <Check size={11} strokeWidth={3} />
        {t('hopDaKy')}
      </span>
    ) : (
      <span className="inline-flex min-h-[24px] items-center rounded-full bg-navy/[0.06] px-2 text-[10.5px] font-extrabold text-grey-mid">
        {t('hopChua')}
      </span>
    );

  const th = 'px-3 py-2 text-left text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid';
  const num = 'px-3 py-2.5 text-right text-[13px] font-extrabold tabular-nums text-navy';

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-3 font-display text-[15px] font-bold text-navy">{t('khuCacEm')}</h2>
      {em.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-grey-mid">{t('cacEmTrong')}</p>
      ) : (
        <>
          {/* < 640px: mỗi em một thẻ, bốn chip có nhãn — không cột nào bị cắt. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {em.map((e) => (
              <li key={e.student_id} className="rounded-[14px] border-[1.5px] border-navy/10 bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={emHref(e.student_id)}
                    className="inline-flex min-h-[44px] min-w-0 flex-1 items-center text-[14px] font-extrabold text-navy hover:underline"
                  >
                    <span className="truncate">{e.ten}</span>
                  </Link>
                  {chipHop(e.pdr_da_ky)}
                </div>
                <dl className="mt-1 grid grid-cols-3 gap-1.5">
                  {[
                    [t('cotMucTieu'), soMt(e)],
                    [t('cotViec'), soThuoc(e)],
                    [t('cotCamKet'), soCk(e)],
                  ].map(([nhan, so]) => (
                    <div key={nhan as string} className="rounded-[10px] bg-navy/[0.04] px-2 py-1.5 text-center">
                      <dt className="text-[9.5px] font-extrabold uppercase tracking-wide text-grey-mid">{nhan}</dt>
                      <dd className="text-[14px] font-extrabold tabular-nums text-navy">{so ?? trong}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {/* ≥ 640px: bảng như cũ. */}
          <div className="hidden overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10 sm:block">
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
                        {e.ten}
                      </Link>
                    </td>
                    <td className={num}>{soMt(e) ?? trong}</td>
                    <td className={num}>{soThuoc(e) ?? trong}</td>
                    <td className={num}>{soCk(e) ?? trong}</td>
                    <td className="px-3 py-2.5 text-center">{chipHop(e.pdr_da_ky)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
