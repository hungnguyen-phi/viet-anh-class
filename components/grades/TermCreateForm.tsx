import {getTranslations} from 'next-intl/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, inputCls, selectCls, btnGold} from '@/components/ui/Field';
import {TERM_KINDS, type TermKind} from '@/components/grades/labels';
import {createTerm} from '@/app/[locale]/(dashboard)/grades/actions';

/**
 * Khai báo một ĐỢT ĐÁNH GIÁ cho cơ sở — chỉ hiệu trưởng và quản trị viên thấy khối này.
 *
 * Đây không phải ngoại lệ tự đặt ra: policy rls_all_assessment_terms (0064) cho hiệu trưởng ghi
 * bảng này và nói rõ lý do — khai báo học kỳ là việc LỊCH của nhà trường, không phải dữ liệu của
 * một đứa trẻ. Hiệu trưởng vẫn không chạm được một con điểm hay một dòng nhận xét nào.
 *
 * Những loại đợt đã có trong năm học này bị loại khỏi ô chọn: bảng có ràng buộc duy nhất
 * (cơ sở, năm học, loại), để lại chỉ tổ cho người dùng bấm vào rồi nhận lỗi "bị trùng".
 */
export async function TermCreateForm({
  campusId,
  schoolYear,
  classId,
  daCo,
}: {
  campusId: string;
  schoolYear: string;
  classId: string;
  daCo: TermKind[];
}) {
  const t = await getTranslations('grades');
  const conLai = TERM_KINDS.filter((k) => !daCo.includes(k));

  if (conLai.length === 0) {
    return (
      <p className="text-chu-thich italic text-grey-mid">
        Năm học {schoolYear} đã khai báo đủ 5 đợt đánh giá cho cơ sở này.
      </p>
    );
  }

  return (
    <form action={createTerm} className="glass rounded-[16px] p-3">
      <input type="hidden" name="campus_id" value={campusId} />
      <input type="hidden" name="school_year" value={schoolYear} />
      <input type="hidden" name="class_id" value={classId} />

      <h2 className="mb-2 font-display text-noi-dung font-bold text-navy">
        Khai báo đợt đánh giá · năm học {schoolYear}
      </h2>

      {/* NÚT PHẢI ĐỨNG CÙNG HÀNG VỚI CÁC Ô NHẬP.
          Trước đây ô "Tên hiển thị" mang thêm một dòng gợi ý bên dưới, nên ô ấy cao hơn ba ô còn
          lại; nút Tạo đợt căn đáy (items-end) liền tụt xuống ngang dòng gợi ý — nhìn như bị rớt
          khỏi hàng. Dời câu gợi ý xuống chân form là bốn ô cao bằng nhau, nút về đúng hàng. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto]">
        <Field label={t('fTermKind')} htmlFor="term-kind">
          <select id="term-kind" name="kind" defaultValue={conLai[0]} className={selectCls}>
            {conLai.map((k) => (
              <option key={k} value={k}>
                {t(`termKinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fTermName')} htmlFor="term-name">
          <input id="term-name" name="name" maxLength={80} className={inputCls} />
        </Field>

        {/* <input type="date"> dùng được ở đây: cấm dùng nó cho NGÀY SINH thôi (lib/dob.ts), còn
            mốc bắt đầu/kết thúc học kỳ thì người nhập đang nhìn lịch nhà trường, không có chuyện
            hiểu nhầm 09/03 là tháng Ba hay mùng Chín. */}
        <Field label={t('fTermStart')} htmlFor="term-start">
          <input id="term-start" name="start_date" type="date" className={inputCls} />
        </Field>

        <Field label={t('fTermEnd')} htmlFor="term-end">
          <input id="term-end" name="end_date" type="date" className={inputCls} />
        </Field>

        {/* Hai cột trên màn hẹp: nút chiếm trọn dòng thay vì đứng lẻ một nửa dòng cuối. */}
        <div className="col-span-2 flex items-end sm:col-span-1">
          <SubmitButton className={`${btnGold} w-full sm:w-auto`} wrapClass="contents">
            + Tạo đợt
          </SubmitButton>
        </div>
      </div>

      <p className="mt-2 text-chu-thich italic text-grey-mid">
        {t('hTermName')} {t('termCreateHint')}
      </p>
    </form>
  );
}
