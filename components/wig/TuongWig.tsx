import {getTranslations} from 'next-intl/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold} from '@/components/ui/Field';
import {duyetMucTieu} from '@/app/[locale]/(dashboard)/student/actions';
import {DanhSachDatHo, type EmTrongLop} from '@/components/wig/DanhSachDatHo';
import type {WigLop} from '@/components/student/FormMucTieu';
import {ngayVN} from '@/lib/dates';

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

export async function TuongWig({
  classId,
  wigLop,
  wigLopChon,
  danhSach,
  suaDuoc,
}: {
  classId: string;
  wigLop: {id: string; title: string; target_value: number; unit: string}[];
  /** Cùng danh sách trên, rút gọn cho ô "việc này giúp lớp ở mục tiêu nào" trong form. */
  wigLopChon: WigLop[];
  danhSach: EmTrongLop[];
  /** Chỉ quản trị/BGH mới sửa được mục tiêu của em (0133, 0134) — xem DanhSachDatHo. */
  suaDuoc: boolean;
}) {
  const t = await getTranslations('goal');

  const choDuyet = danhSach.filter((e) => e.mucTieu?.status === 'sent');

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[16px] font-bold text-navy">{t('wallTitle')}</h2>
      </div>

      {/* HÀNG ĐỢI DUYỆT đứng trước — đây là việc cô cần làm ngay, phần còn lại chỉ để đọc. */}
      {choDuyet.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-[14px] border-[1.5px] border-gold/50 bg-gold/[0.08] p-3">
          <p className="text-[12px] font-extrabold text-navy">{t('queue', {n: choDuyet.length})}</p>
          {choDuyet.map((e) => (
            <form key={e.id} action={duyetMucTieu} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="wig_id" value={e.mucTieu!.id} />
              <input type="hidden" name="student_id" value={e.id} />
              <span className="min-w-[110px] text-[12.5px] font-extrabold text-navy">{e.ten}</span>
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-grey-mid">
                {e.mucTieu!.title} ·{' '}
                {t('fromTo', {
                  from: e.mucTieu!.baseline ?? 0,
                  to: e.mucTieu!.target_value,
                  unit: e.mucTieu!.unit,
                  due: ngayVN(e.mucTieu!.end_date),
                })}
              </span>
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('approve')}
              </SubmitButton>
            </form>
          ))}
        </div>
      )}

      {/* GOM THEO TỪNG MỤC TIÊU CỦA LỚP (16/08/2026): dưới mỗi trận đánh của lớp là những em góp vào
          nó (source_wig_id); em góp vào mục tiêu riêng / chưa đặt xếp riêng ở cuối. Chủ dự án nhìn bản
          liệt kê phẳng và "ko hiểu nó thuộc về wig nào". */}
      <div className="flex flex-col gap-3">
        {wigLop.length === 0 && <p className="text-[12.5px] italic text-grey-mid">{t('noClassWig')}</p>}
        {wigLop.map((w) => {
          const cuaW = danhSach.filter((e) => e.mucTieu?.source_wig_id === w.id);
          return (
            <div key={w.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
              <p className="text-[13.5px] font-extrabold tabular-nums text-navy">
                {w.title} <span className="font-semibold text-grey-mid">· {w.target_value} {w.unit}</span>
              </p>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
                {t('contributors', {n: cuaW.length})}
              </p>
              {cuaW.length > 0 ? (
                <DanhSachDatHo classId={classId} danhSach={cuaW} wigLop={wigLopChon} suaDuoc={suaDuoc} />
              ) : (
                <p className="text-[12px] italic text-grey-mid">{t('noContributor')}</p>
              )}
            </div>
          );
        })}
        {(() => {
          const conLai = danhSach.filter((e) => !e.mucTieu || !wigLop.some((w) => w.id === e.mucTieu?.source_wig_id));
          if (conLai.length === 0) return null;
          return (
            <div className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-3">
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{t('notLinked')}</p>
              <DanhSachDatHo classId={classId} danhSach={conLai} wigLop={wigLopChon} suaDuoc={suaDuoc} />
            </div>
          );
        })()}
      </div>

    </section>
  );
}
