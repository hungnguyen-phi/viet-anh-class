import {getLocale, getTranslations} from 'next-intl/server';
import {Users, Sparkles} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {createClassStudentWigs} from '@/app/[locale]/(dashboard)/student/actions';
import {areaLabel, type Area} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {chiaTheoSiSo, mucTieuCuaEm, type CachChia} from '@/lib/wig-ca-nhan';
import type {WigNamLop} from '@/components/student/StudentWigSetup';

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
  wigNamLop,
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
  // Mục tiêu NĂM của lớp — nguồn sinh ra mục tiêu của từng em (0099). Rỗng = lớp chưa đặt.
  wigNamLop: WigNamLop[];
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
      ) : wigNamLop.length === 0 ? (
        <p className="mt-2.5 text-[12.5px] font-semibold leading-relaxed text-navy/70">
          {t('csNeedClassYear')}
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

          {/* SINH TỪ MỤC TIÊU NĂM CỦA LỚP, không gõ tay nữa (0099).
              Bản cũ bày bốn ô số mặc định 100 cho mọi lớp, mọi lĩnh vực — con số ấy không dính
              dáng gì tới mục tiêu lớp vừa đặt, nên tầng cá nhân và tầng lớp là hai thứ rời nhau
              ngay từ lúc tạo. Nay mỗi dòng là một mục tiêu năm của lớp, chỉ chọn cách chia. */}
          <div className="flex flex-col gap-2">
            {wigNamLop.map((w) => {
              const label = areaLabel(areaMeta[w.area], locale);
              const macDinh: CachChia = chiaTheoSiSo(w.unit) ? 'chia' : 'muc';
              const soChia = mucTieuCuaEm(w.target, studentCount, 'chia');
              return (
                <div key={w.id} className="rounded-[12px] bg-navy/[0.03] p-2.5">
                  <input type="hidden" name="parent_id" value={w.id} />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12.5px] font-extrabold text-navy">{label}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-grey-mid">
                      {w.title}
                    </span>
                    <span className="text-[12px] font-bold text-navy/70">
                      {t('csClassTarget', {n: w.target, unit: w.unit})}
                    </span>
                  </div>
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
                          ? t('csRuleSame', {n: w.target, unit: w.unit})
                          : t('csRuleSplit', {n: soChia, unit: w.unit, si: studentCount})}
                      </label>
                    ))}
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
