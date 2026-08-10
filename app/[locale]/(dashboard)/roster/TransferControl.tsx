'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowRightLeft, Clock3} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field} from '@/components/ui/Field';
import {cancelTransfer, requestTransfer} from './actions';

export type LopDich = {id: string; name: string; school_year: string; campus_name: string; gvcn: string | null};
export type DeNghiDangCho = {id: string; toClassName: string};

const nutNho =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';
const inp =
  'w-full min-w-0 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';

// DỜI MỘT EM SANG LỚP KHÁC.
//
// Với quản trị viên: bấm là chuyển ngay. Với giáo viên chủ nhiệm: bấm là GỬI ĐỀ NGHỊ, và em vẫn ở
// lớp này cho tới khi lớp bên kia duyệt — nên nút và câu xác nhận phải nói đúng hai chuyện khác
// nhau ấy, không dùng chung một chữ "Chuyển" cho cả hai.
//
// FORM NẰM TRONG HỘP THOẠI, KHÔNG BUNG RA GIỮA DÒNG (09/08/2026). Bản cũ mở form ngay trong hàng
// của em ấy: ô chọn lớp cần ít nhất 180px, ô lý do 140px nữa, nên cả hàng phải giãn ra và mọi cột
// của riêng dòng đó lệch khỏi các dòng còn lại — chủ dự án thấy đúng cảnh ấy ở sổ lớp. Trong hộp
// thoại thì form muốn rộng bao nhiêu cũng được mà bảng không xê dịch một pixel.
export function TransferControl({
  classId,
  studentId,
  studentName,
  targets,
  pending,
  laAdmin,
}: {
  classId: string;
  studentId: string;
  studentName: string;
  targets: LopDich[];
  /** Đề nghị đang chờ của chính em này, nếu có. */
  pending?: DeNghiDangCho;
  laAdmin: boolean;
}) {
  const t = useTranslations('roster');
  const [mo, setMo] = useState(false);
  const [toClassId, setToClassId] = useState('');
  const dong = () => setMo(false);

  return (
    <>
      {/* Đang chờ duyệt thì nút đổi mặt: một em chỉ có một đề nghị, nên chỗ này không mời dời
          tiếp mà mời xem đề nghị đang treo. */}
      <button
        type="button"
        onClick={() => setMo(true)}
        className={nutNho}
        title={pending ? t('transferWaiting', {class: pending.toClassName}) : t('transferTitle')}
        aria-label={
          pending ? t('transferCancelFor', {name: studentName}) : t('transferSubmitFor', {name: studentName})
        }
      >
        {pending ? (
          <>
            <Clock3 size={12} strokeWidth={2.6} />
            {t('transferPendingShort')}
          </>
        ) : (
          <>
            <ArrowRightLeft size={12} strokeWidth={2.6} />
            {t('transfer')}
          </>
        )}
      </button>

      {mo && (
        <Popup
          title={`${pending ? t('transferWaiting', {class: pending.toClassName}) : t('transferTitle')} · ${studentName}`}
          onClose={dong}
          width="max-w-[460px]"
        >
          {pending ? (
            <form action={cancelTransfer} className="flex flex-wrap items-center justify-end gap-2">
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="requestId" value={pending.id} />
              <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-relaxed text-txt">
                {t('transferPendingBody', {name: studentName, class: pending.toClassName})}
              </p>
              <SubmitButton
                className={nutNho}
                wrapClass="contents"
                label={t('transferCancelFor', {name: studentName})}
              >
                {t('transferCancel')}
              </SubmitButton>
            </form>
          ) : (
            <form action={requestTransfer} className="flex flex-col gap-2.5">
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="studentId" value={studentId} />
              <Field label={t('transferTo')} htmlFor="doi-lop-dich">
                <select
                  id="doi-lop-dich"
                  name="toClassId"
                  required
                  autoFocus
                  value={toClassId}
                  onChange={(e) => setToClassId(e.target.value)}
                  aria-label={t('transferToFor', {name: studentName})}
                  className={`cursor-pointer ${inp}`}
                >
                  <option value="" disabled>
                    {t('transferPick')}
                  </option>
                  {targets
                    .filter((c) => c.id !== classId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.school_year}
                        {c.gvcn ? ` · ${c.gvcn}` : ''}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={t('transferNote')} htmlFor="doi-lop-ly-do">
                <input id="doi-lop-ly-do" name="note" className={inp} />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={dong} className={nutNho}>
                  {t('transferClose')}
                </button>
                {/* Quản trị chuyển thẳng nên phải hỏi lại: không có ai duyệt để chặn nhầm lẫn.
                    Giáo viên chỉ gửi đề nghị — chưa có gì xảy ra với em, nên không cần hỏi. */}
                {laAdmin ? (
                  <ConfirmButton
                    message={t('transferConfirmAdmin', {name: studentName})}
                    className={`${nutNho} border-navy bg-navy text-white hover:brightness-110`}
                    label={t('transferSubmitFor', {name: studentName})}
                  >
                    {t('transferMoveNow')}
                  </ConfirmButton>
                ) : (
                  <SubmitButton
                    className={`${nutNho} border-navy bg-navy text-white hover:brightness-110`}
                    wrapClass="contents"
                    label={t('transferSubmitFor', {name: studentName})}
                  >
                    {t('transferSend')}
                  </SubmitButton>
                )}
              </div>
            </form>
          )}
        </Popup>
      )}
    </>
  );
}
