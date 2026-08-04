import {getTranslations} from 'next-intl/server';
import {Check, X, Minus, ArrowRight, AlertTriangle} from 'lucide-react';
import {Link} from '@/i18n/navigation';
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

type MatrixRow = {
  student_id: string;
  student_name: string;
  lead_measure_id: string;
  active_weekdays: number[] | null;
  ticked_dates: string[] | null;
};

export async function MeetingTable({
  classId,
  weekStart,
  weekLabel,
  weekParam,
  hopParam,
  canManage,
  tuTrang = 'wig',
}: {
  classId: string;
  // Thứ Hai của tuần ĐANG TỔNG KẾT.
  weekStart: string;
  // Nhãn tuần ấy, để tiêu đề cột nói rõ đang xem số của tuần nào.
  weekLabel: string;
  // Tuần đang xem của trang (thanh ← → ở trên) — chỉ để server action quay về đúng chỗ.
  weekParam?: string;
  // Tuần đang tổng kết, rỗng nếu là tuần vừa xong — cũng chỉ để quay về đúng chỗ.
  hopParam?: string;
  canManage: boolean;
  // Bảng nhúng ở cả /wig lẫn /meeting; lưu xong phải quay về đúng trang vừa đứng.
  tuTrang?: 'wig' | 'meeting';
}) {
  const t = await getTranslations('meeting');
  const supabase = await createClient();

  // Hai truy vấn độc lập → chạy song song. class_lead_board đã lọc sẵn theo tuần và nhân hệ số
  // (0074/0076), nên đây đúng là con số học sinh nhìn thấy — không phải một cách tính thứ hai.
  //
  // CHỈ LẤY SỐ CỦA TUẦN ĐANG TỔNG KẾT. Bản đầu còn một cột "Tuần trước" để đối chiếu, nhưng chủ
  // dự án chốt bỏ: buổi họp bàn về một tuần, trộn số tuần khác vào chỉ làm rối. (Cột ấy cũng từng
  // hỏng vì ghép theo lead_measure_id — mỗi tuần một bộ id mới nên không dòng nào khớp.)
  const [{data: nay}, {data: ghiChu}, {data: matrix}] = await Promise.all([
    supabase.rpc('class_lead_board', {p_class: classId, p_week_start: weekStart}),
    supabase
      .from('wig_meeting_notes')
      .select('lead_measure_id, verdict, note')
      .eq('class_id', classId)
      .eq('week_start', weekStart),
    // Ma trận (em × việc) của đúng tuần đang tổng kết — để buổi họp trả lời được câu hỏi thật
    // của nó: EM NÀO CHƯA LÀM. Bảng trên chỉ có tổng cả lớp, mà "25/30" không cho biết đó là 21
    // em làm đều hay 5 em gánh cả lớp.
    supabase.rpc('class_tick_matrix', {p_class: classId, p_week_start: weekStart}),
  ]);

  const rows = (nay ?? []) as BoardRow[];
  if (rows.length === 0) return null;

  const noteById = new Map(((ghiChu ?? []) as NoteRow[]).map((r) => [r.lead_measure_id, r]));

  // ── TỪNG EM LÀM ĐƯỢC BAO NHIÊU ────────────────────────────────────────────────────────────
  //
  // Mẫu số là số ô em ĐÁNG LẼ tick được trong tuần ấy: với mỗi việc, đếm những ngày trong tuần
  // có thứ nằm trong active_weekdays. Cùng luật RLS dùng để chặn tick (lead_day_ok, 0073), nên
  // đây là trần thật — không phải "7 ngày × số việc" cho mọi trường hợp.
  const cuoiTuan = (() => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const soNgayApDung = (thu: number[] | null) => {
    const on = new Set(thu ?? [1, 2, 3, 4, 5, 6, 7]);
    let n = 0;
    for (const d = new Date(`${weekStart}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > cuoiTuan) break;
      if (on.has(d.getUTCDay() === 0 ? 7 : d.getUTCDay())) n += 1;
    }
    return n;
  };

  const theoEm = new Map<string, {ten: string; lam: number; can: number}>();
  for (const m of (matrix ?? []) as MatrixRow[]) {
    const cur = theoEm.get(m.student_id) ?? {ten: m.student_name, lam: 0, can: 0};
    cur.lam += (m.ticked_dates ?? []).length;
    cur.can += soNgayApDung(m.active_weekdays);
    theoEm.set(m.student_id, cur);
  }
  // Sắp theo TỈ LỆ TĂNG DẦN: buổi họp hỏi "ai chưa làm", nên những em cần nhắc phải nằm ngay đầu
  // danh sách thay vì để giáo viên tự dò trong ba mươi cái tên. Bằng nhau thì theo tên.
  const dsEm = [...theoEm.entries()]
    .map(([id, v]) => ({id, ...v, ti: v.can > 0 ? v.lam / v.can : 0}))
    .sort((a, b) => a.ti - b.ti || a.ten.localeCompare(b.ten, 'vi'));
  const chuaLam = dsEm.filter((e) => e.lam === 0).length;

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
        <input type="hidden" name="hop" value={hopParam ?? ''} />

        {/* Cuộn ngang trong khung riêng — trang không được cuộn ngang (luật của dự án). */}
        <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="bg-navy/[0.03]">
                {[t('colWork'), t('colResult', {week: weekLabel}), t('colVerdict'), t('colLesson')].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid ${
                        i >= 1 && i <= 2 ? 'text-center' : 'text-left'
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

      {/* TỪNG EM LÀM ĐƯỢC BAO NHIÊU.
          Bảng trên nói lớp được 25/30; con số ấy không cho biết đó là cả lớp làm đều hay vài em
          gánh phần còn lại. Buổi họp cần trả lời "em nào chưa làm" — nên xếp em thấp nhất lên
          đầu, thay vì để giáo viên tự dò trong ba mươi cái tên. */}
      {dsEm.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[13.5px] font-bold text-navy">
              {t('perStudent', {week: weekLabel})}
            </span>
            {chuaLam > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                <AlertTriangle size={11} strokeWidth={2.5} />
                {t('noneYet', {n: chuaLam})}
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
            <table className="w-full min-w-[420px] border-collapse">
              <tbody>
                {dsEm.map((e) => {
                  const pct = Math.round(e.ti * 100);
                  const mau =
                    e.lam === 0
                      ? 'var(--color-status-bad)'
                      : e.ti >= 0.8
                        ? 'var(--color-success)'
                        : 'var(--color-gold-mid)';
                  return (
                    <tr key={e.id} className="border-t border-navy/[0.07] first:border-t-0">
                      <td className="px-3 py-2">
                        <Link
                          href={`/student/${e.id}`}
                          className="text-[12.5px] font-bold text-navy hover:underline"
                        >
                          {e.ten}
                        </Link>
                      </td>
                      <td className="w-[86px] px-3 py-2 text-right text-[12.5px] font-extrabold tabular-nums text-navy">
                        {e.lam}/{e.can}
                      </td>
                      <td className="px-3 py-2">
                        <div className="h-[7px] w-full min-w-[80px] overflow-hidden rounded-[4px] bg-navy/[0.08]">
                          <div
                            className="h-full rounded-[4px]"
                            style={{width: `${pct}%`, background: mau}}
                          />
                        </div>
                      </td>
                      <td className="w-[52px] px-3 py-2 text-right text-[11.5px] font-bold tabular-nums text-grey-mid">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
