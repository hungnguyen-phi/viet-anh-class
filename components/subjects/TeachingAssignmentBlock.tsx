import type {ReactNode} from 'react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {btnGhost} from '@/components/ui/Field';
import {assignTeacher, seedClassSubjects, unassignTeacher} from '@/app/[locale]/(dashboard)/subjects/actions';

// Một môn TRONG CHƯƠNG TRÌNH CỦA LỚP (bảng class_subjects), kèm tên lấy từ danh mục.
export type MonCuaLop = {
  subjectId: string;
  name: string;
  isActive: boolean;
};

export type PhanCong = {
  id: string;
  subjectId: string;
  teacherId: string;
  teacherName: string;
};

export type GiaoVien = {
  id: string;
  name: string;
  // Cùng cơ sở với lớp đang xem hay không — chỉ để gom nhóm trong ô chọn, không phải kiểm quyền.
  cungCoSo: boolean;
};

// Kiểu điều khiển gọn cho hàng bảng chật — y hệt bộ đang dùng ở TeacherManager của trang Cơ sở,
// để hai màn hình quản lý nhân sự trông cùng một họ.
const selectNho =
  'h-8 min-w-0 flex-1 cursor-pointer rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2 text-[12.5px] font-semibold text-navy outline-none transition-colors focus:border-navy';
const nutNavy =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[9px] bg-navy px-2.5 text-[11.5px] font-extrabold text-white transition-all hover:bg-navy-700';

export function TeachingAssignmentBlock({
  classId,
  tenLop,
  monHoc,
  phanCong,
  giaoVien,
  picker,
}: {
  classId: string;
  tenLop: string;
  monHoc: MonCuaLop[];
  phanCong: PhanCong[];
  giaoVien: GiaoVien[];
  // Bộ chọn lớp đặt Ở ĐÂY chứ không cạnh <h1> như các trang khác: nửa trên của trang là danh
  // mục môn TOÀN TRƯỜNG, không thuộc lớp nào. Treo ô chọn lớp lên tiêu đề trang sẽ nói dối
  // người dùng rằng cả trang đang xem theo lớp.
  picker?: ReactNode;
}) {
  const theoMon = new Map<string, PhanCong[]>();
  for (const p of phanCong) {
    const arr = theoMon.get(p.subjectId) ?? [];
    arr.push(p);
    theoMon.set(p.subjectId, arr);
  }

  const trongCoSo = giaoVien.filter((g) => g.cungCoSo);
  const ngoaiCoSo = giaoVien.filter((g) => !g.cungCoSo);

  // Ô chọn giáo viên của một môn. Gom hai nhóm bằng <optgroup> thay vì lọc bỏ nhóm ngoài cơ sở:
  // policy KHÔNG cấm phân công người ở cơ sở khác (nó chỉ soi cơ sở của LỚP), nên cắt đi là tự
  // bịa thêm luật; nhưng để lẫn lộn thì rất dễ chọn nhầm người trùng tên khác cơ sở.
  const oChonGiaoVien = (m: MonCuaLop) => {
    // Người ĐANG dạy môn này thì bỏ khỏi ô chọn — chọn lại chỉ đi một vòng để nhận "đã tồn tại".
    // Người từng dạy rồi bị gỡ thì VẪN còn trong danh sách: chọn lại là bật lại dòng cũ.
    const daCo = new Set((theoMon.get(m.subjectId) ?? []).map((p) => p.teacherId));
    const nhomTrong = trongCoSo.filter((g) => !daCo.has(g.id));
    const nhomNgoai = ngoaiCoSo.filter((g) => !daCo.has(g.id));
    if (nhomTrong.length + nhomNgoai.length === 0)
      return (
        <span className="text-[11.5px] font-semibold text-grey-mid">
          Mọi giáo viên đều đã được phân công môn này
        </span>
      );

    return (
      <form action={assignTeacher} className="flex w-full items-center gap-1.5">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="subject_id" value={m.subjectId} />
        <select
          name="teacher_id"
          aria-label={`Chọn giáo viên dạy ${m.name} ở lớp ${tenLop}`}
          defaultValue=""
          className={selectNho}
        >
          <option value="">— chọn giáo viên —</option>
          {nhomTrong.length > 0 && (
            <optgroup label="Giáo viên của cơ sở này">
              {nhomTrong.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
          {nhomNgoai.length > 0 && (
            <optgroup label="Cơ sở khác / chưa gán cơ sở">
              {nhomNgoai.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <SubmitButton className={nutNavy} wrapClass="contents">
          + Thêm
        </SubmitButton>
      </form>
    );
  };

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold text-navy">
          Phân công giáo viên bộ môn · {tenLop}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {picker}
          {/* Gieo cả bộ môn chuẩn: RPC seed_class_subjects, gọi lại bao nhiêu lần cũng an toàn.
              Để nút này ở đây (không chỉ trong trạng thái rỗng) vì lớp đã có vài môn từ thời khoá
              biểu vẫn thiếu phần lớn danh mục — bắt bấm tay 14 lần thì không ai làm. */}
          <form action={seedClassSubjects}>
            <input type="hidden" name="class_id" value={classId} />
            <SubmitButton className={btnGhost} wrapClass="contents">
              Bổ sung môn chuẩn cho lớp
            </SubmitButton>
          </form>
        </div>
      </div>

      {monHoc.length === 0 ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm font-semibold text-txt">
            Lớp {tenLop} chưa khai môn nào, nên chưa phân công được ai.
          </p>
          <p className="mx-auto mt-1 max-w-[560px] text-[12.5px] text-grey-mid">
            Bấm “Bổ sung môn chuẩn cho lớp” ở trên: hệ thống thêm một lượt toàn bộ môn đang dùng
            của cơ sở này vào chương trình của lớp. Sau đó mới chọn được ai dạy môn nào.
          </p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-[20px]">
          {/* Header */}
          <div className="flex min-w-[900px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
            <span className="w-[22px] flex-none text-[11px] font-extrabold text-grey-mid">#</span>
            <span className="flex-[1.2] text-[11px] font-extrabold uppercase text-grey-mid">Môn</span>
            <span className="flex-[2] text-[11px] font-extrabold uppercase text-grey-mid">
              Giáo viên đang dạy
            </span>
            <span className="w-[290px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
              Thêm giáo viên
            </span>
          </div>

          {monHoc.map((m, i) => {
            const ds = theoMon.get(m.subjectId) ?? [];
            return (
              <div
                key={m.subjectId}
                className="flex min-w-[900px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
              >
                <span className="w-[22px] flex-none text-[12px] font-bold text-grey-mid">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-[1.2] items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-bold text-navy">{m.name}</span>
                  {!m.isActive && (
                    <span className="shrink-0 rounded-full bg-status-bad/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                      môn đã tắt
                    </span>
                  )}
                </span>

                <span className="flex min-w-0 flex-[2] flex-wrap items-center gap-1.5">
                  {ds.length === 0 && (
                    <span className="text-[12.5px] font-semibold text-grey-mid">
                      chưa có ai — điểm môn này chưa ai nhập được
                    </span>
                  )}
                  {ds.map((p) => (
                    // Mỗi giáo viên một chip kèm nút gỡ ngay cạnh tên: một môn có thể có nhiều
                    // người dạy (dạy đôi, tách nhóm, dạy thay giữa kỳ) nên không gộp thành một ô.
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[11.5px] font-extrabold text-navy"
                    >
                      {p.teacherName}
                      <form action={unassignTeacher} className="contents">
                        <input type="hidden" name="assignment_id" value={p.id} />
                        <input type="hidden" name="class_id" value={classId} />
                        <ConfirmButton
                          message={`Gỡ ${p.teacherName} khỏi môn ${m.name} của lớp ${tenLop}?\n\nNgay sau khi gỡ, giáo viên này KHÔNG nhập hay sửa được điểm môn ${m.name} của lớp nữa. Điểm đã nhập vẫn giữ nguyên, và bản ghi phân công vẫn được lưu để tra lại ai từng dạy.`}
                          className="grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-[10px] font-extrabold leading-none text-status-bad transition-all hover:bg-status-bad/[0.16]"
                        >
                          ✕
                        </ConfirmButton>
                      </form>
                    </span>
                  ))}
                </span>

                <span className="flex w-[290px] flex-none items-center">
                  {/* Môn đã tắt thì không thêm được: trigger teaching_assignment_guard gọi
                      subject_fits_class, hàm này đòi s.is_active. Không vẽ ô chọn còn hơn để
                      người dùng bấm rồi nhận lỗi. */}
                  {m.isActive && giaoVien.length > 0 && oChonGiaoVien(m)}
                  {m.isActive && giaoVien.length === 0 && (
                    <span className="text-[11.5px] font-semibold text-grey-mid">
                      Chưa có tài khoản giáo viên nào để chọn
                    </span>
                  )}
                  {!m.isActive && (
                    <span className="text-[11.5px] font-semibold text-grey-mid">
                      Bật lại môn ở bảng trên rồi mới phân công được
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hậu quả của nút ✕ nói ngay dưới bảng, không giấu trong hộp xác nhận: người bấm phải
          hiểu đây là thao tác CẤP/THU QUYỀN, không phải sửa một dòng danh sách. */}
      <p className="text-[11px] italic text-grey-mid">
        Thêm một giáo viên vào đây là CẤP QUYỀN nhập điểm môn đó cho lớp này, có hiệu lực ngay.
        Bấm ✕ là gỡ: giáo viên đó mất quyền nhập và sửa điểm môn đó ngay lập tức. Bản ghi không bị
        xoá — vẫn tra lại được ai từng dạy môn nào ở lớp nào.
      </p>
    </section>
  );
}
