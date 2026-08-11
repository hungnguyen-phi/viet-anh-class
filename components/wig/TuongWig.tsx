import {getTranslations} from 'next-intl/server';
import {Check, Clock} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold} from '@/components/ui/Field';
import {duyetMucTieu} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// BỨC TƯỜNG WIG — trận đánh của lớp ở trên, mục tiêu của từng em ở dưới
// ════════════════════════════════════════════════════════════════════════════
//
// Bản số của cái WIG wall dán tường trong Leader in Me. Nó làm hai việc mà không màn nào khác
// làm được:
//
//   1. Cho em thấy mình thuộc về một trận đánh chung — mục tiêu của em khác nhau, nhưng đều
//      nằm dưới cùng một cái đích của lớp.
//   2. Cho cô một HÀNG ĐỢI DUYỆT. Trước bản này, muốn duyệt mục tiêu em nào thì phải mở trang
//      riêng của em ấy — ba mươi em là ba mươi lượt mở trang, và không có chỗ nào nói cho cô
//      biết có bao nhiêu em đang chờ.
//
// Cũng là chỗ duy nhất nhìn ra được chuyện cả mô hình phụ thuộc vào: BAO NHIÊU EM TỰ ĐẶT. Cô gõ
// hộ được (docs/MO_HINH_WIG.md §4), nhưng nếu cô gõ hộ hết thì mô hình quay về đúng bản cũ chỉ
// khác cái tên — và chuyện đó phải nhìn thấy được, không phải phát hiện sau sáu tháng.

export type MucTieuTrenTuong = {
  id: string;
  student_id: string;
  ten: string;
  kind: string;
  status: string;
  set_by: string | null;
  measure_by: string;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  end_date: string;
  achieved_at: string | null;
  source_wig_id: string | null;
};

export async function TuongWig({
  wigLop,
  mucTieu,
  siSo,
}: {
  wigLop: {id: string; title: string; target_value: number; unit: string}[];
  mucTieu: MucTieuTrenTuong[];
  siSo: number;
}) {
  const t = await getTranslations('goal');

  const hocTap = mucTieu.filter((m) => m.kind === 'academic');
  const choDuyet = mucTieu.filter((m) => m.status === 'sent');
  const tuDat = mucTieu.filter((m) => m.set_by === 'student').length;
  const tyLe = mucTieu.length > 0 ? Math.round((tuDat / mucTieu.length) * 100) : 0;

  const theTen = (m: MucTieuTrenTuong) => (
    <div key={m.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1.5">
      <span className="min-w-[110px] text-[12.5px] font-extrabold text-navy">{m.ten}</span>
      <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-grey-mid">
        {m.title} · {t('fromTo', {from: m.baseline ?? 0, to: m.target_value, unit: m.unit, due: m.end_date})}
      </span>
      {m.achieved_at && (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
          <Check size={11} strokeWidth={3} />
          {t('achieved')}
        </span>
      )}
      {m.status === 'sent' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
          <Clock size={11} strokeWidth={3} />
          {t('waiting')}
        </span>
      )}
      {m.set_by === 'teacher' && (
        <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
          {t('setByTeacher')}
        </span>
      )}
    </div>
  );

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[16px] font-bold text-navy">{t('wallTitle')}</h2>
        <span className="text-[11.5px] font-semibold text-grey-mid">
          {t('wallCount', {n: hocTap.length, si: siSo})}
        </span>
      </div>

      {/* HÀNG ĐỢI DUYỆT đứng trước — đây là việc cô cần làm ngay, phần còn lại chỉ để đọc. */}
      {choDuyet.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-[14px] border-[1.5px] border-gold/50 bg-gold/[0.08] p-3">
          <p className="text-[12px] font-extrabold text-navy">{t('queue', {n: choDuyet.length})}</p>
          {choDuyet.map((m) => (
            <form key={m.id} action={duyetMucTieu} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="wig_id" value={m.id} />
              <input type="hidden" name="student_id" value={m.student_id} />
              <span className="min-w-[110px] text-[12.5px] font-extrabold text-navy">{m.ten}</span>
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-grey-mid">
                {m.title} ·{' '}
                {t('fromTo', {from: m.baseline ?? 0, to: m.target_value, unit: m.unit, due: m.end_date})}
              </span>
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('approve')}
              </SubmitButton>
            </form>
          ))}
        </div>
      )}

      {/* Trận đánh của lớp — cái đích chung mà mọi mục tiêu bên dưới đang phục vụ. */}
      <div className="flex flex-col gap-1 rounded-[14px] border-[1.5px] border-navy/10 p-3">
        {wigLop.length === 0 ? (
          <p className="text-[12.5px] italic text-grey-mid">{t('noClassWig')}</p>
        ) : (
          wigLop.map((w) => (
            <p key={w.id} className="text-[13px] font-extrabold tabular-nums text-navy">
              {w.title} · {w.target_value} {w.unit}
            </p>
          ))
        )}

        <div className="mt-2 border-t border-navy/[0.08] pt-2">
          {hocTap.length === 0 ? (
            <p className="text-[12.5px] italic text-grey-mid">{t('wallEmpty')}</p>
          ) : (
            hocTap.map(theTen)
          )}
        </div>
      </div>

      {/* Chỉ số cảnh báo sớm của cả chương trình — xem ghi chú đầu tệp. */}
      {mucTieu.length > 0 && (
        <p
          className={`mt-2.5 text-[11.5px] font-bold ${tyLe >= 70 ? 'text-success-dark' : 'text-status-bad'}`}
        >
          {t('selfSetRate', {n: tyLe})}
        </p>
      )}
    </section>
  );
}
