import {getTranslations} from 'next-intl/server';
import {Check, X, Minus, ArrowRight} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold} from '@/components/ui/Field';
import {saveMeetingNotes} from '@/app/[locale]/(dashboard)/meeting/actions';

// Bảng để CẦM MÀ HỌP — mỗi dòng một việc chung của lớp trong tuần đang xem.
//
// Trước bản này, biên bản họp WIG là ba ô văn bản cho CẢ LỚP: chiêm nghiệm, cam kết, kế hoạch
// tuần sau. Không ai bị gọi tên, không có chỗ ghi lý do cho từng mục tiêu — nên thứ viết ra
// thường là một câu chung chung, và tuần sau không ai đọc lại.
//
// Ba cột làm nên khác biệt:
//   TUẦN TRƯỚC   nhịp 4DX bắt đầu bằng "tuần trước hứa gì, làm được đến đâu". Không có cột này
//                thì buổi họp chỉ nhìn hiện tại, và lời hứa tuần trước không bao giờ được đối
//                chiếu — app có ô ghi cam kết nhưng chưa màn hình nào đọc lại nó.
//   THẮNG/THUA   con người kết luận, máy không suy hộ. Em tick đủ 5/5 nhưng làm qua loa thì giáo
//                viên vẫn chấm thua được — mà con số 5/5 vẫn nằm nguyên đó cho mọi người thấy.
//   RÚT RA       chỗ ghi LÝ DO cho từng việc. Câu hỏi làm nhãn ("Rút ra điều gì?") chứ không
//                phải tên trường: người ta trả lời câu hỏi dễ hơn là điền vào ô trống.
//
// Cột "Tuần này" là máy đếm từ tick thật của học sinh và KHÔNG sửa được ở đây. Ranh giới ấy đặt
// ra từ f596b4b (bỏ nút "Ghi +" của giáo viên) và bản này giữ nguyên: nút thắng/thua chỉ là ghi
// nhận của buổi họp, không chảy vào bảng BGH hay điểm thi đua.

type BoardRow = {
  lead_measure_id: string;
  title: string;
  target_value: number | string;
  unit: string | null;
  class_total: number | string;
  contributors: number | string;
  class_size: number | string;
};

type NoteRow = {lead_measure_id: string; verdict: string | null; note: string | null};

export async function MeetingTable({
  classId,
  weekStart,
  weekParam,
  canManage,
  tuTrang = 'wig',
}: {
  classId: string;
  // Thứ Hai của tuần đang họp (đã chuẩn hoá ở trang /wig).
  weekStart: string;
  // Rỗng nếu đang ở tuần hiện tại — chỉ để server action quay về đúng chỗ.
  weekParam?: string;
  canManage: boolean;
  // Bảng nhúng ở cả /wig lẫn /meeting; lưu xong phải quay về đúng trang vừa đứng.
  tuTrang?: 'wig' | 'meeting';
}) {
  const t = await getTranslations('meeting');
  const supabase = await createClient();

  // Tuần trước = lùi 7 ngày. Tính bằng UTC trên chuỗi đã chuẩn hoá, không qua múi giờ lần nữa.
  const truoc = new Date(`${weekStart}T00:00:00Z`);
  truoc.setUTCDate(truoc.getUTCDate() - 7);
  const weekTruoc = truoc.toISOString().slice(0, 10);

  // Ba truy vấn độc lập → chạy song song. class_lead_board đã lọc sẵn theo tuần và nhân hệ số
  // (0074/0076), nên đây đúng là con số học sinh nhìn thấy — không phải một cách tính thứ hai.
  const [{data: nay}, {data: truocData}, {data: ghiChu}] = await Promise.all([
    supabase.rpc('class_lead_board', {p_class: classId, p_week_start: weekStart}),
    supabase.rpc('class_lead_board', {p_class: classId, p_week_start: weekTruoc}),
    supabase
      .from('wig_meeting_notes')
      .select('lead_measure_id, verdict, note')
      .eq('class_id', classId)
      .eq('week_start', weekStart),
  ]);

  const rows = (nay ?? []) as BoardRow[];
  if (rows.length === 0) return null;

  // GHÉP TUẦN TRƯỚC THEO TÊN VIỆC, KHÔNG THEO ID.
  //
  // Mỗi WIG tuần có bộ lead measure riêng của nó — tuần này một dòng "Đọc sách", tuần trước một
  // dòng "Đọc sách" khác, hai id khác nhau hoàn toàn. Bản đầu tôi map theo lead_measure_id, nên
  // cột "Tuần trước" hiện "—" ở MỌI dòng, MỌI tuần: cột quan trọng nhất của bảng chưa bao giờ
  // chạy. Tệ hơn, "—" đọc thành "tuần trước không có việc này", tức nói sai chứ không phải im.
  //
  // Ghép theo tên đã chuẩn hoá (bỏ khoảng trắng thừa, không phân biệt hoa thường) là cách khớp
  // được mà không bắt giáo viên khai thêm quan hệ giữa hai tuần. Đổi tên việc giữa hai tuần thì
  // mất khớp — chấp nhận: lúc đó nó ĐÚNG là một việc khác.
  const chuanTen = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const truocByTen = new Map(((truocData ?? []) as BoardRow[]).map((r) => [chuanTen(r.title), r]));
  const noteById = new Map(((ghiChu ?? []) as NoteRow[]).map((r) => [r.lead_measure_id, r]));

  const so = (r: BoardRow) => `${Number(r.class_total)}/${Number(r.target_value)} ${r.unit ?? ''}`;

  // Ba nút tròn: thắng · thua · CHƯA CHẤM. Radio thật + peer-checked của CSS — không cần
  // JavaScript, và bảng nằm trong một form server action nên giữ được như vậy thì không thêm
  // bundle client nào.
  //
  // Vì sao phải có nút thứ ba: radio một khi đã chọn thì HTML không có cách bỏ chọn. Thiếu nó,
  // giáo viên bấm nhầm "thắng" là kẹt luôn — không đường nào quay về "buổi họp chưa chấm việc
  // này", trừ khi xoá cả ô ghi chú. Cột verdict để nullable chính là để có trạng thái ấy.
  const nut = (leadId: string, gt: 'win' | 'lose' | '', dangChon: boolean) => {
    const mau =
      gt === 'win'
        ? 'border-success/30 text-success/40 peer-checked:border-transparent peer-checked:bg-success peer-checked:text-white'
        : gt === 'lose'
          ? 'border-status-bad/30 text-status-bad/40 peer-checked:border-transparent peer-checked:bg-status-bad peer-checked:text-white'
          : 'border-navy/15 text-grey-soft peer-checked:border-navy/40 peer-checked:bg-navy/[0.08] peer-checked:text-navy';
    const nhan = gt === 'win' ? t('verdictWin') : gt === 'lose' ? t('verdictLose') : t('verdictNone');
    return (
      <label className="cursor-pointer" title={nhan}>
        <input
          type="radio"
          name={`verdict_${leadId}`}
          value={gt}
          defaultChecked={dangChon}
          disabled={!canManage}
          className="peer sr-only"
          aria-label={nhan}
        />
        <span
          className={`grid h-8 w-8 place-items-center rounded-full border-[1.5px] transition-all ${mau} peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40`}
        >
          {gt === 'win' ? (
            <Check size={15} strokeWidth={3} />
          ) : gt === 'lose' ? (
            <X size={15} strokeWidth={3} />
          ) : (
            <Minus size={14} strokeWidth={3} />
          )}
        </span>
      </label>
    );
  };

  return (
    <div className="glass rounded-[20px] p-4">
      <div className="mb-1 font-display text-[14px] font-bold text-navy">{t('tableTitle')}</div>
      <p className="mb-3 max-w-[640px] text-[11.5px] font-semibold leading-relaxed text-grey-mid">
        {t('tableHint')}
      </p>

      <form action={saveMeetingNotes}>
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="week_start" value={weekStart} />
        <input type="hidden" name="week" value={weekParam ?? ''} />
        <input type="hidden" name="from" value={tuTrang} />

        {/* Cuộn ngang trong khung riêng — trang không được cuộn ngang (luật của dự án). */}
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="bg-navy/[0.03]">
                {[t('colWork'), t('colLastWeek'), t('colThisWeek'), t('colVerdict'), t('colLesson')].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid ${
                        i >= 1 && i <= 3 ? 'text-center' : 'text-left'
                      } ${i === 0 ? 'sticky left-0 z-10 bg-white' : ''}`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tr = truocByTen.get(chuanTen(r.title));
                const gc = noteById.get(r.lead_measure_id);
                return (
                  <tr key={r.lead_measure_id} className="border-t border-navy/[0.07] align-top">
                    {/* Cột tên việc GHIM TRÁI: bảng rộng 680px nên trên điện thoại phải cuộn
                        ngang, và nếu tên trôi mất thì giáo viên gõ vào ô "Rút ra" mà không còn
                        biết mình đang viết cho việc nào. Cùng cách bảng tick đang dùng. */}
                    <td className="sticky left-0 z-10 bg-white px-3 py-2.5">
                      <span className="text-[13px] font-bold text-navy">{r.title}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-grey-mid">
                        {t('joinedCount', {n: Number(r.contributors), total: Number(r.class_size)})}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[12.5px] font-semibold tabular-nums text-grey-mid">
                      {/* Việc mới đặt tuần này thì tuần trước không có gì — nói "—" chứ đừng hiện
                          0/0, vì 0/0 đọc thành "tuần trước không ai làm gì". */}
                      {tr ? so(tr) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-[13px] font-extrabold tabular-nums text-navy">
                      {so(r)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        {nut(r.lead_measure_id, 'win', gc?.verdict === 'win')}
                        {nut(r.lead_measure_id, 'lose', gc?.verdict === 'lose')}
                        {nut(r.lead_measure_id, '', !gc?.verdict)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {/* Ảnh chụp lúc mở trang: dòng này lúc ấy ĐÃ có ghi nhận hay chưa.
                          Server chỉ xoá những dòng mà người bấm Lưu THẬT SỰ nhìn thấy rồi xoá đi.
                          Không có nó thì: thầy A mở bảng, cô B ghi chú một việc, A bấm Lưu — form
                          của A mang ô trống cho việc đó nên xoá mất ghi chú của B, không báo gì. */}
                      {gc && <input type="hidden" name={`co_${r.lead_measure_id}`} value="1" />}
                      <textarea
                        name={`note_${r.lead_measure_id}`}
                        defaultValue={gc?.note ?? ''}
                        placeholder={t('lessonPlaceholder')}
                        disabled={!canManage}
                        rows={2}
                        className="w-full min-w-[180px] resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-navy outline-none transition-colors focus:border-navy disabled:bg-navy/[0.03]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canManage && (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11px] font-semibold italic text-grey-mid">
              {t('tableNote')}
            </span>
            <SubmitButton className={btnGold}>{t('saveTable')}</SubmitButton>
          </div>
        )}
      </form>
    </div>
  );
}

// Dòng "tuần trước lớp đã hứa gì" — đọc NGUYÊN VĂN ô cam kết của biên bản tuần trước.
//
// Chủ dự án chốt: hiện nguyên văn, không cấu trúc hoá, không thêm bước nhập liệu. Máy không đối
// chiếu hộ được, nhưng đặt lời hứa cạnh kết quả là đủ để buổi họp tự làm việc đó — mà trước bản
// này thì ô cam kết viết xong là nằm im, không màn hình nào đọc lại.
//
// TRA THEO NGÀY, không theo nhãn (0080). Trước đây bảng wig_meetings chỉ có week_label — mà nhãn
// ấy là ô chữ tự do trong MeetingForm, ai sửa tay thành "Tuần 31" là dòng này lặng lẽ không hiện.
// Đúng cặp "lọc theo nhãn vs lọc theo ngày" đã gây sự cố 7B1, và ở đây nó cắt đứt vòng cam kết mà
// không ai thấy. Nay biên bản có cột week_start; nhãn còn lại chỉ để con người đọc.
export async function LoiHuaTuanTruoc({
  classId,
  weekStartTruoc,
  weekLabelTruoc,
}: {
  classId: string;
  // Thứ Hai của tuần trước — khoá tra cứu thật.
  weekStartTruoc: string;
  // Chỉ để hiển thị trong câu "Tuần Wxx lớp đã hứa".
  weekLabelTruoc: string;
}) {
  const t = await getTranslations('meeting');
  const supabase = await createClient();
  const {data} = await supabase
    .from('wig_meetings')
    .select('next_actions, commitments')
    .eq('class_id', classId)
    .is('student_id', null)
    .eq('week_start', weekStartTruoc)
    .maybeSingle();

  const hua = (data?.next_actions ?? '').trim() || (data?.commitments ?? '').trim();
  if (!hua) return null;

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-[14px] border-[1.5px] border-gold-deep/25 bg-gold/[0.12] px-3.5 py-2.5">
      <ArrowRight size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-gold-deep" />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-gold-deep">
          {t('promisedLastWeek', {week: weekLabelTruoc})}
        </span>
        <p className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-navy">{hua}</p>
      </div>
    </div>
  );
}
