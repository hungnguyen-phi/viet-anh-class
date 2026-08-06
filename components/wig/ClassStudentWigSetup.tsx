import {getLocale, getTranslations} from 'next-intl/server';
import {Users, Sparkles} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {createClassStudentWigs} from '@/app/[locale]/(dashboard)/student/actions';
import {AREAS, areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';

// Đơn vị mặc định khi admin chưa cấu hình area_config — khớp với StudentWigSetup (từng em).
const FALLBACK_UNIT: Record<Area, string> = {
  knowledge: 'buổi',
  skills: 'lần',
  english: 'buổi',
  physical: 'buổi',
};

// Tạo WIG CÁ NHÂN cho CẢ LỚP — đặt trên trang WIG, nơi giáo viên thật sự làm việc.
//
// Vì sao khối này tồn tại: màn hình học sinh chỉ có việc để tick khi em đó có WIG cá nhân của
// đúng tuần này. Trước đây thứ duy nhất tạo ra chúng nằm trong trang chi tiết TỪNG em, phải mở
// từng người một — nên trên thực tế không ai tạo, và cả ba người thử đều báo "không tick được,
// không thấy gì để làm". Đưa ra đây thì một lần bấm là cả lớp có việc.
export async function ClassStudentWigSetup({
  classId,
  weekLabel,
  weekStart,
  laTuanNay,
  studentCount,
  readyCount,
}: {
  classId: string;
  weekLabel: string;
  // Thứ Hai của tuần đang xem, và tuần đó có phải tuần hiện tại không.
  //
  // Phải truyền xuống vì con số "x/y em đã có việc" ở đây đếm theo tuần ĐANG XEM. Nếu cái nút
  // bên dưới vẫn tạo cho tuần HIỆN TẠI như trước thì con số và hành động nói hai chuyện khác
  // nhau — đúng kiểu lệch tuần đã khiến GVCN hiểu nhầm.
  weekStart: string;
  laTuanNay: boolean;
  // Sĩ số đang học và số em ĐÃ có WIG cá nhân của tuần đang xem — để nói thẳng còn thiếu bao nhiêu.
  studentCount: number;
  readyCount: number;
}) {
  const locale = await getLocale();
  // Cả khối này trước đây viết tiếng Việt gõ thẳng vào JSX — mười một chuỗi, kể cả nhãn nút và
  // tên đọc được của ô nhập. Nghĩa là giáo viên đổi sang tiếng Anh vẫn thấy nguyên một thẻ tiếng
  // Việt giữa màn WIG. Bộ kiểm khoá dịch không thấy vì nó chỉ soi những khoá ĐƯỢC GỌI.
  const t = await getTranslations('wig');
  const areaMeta = await getAreaMeta();

  const input =
    'h-11 w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 text-[13px] font-bold text-navy outline-none transition-all focus:border-navy';
  const missing = Math.max(0, studentCount - readyCount);

  return (
    <section className="glass rounded-[20px] border border-gold/30 p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold/20 text-gold-deep">
          <Users size={16} strokeWidth={2.5} />
        </span>
        <span className="font-display text-[15px] font-bold text-navy">
          {t('csTitle', {week: weekLabel})}
        </span>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${
            missing === 0 ? 'bg-success/15 text-success-dark' : 'bg-gold/25 text-gold-text'
          }`}
        >
          {t('csReady', {ready: readyCount, total: studentCount})}
        </span>
      </div>

      {studentCount === 0 ? (
        <p className="mt-2.5 text-[12.5px] font-semibold text-navy/70">{t('csNoStudents')}</p>
      ) : missing === 0 ? (
        <p className="mt-2.5 text-[12.5px] font-semibold text-success-dark">
          {t('csAllSet', {week: weekLabel})}{' '}
          {/* Chỉ hứa "các em vào là thấy" khi đó ĐÚNG là tuần này. Màn hình học sinh luôn cắt theo
              tuần lịch hiện tại, nên câu ấy đặt ở tuần khác là nói sai — và đó chính là kiểu sai
              đã khiến GVCN tin lớp đang có việc trong khi máy các em trống trơn. */}
          {laTuanNay ? t('csAllSetNow') : t('csAllSetOther')}
        </p>
      ) : (
        <form action={createClassStudentWigs} className="mt-3">
          <input type="hidden" name="class_id" value={classId} />
          {/* Tuần đang xem đi kèm form: server action tạo WIG cho ĐÚNG tuần này, không phải tuần
              chứa hôm nay. Xem createClassStudentWigs trong student/actions.ts. */}
          <input type="hidden" name="week_start" value={weekStart} />
          <p className="mb-2.5 text-[12.5px] font-semibold leading-[1.6] text-navy/70">
            {/* t.rich để giữ được hai cụm in đậm (số em còn thiếu và tên tuần) — đó là hai thông
                tin người đọc cần bắt ngay, không nên tan vào một khối chữ phẳng. */}
            {t.rich('csMissing', {
              n: missing,
              week: weekLabel,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AREAS.map((a) => {
              const label = areaLabel(areaMeta[a], locale);
              return (
                <div key={a} className="rounded-[12px] bg-navy/[0.03] p-2.5">
                  <div className="mb-1.5 text-[12.5px] font-extrabold text-navy">{label}</div>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      defaultValue={100}
                      name={`target_${a}`}
                      className={input}
                      aria-label={t('csYearTargetFor', {area: label})}
                    />
                    <input
                      name={`unit_${a}`}
                      defaultValue={areaMeta[a].default_unit ?? FALLBACK_UNIT[a]}
                      className={`${input} min-w-[104px] flex-1`}
                      aria-label={t('csUnitFor', {area: label})}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-navy/70">
                {t('csWeekTarget')}
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                name="week_target"
                defaultValue={5}
                className={`${input} w-[120px]`}
              />
            </label>
            <SubmitButton className="btn-gold inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-[12px] px-4 font-display text-[13.5px] font-black">
              <Sparkles size={15} strokeWidth={2.5} />
              {t('csCreate', {week: weekLabel})}
            </SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
