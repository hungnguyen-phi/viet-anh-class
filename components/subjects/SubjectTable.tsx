import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {Pencil, Power, RotateCcw, AlertTriangle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {labelCls, btnGold, btnGhost} from '@/components/ui/Field';
import {saveSubjectGrades, setSubjectActive} from '@/app/[locale]/(dashboard)/subjects/actions';

export type SubjectRow = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  campus_id: string | null;
  campusName: string | null;
  is_active: boolean;
  is_scored: boolean;
  // Số lớp lấy từ subject_grades. MẢNG RỖNG CÓ NGHĨA: "chưa khai" — xem moTaLop().
  grades: number[];
  // Người đang xem có sửa được chính dòng này không (tính theo policy, xem page.tsx).
  canEdit: boolean;
};

const LOP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// "6,7,8,9,10,11,12" → "6–12"; "9,10,11,12 và 6,7" → "6–7, 9–12".
// Vì sao gom dải: cột này đứng cạnh 13 dòng khác, liệt kê đủ 7 số làm dòng vỡ và mắt phải tự
// cộng trừ mới biết môn dạy tới lớp mấy.
//
// Chỉ trả về DÃY SỐ, không kèm chữ "lớp" — chữ đó nằm ở khoá dịch `gradesRange` để bản tiếng Anh
// đặt được nó đúng chỗ ("grades 6–12"), thay vì ghép cứng tiếng Việt vào giữa hàm tính toán.
export function moTaLop(nums: number[]): string {
  const xs = [...new Set(nums)].sort((a, b) => a - b);
  const doan: string[] = [];
  let i = 0;
  while (i < xs.length) {
    let j = i;
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++;
    doan.push(j > i ? `${xs[i]}–${xs[j]}` : `${xs[i]}`);
    i = j + 1;
  }
  return doan.join(', ');
}

const chipXam = 'rounded-full bg-navy/[0.08] px-2 py-0.5 text-nhan font-extrabold text-navy/70';
const nutIcon =
  'grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[12px] text-navy transition-colors hover:bg-navy/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold';

// DANH MỤC MÔN — sắp lại 05/09 (chủ dự án: "nhìn rối quá"). Trước: bảng 7 cột rộng 980 px, 14 dòng
// đều lặp "đang dùng · Sửa lớp · Tắt", điện thoại phải cuộn ngang. Nay MỖI MÔN MỘT DÒNG BA PHẦN:
//   tên (mã · mã ngắn ở dòng phụ) · lớp nào học (một chip) · hai nút biểu tượng.
// Trạng thái chỉ hiện khi KHÁC thường (đã tắt → dòng mờ + chip đỏ); "đang dùng" là mặc định, khỏi nói.
// Điện thoại: cùng dòng ấy xếp dọc, không cuộn ngang.
export function SubjectTable({
  rows,
  isAdmin,
  classParam,
  editingId,
}: {
  rows: SubjectRow[];
  // Chỉ quản trị viên GHI được subject_grades (policy rls_admin_subject_grades là policy ghi
  // DUY NHẤT của bảng đó). Hiệu trưởng không thấy nút "Sửa lớp" — vẽ nút bấm không được còn
  // tệ hơn không vẽ.
  isAdmin: boolean;
  classParam?: string;
  editingId?: string;
}) {
  const t = useTranslations('subjects');
  const tCommon = useTranslations('common');
  // Giữ ?class= qua mọi đường dẫn của trang: khối phân công bên dưới sống bằng tham số đó.
  const keo = classParam ? `&class=${encodeURIComponent(classParam)}` : '';
  const veDanhSach = classParam ? `/subjects?class=${encodeURIComponent(classParam)}` : '/subjects';
  const editing = editingId ? rows.find((r) => r.id === editingId) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Panel sửa "môn này dạy lớp mấy" — hiện khi ?edit=<id>, server-rendered như panel sửa
          WIG (không cần client state cho 12 ô tick). */}
      {isAdmin && editing && (
        <section className="glass animate-rise rounded-[20px] p-[18px] ring-2 ring-gold/60">
          <h3 className="mb-2.5 font-display text-noi-dung font-bold text-navy">
            {t('editPanelTitle', {name: editing.name})}
          </h3>
          <form action={saveSubjectGrades} className="flex flex-col gap-3">
            <input type="hidden" name="subject_id" value={editing.id} />
            {classParam && <input type="hidden" name="class_id" value={classParam} />}
            <fieldset className="min-w-0">
              <legend className={labelCls}>{t('pickGrades')}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {LOP.map((n) => (
                  <label
                    key={n}
                    className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-than font-bold text-navy transition-colors hover:border-navy"
                  >
                    <input
                      type="checkbox"
                      name="grade"
                      value={n}
                      defaultChecked={editing.grades.includes(n)}
                      className="h-4 w-4 accent-navy"
                    />
                    {t('gradeN', {n})}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-chu-thich italic text-grey-mid">{t('gradesHint')}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href={veDanhSach} className={btnGhost}>
                {tCommon('cancel')}
              </Link>
              <SubmitButton className={btnGold}>{t('saveGrades')}</SubmitButton>
            </div>
          </form>
        </section>
      )}

      <div className="glass overflow-hidden rounded-[20px]">
        {/* Đầu bảng — chỉ ở màn rộng; điện thoại mỗi dòng tự nói tên cột bằng bố cục. */}
        <div className="hidden items-center gap-3 bg-navy/[0.03] px-[18px] py-2 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_112px]">
          <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{t('thName')}</span>
          <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{t('thGrades')}</span>
          <span />
        </div>

        {rows.map((s, i) => (
          <div
            key={s.id}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-navy/[0.03] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_112px] ${
              s.is_active ? '' : 'opacity-60'
            }`}
          >
            {/* Tên môn + dòng phụ mã · mã ngắn (hai cột riêng trước đây chỉ để lặp lại tên). */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="truncate text-noi-dung font-bold text-navy">{s.name}</span>
                {s.campus_id && (
                  <span className={chipXam} title={t('chipOwnTitle')}>
                    {t('chipOwn')}
                    {s.campusName ? ` · ${s.campusName}` : ''}
                  </span>
                )}
                {!s.is_scored && (
                  <span className={chipXam} title={t('chipReviewTitle')}>
                    {t('chipReview')}
                  </span>
                )}
                {!s.is_active && (
                  <span className="rounded-full bg-status-bad/[0.08] px-2 py-0.5 text-nhan font-extrabold text-status-bad">
                    {t('statusOff')}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-chu-thich font-semibold tabular-nums text-grey-mid">
                {i + 1} · {s.code} · {s.short_name}
              </div>
            </div>

            {/* Nút: hàng đầu bên phải ở điện thoại, cột cuối ở màn rộng. */}
            <div className="flex items-center justify-end gap-0.5 sm:order-3">
              {isAdmin && (
                <Link
                  href={`/subjects?edit=${encodeURIComponent(s.id)}${keo}`}
                  aria-label={t('editGrades')}
                  title={t('editGrades')}
                  className={nutIcon}
                >
                  <Pencil size={15} strokeWidth={2.5} />
                </Link>
              )}
              {s.canEdit &&
                (s.is_active ? (
                  <form action={setSubjectActive}>
                    <input type="hidden" name="subject_id" value={s.id} />
                    <input type="hidden" name="active" value="false" />
                    {classParam && <input type="hidden" name="class_id" value={classParam} />}
                    <ConfirmButton
                      message={t('confirmOff', {name: s.name})}
                      label={`${t('turnOff')} · ${s.name}`}
                      className={`${nutIcon} text-status-bad hover:bg-status-bad/[0.08]`}
                    >
                      <Power size={15} strokeWidth={2.5} />
                    </ConfirmButton>
                  </form>
                ) : (
                  <form action={setSubjectActive}>
                    <input type="hidden" name="subject_id" value={s.id} />
                    <input type="hidden" name="active" value="true" />
                    {classParam && <input type="hidden" name="class_id" value={classParam} />}
                    <SubmitButton
                      label={`${t('reuse')} · ${s.name}`}
                      className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-[12px] border-[1.5px] border-navy/20 bg-white px-2.5 text-chu-thich font-extrabold text-navy transition-all hover:border-navy"
                      wrapClass="inline-flex items-center gap-1"
                    >
                      <RotateCcw size={13} strokeWidth={2.5} />
                      {t('reuse')}
                    </SubmitButton>
                  </form>
                ))}
            </div>

            {/* Lớp nào học: một chip; chưa khai → chip cảnh báo ngắn. */}
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:order-2">
              {s.grades.length > 0 ? (
                <span className="inline-flex rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-chu-thich font-extrabold tabular-nums text-navy">
                  {t('gradesRange', {list: moTaLop(s.grades)})}
                </span>
              ) : (
                // KHÔNG ẩn cho gọn: nhà trường CẦN thấy để bổ sung. Chưa khai = chọn được cho mọi
                // lớp, tức là ô chọn môn của lớp 6 vẫn hiện "Giáo dục kinh tế và pháp luật".
                <span
                  title={t('gradesUndeclaredTitle')}
                  className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-warn/40 bg-warn/[0.12] px-2 py-0.5 text-chu-thich font-extrabold text-warn-text"
                >
                  <AlertTriangle size={12} strokeWidth={2.5} />
                  {t('gradesUndeclared')}
                </span>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="border-t border-navy/[0.08] px-[18px] py-8 text-center text-sm text-grey-mid">
            {t('emptyList')}
          </div>
        )}
      </div>

      {/* Nói thẳng vì sao không có nút xoá — nếu không, người dùng sẽ đi tìm và tưởng thiếu tính năng. */}
      <p className="text-chu-thich italic text-grey-mid">
        {t('noDeleteHint')}
        {!isAdmin && t('noDeleteHintPrincipal')}
      </p>
    </div>
  );
}
