import {getTranslations, getLocale} from 'next-intl/server';
import {Target, CalendarPlus} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {createStudentYearWigs, createStudentWeekWigs} from '@/app/[locale]/(dashboard)/student/actions';
import {AREAS, areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';

// Đơn vị mặc định: ưu tiên area_config.default_unit (admin cấu hình), fallback theo lĩnh vực.
const FALLBACK_UNIT: Record<Area, string> = {
  knowledge: 'buổi',
  skills: 'lần',
  english: 'buổi',
  physical: 'buổi',
};

// C6 — Bảng thiết lập WIG cá nhân cho GVCN/Admin (server component, dùng server action).
// - Chưa có WIG năm → form đặt mục tiêu năm 4 lĩnh vực.
// - Có WIG năm nhưng chưa có WIG tuần này → nút "Tạo WIG tuần này" 1 chạm.
export async function StudentWigSetup({
  studentId,
  classId,
  hasYear,
  hasThisWeek,
  weekLabel,
}: {
  studentId: string;
  classId: string;
  hasYear: boolean;
  hasThisWeek: boolean;
  weekLabel: string;
}) {
  const t = await getTranslations('studentWig');
  const locale = await getLocale();
  const areaMeta = await getAreaMeta();

  const input =
    'h-11 w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 text-[13px] font-bold text-navy outline-none transition-all focus:border-navy';

  return (
    <div className="glass rounded-[20px] border border-gold/30 p-4">
      <div className="flex items-center gap-2 text-[14px] font-extrabold text-navy">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/20 text-gold-deep">
          <Target size={16} strokeWidth={2.5} />
        </span>
        {t('setupTitle')}
      </div>

      {!hasYear ? (
        <form action={createStudentYearWigs} className="mt-3">
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="class_id" value={classId} />
          <p className="mb-2.5 text-[12.5px] font-semibold text-grey-mid">{t('yearIntro')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AREAS.map((a) => {
              const label = areaLabel(areaMeta[a], locale);
              return (
                <div key={a} className="rounded-[12px] bg-navy/[0.02] p-2.5">
                  <div className="mb-1.5 text-[12.5px] font-extrabold text-navy">{label}</div>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      name={`target_${a}`}
                      placeholder={t('target')}
                      className={input}
                      aria-label={`${label} — ${t('target')}`}
                    />
                    <input
                      name={`unit_${a}`}
                      defaultValue={areaMeta[a].default_unit ?? FALLBACK_UNIT[a]}
                      placeholder={t('unit')}
                      className={`${input} min-w-[112px] flex-1`}
                      aria-label={`${label} — ${t('unit')}`}
                    />
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
