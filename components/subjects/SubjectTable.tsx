import {Link} from '@/i18n/navigation';
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

// "6,7,8,9,10,11,12" → "lớp 6–12"; "9,10,11,12 và 6,7" → "lớp 6–7, 9–12".
// Vì sao gom dải: cột này đứng cạnh 13 dòng khác, liệt kê đủ 7 số làm dòng vỡ và mắt phải tự
// cộng trừ mới biết môn dạy tới lớp mấy.
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
  return `lớp ${doan.join(', ')}`;
}

const chipXam = 'rounded-full bg-navy/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold text-navy/70';

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
  // Giữ ?class= qua mọi đường dẫn của trang: khối phân công bên dưới sống bằng tham số đó.
  const keo = classParam ? `&class=${encodeURIComponent(classParam)}` : '';
  const veDanhSach = classParam ? `/subjects?class=${encodeURIComponent(classParam)}` : '/subjects';
  const editing = editingId ? rows.find((r) => r.id === editingId) : undefined;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Panel sửa "môn này dạy lớp mấy" — hiện khi ?edit=<id>, server-rendered như panel sửa
          WIG (không cần client state cho 12 ô tick). */}
      {isAdmin && editing && (
        <section className="glass animate-rise rounded-[20px] p-[18px] ring-2 ring-gold/60">
          <div className="mb-2.5 font-display text-[15px] font-bold text-navy">
            {editing.name} · dạy những lớp nào
          </div>
          <form action={saveSubjectGrades} className="flex flex-col gap-3">
            <input type="hidden" name="subject_id" value={editing.id} />
            {classParam && <input type="hidden" name="class_id" value={classParam} />}
            <fieldset className="min-w-0">
              <legend className={labelCls}>Chọn lớp học môn này</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {LOP.map((n) => (
                  <label
                    key={n}
                    className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-[12.5px] font-bold text-navy transition-colors hover:border-navy"
                  >
                    <input
                      type="checkbox"
                      name="grade"
                      value={n}
                      defaultChecked={editing.grades.includes(n)}
                      className="h-4 w-4 accent-navy"
                    />
                    Lớp {n}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[11px] italic text-grey-mid">
              Không tick ô nào = CHƯA KHAI, và môn chưa khai thì chọn được cho MỌI lớp. Đó là cách
              hệ thống tránh chặn nhầm, không phải lỗi — nhưng nên khai đúng để ô chọn môn của
              từng lớp gọn lại.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Link href={veDanhSach} className={btnGhost}>
                Huỷ
              </Link>
              <SubmitButton className={btnGold}>Lưu lớp của môn</SubmitButton>
            </div>
          </form>
        </section>
      )}

      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header */}
        <div className="flex min-w-[980px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
          <span className="w-[22px] flex-none text-[11px] font-extrabold text-grey-mid">#</span>
          <span className="w-[86px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
            Mã
          </span>
          <span className="flex-[1.6] text-[11px] font-extrabold uppercase text-grey-mid">
            Tên môn
          </span>
          <span className="w-[96px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
            Mã ngắn
          </span>
          <span className="flex-[1.6] text-[11px] font-extrabold uppercase text-grey-mid">
            Lớp nào học
          </span>
          <span className="w-[92px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
            Trạng thái
          </span>
          <span className="w-[160px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid" />
        </div>

        {/* Rows */}
        {rows.map((s, i) => (
          <div
            key={s.id}
            className={`flex min-w-[980px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03] ${
              s.is_active ? '' : 'opacity-70'
            }`}
          >
            <span className="w-[22px] flex-none text-[12px] font-bold text-grey-mid">{i + 1}</span>
            <span className="w-[86px] flex-none truncate text-[12.5px] font-bold text-navy/70">
              {s.code}
            </span>
            <span className="flex min-w-0 flex-[1.6] items-center gap-1.5">
              <span className="truncate text-[13.5px] font-bold text-navy">{s.name}</span>
              {/* Môn riêng của cơ sở: phải nhìn ra ngay, vì chỉ lớp của cơ sở đó chọn được. */}
              {s.campus_id && (
                <span className={`${chipXam} shrink-0`} title="Môn riêng của một cơ sở">
                  riêng{s.campusName ? ` · ${s.campusName}` : ''}
                </span>
              )}
              {!s.is_scored && (
                <span
                  className={`${chipXam} shrink-0`}
                  title="Môn đánh giá bằng nhận xét, không bằng điểm số"
                >
                  nhận xét
                </span>
              )}
            </span>
            <span className="w-[96px] flex-none truncate text-[12.5px] font-semibold text-grey-mid">
              {s.short_name}
            </span>
            <span className="min-w-0 flex-[1.6] text-[12.5px] font-semibold text-grey-mid">
              {s.grades.length > 0 ? (
                moTaLop(s.grades)
              ) : (
                // KHÔNG ẩn cho gọn: bốn môn đang ở tình trạng này và nhà trường CẦN thấy để bổ
                // sung. Chưa khai = chọn được cho mọi lớp, tức là ô chọn môn của lớp 6 vẫn hiện
                // "Giáo dục kinh tế và pháp luật" — dễ nhập nhầm.
                <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-warn/40 bg-warn/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-warn">
                  ⚠ chưa khai lớp · chọn được cho mọi lớp
                </span>
              )}
            </span>
            <span className="w-[92px] flex-none">
              {s.is_active ? (
                <span className="rounded-full bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                  đang dùng
                </span>
              ) : (
                <span className="rounded-full bg-status-bad/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                  đã tắt
                </span>
              )}
            </span>
            <span className="flex w-[160px] flex-none items-center justify-end gap-1.5">
              {isAdmin && (
                <Link
                  href={`/subjects?edit=${encodeURIComponent(s.id)}${keo}`}
                  className="cursor-pointer rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-[11px] font-extrabold text-navy transition-all hover:border-navy"
                >
                  Sửa lớp
                </Link>
              )}
              {s.canEdit &&
                (s.is_active ? (
                  <form action={setSubjectActive}>
                    <input type="hidden" name="subject_id" value={s.id} />
                    <input type="hidden" name="active" value="false" />
                    {classParam && <input type="hidden" name="class_id" value={classParam} />}
                    <ConfirmButton
                      message={`Tắt môn "${s.name}"? Môn sẽ biến khỏi mọi ô chọn từ giờ. Điểm cũ vẫn giữ nguyên và vẫn đọc được.`}
                      className="cursor-pointer rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-2 py-1 text-[11px] font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.16]"
                    >
                      Tắt
                    </ConfirmButton>
                  </form>
                ) : (
                  <form action={setSubjectActive}>
                    <input type="hidden" name="subject_id" value={s.id} />
                    <input type="hidden" name="active" value="true" />
                    {classParam && <input type="hidden" name="class_id" value={classParam} />}
                    <SubmitButton
                      className="cursor-pointer rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-[11px] font-extrabold text-navy transition-all hover:border-navy"
                      wrapClass="contents"
                    >
                      Dùng lại
                    </SubmitButton>
                  </form>
                ))}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="border-t border-navy/[0.08] px-[18px] py-8 text-center text-sm text-grey-mid">
            Danh mục môn đang trống.
          </div>
        )}
      </div>

      {/* Nói thẳng vì sao không có nút xoá — nếu không, người dùng sẽ đi tìm và tưởng thiếu tính năng. */}
      <p className="text-[11px] italic text-grey-mid">
        Không xoá môn, chỉ TẮT. Mỗi con điểm đã nhập đều trỏ về một môn trong danh mục này: xoá môn
        là làm hỏng học bạ cũ, còn tắt thì môn biến khỏi các ô chọn mà điểm cũ vẫn đọc được nguyên
        vẹn.
        {!isAdmin &&
          ' Môn dùng chung của cả trường và danh sách lớp của từng môn do quản trị viên giữ — bạn sửa được môn riêng của cơ sở mình.'}
      </p>
    </div>
  );
}
