import {getTranslations, getLocale} from 'next-intl/server';
import {Target, CalendarPlus, ArrowRight} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {createStudentYearWigs, createStudentWeekWigs} from '@/app/[locale]/(dashboard)/student/actions';
import {areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {chiaTheoSiSo, mucTieuCuaEm, type CachChia} from '@/lib/wig-ca-nhan';

// Một mục tiêu NĂM của lớp — nguồn sinh ra mục tiêu năm của từng em.
export type WigNamLop = {
  id: string;
  area: Area;
  title: string;
  target: number;
  unit: string;
};

// C6 — Bảng thiết lập WIG cá nhân cho GVCN/Admin (server component, dùng server action).
// - Chưa có WIG năm → SINH TỪ WIG NĂM CỦA LỚP, mỗi lĩnh vực một dòng.
// - Có WIG năm nhưng chưa có WIG tuần này → nút "Tạo WIG tuần này" 1 chạm.
//
// VÌ SAO KHÔNG CÒN Ô TRỐNG ĐỂ GÕ TAY (10/08/2026):
// 4DX là hình tháp — WIG của lớp đẻ ra WIG của em, em là một phần của lớp. Bản cũ bày bốn ô số
// trống và để giáo viên tự nhẩm ra con số từ mục tiêu lớp; nhẩm ba mươi lần cho ba mươi em thì
// sai một lần là hai tầng trôi khỏi nhau, mà không màn hình nào đối chiếu giúp. Nay máy suy ra,
// giáo viên chỉ chọn cách chia và soát lại con số.
export async function StudentWigSetup({
  studentId,
  classId,
  hasYear,
  hasThisWeek,
  weekLabel,
  wigNamLop,
  siSo,
  duongToiWigLop,
}: {
  studentId: string;
  classId: string;
  hasYear: boolean;
  hasThisWeek: boolean;
  weekLabel: string;
  /** Mục tiêu năm của LỚP — nguồn để suy ra mục tiêu của em. */
  wigNamLop: WigNamLop[];
  siSo: number;
  /** Đường sang trang WIG của lớp, để đặt mục tiêu năm khi lớp chưa có. */
  duongToiWigLop: {pathname: '/wig'; query: Record<string, string>};
}) {
  const t = await getTranslations('studentWig');
  const locale = await getLocale();
  const areaMeta = await getAreaMeta();

  return (
    <div className="glass rounded-[20px] border border-gold/30 p-4">
      <div className="flex items-center gap-2 text-[14px] font-extrabold text-navy">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/20 text-gold-deep">
          <Target size={16} strokeWidth={2.5} />
        </span>
        {t('setupTitle')}
      </div>

      {!hasYear ? (
        wigNamLop.length === 0 ? (
          /* Lớp chưa có mục tiêu năm thì chưa có gì để chia xuống cho em. Nói thẳng và chỉ đường,
             thay vì bày một cái form rỗng. */
          <div className="mt-3">
            <p className="text-[12.5px] font-semibold leading-relaxed text-txt">{t('needClassYear')}</p>
            <Link
              href={duongToiWigLop}
              className="mt-1.5 inline-flex min-h-[24px] items-center gap-1 text-[12.5px] font-extrabold text-navy underline underline-offset-2"
            >
              {t('goSetClassYear')}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        ) : (
          <form action={createStudentYearWigs} className="mt-3">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="class_id" value={classId} />
            <p className="mb-2.5 text-[12.5px] font-semibold leading-relaxed text-grey-mid">
              {t('yearFromClass', {n: siSo})}
            </p>

            <div className="flex flex-col gap-2">
              {wigNamLop.map((w) => {
                const nhan = areaLabel(areaMeta[w.area], locale);
                // Đoán sẵn cách chia theo ĐƠN VỊ, rồi để giáo viên sửa: "điểm" là mức mỗi em phải
                // đạt (lớp 8.0 thì em cũng 8.0), còn "bài/buổi/lần" là khối lượng chia đều.
                const macDinh: CachChia = chiaTheoSiSo(w.unit) ? 'chia' : 'muc';
                const soChia = mucTieuCuaEm(w.target, siSo, 'chia');
                return (
                  <div key={w.id} className="rounded-[12px] bg-navy/[0.02] p-2.5">
                    <input type="hidden" name="parent_id" value={w.id} />
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[12.5px] font-extrabold text-navy">{nhan}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-grey-mid">
                        {w.title}
                      </span>
                      <span className="text-[12px] font-bold text-navy/70">
                        {t('classTarget', {n: w.target, unit: w.unit})}
                      </span>
                    </div>

                    {/* Hai cách chia, và con số suy ra hiện ngay trên nhãn — giáo viên soát bằng
                        mắt trước khi bấm, không phải lưu xong mới biết máy hiểu thế nào. */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(['muc', 'chia'] as const).map((cach) => (
                        <label
                          key={cach}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-navy transition-all has-[:checked]:border-navy has-[:checked]:bg-navy/[0.06]"
                        >
                          <input
                            type="radio"
                            name={`cach_${w.id}`}
                            value={cach}
                            defaultChecked={macDinh === cach}
                            className="accent-navy"
                          />
                          {cach === 'muc'
                            ? t('ruleSame', {n: w.target, unit: w.unit})
                            : t('ruleSplit', {n: soChia, unit: w.unit, si: siSo})}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <SubmitButton className="btn-gold mt-3 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-[12px] px-4 font-display text-[13.5px] font-black">
              <Target size={15} strokeWidth={2.5} />
              {t('createYear')}
            </SubmitButton>
          </form>
        )
      ) : hasThisWeek ? (
        <p className="mt-2 text-[12.5px] font-semibold text-success-dark">{t('weekDone', {label: weekLabel})}</p>
      ) : (
        <form action={createStudentWeekWigs} className="mt-3">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          <p className="mb-2.5 text-[12.5px] font-semibold text-grey-mid">{t('weekHint')}</p>
          <SubmitButton className="btn-gold inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-[12px] px-4 font-display text-[13.5px] font-black">
            <CalendarPlus size={15} strokeWidth={2.5} />
            {t('createWeek')}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
