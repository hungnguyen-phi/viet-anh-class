import {SubmitButton} from '@/components/ui/SubmitButton';
import {selectInline} from '@/components/ui/Field';
import {xepLopChoHocSinh} from './actions';

// ════════════════════════════════════════════════════════════════════════════
// HỌC SINH ĐÃ CÓ TÀI KHOẢN NHƯNG CHƯA THUỘC LỚP NÀO.
// ════════════════════════════════════════════════════════════════════════════
//
// Có em tự đăng nhập từ ngoài, quản trị viên duyệt cho vai học sinh xong là em nằm im: không lớp,
// không màn nào liệt kê, không ai biết để xếp. Chủ dự án gặp đúng cảnh ấy — "tôi duyệt xong ko
// biết rơi vào đâu, ko biết quản lí hay gán lớp ở đâu".
//
// Khối này là chỗ những em ấy hiện ra. Mỗi dòng một ô chọn lớp và một nút — xếp xong em biến khỏi
// danh sách, vì danh sách chính là "những em CHƯA có lớp".
//
// KHÔNG có nút xoá tài khoản ở đây, cố ý: người lạ đăng nhập nhầm thì hạ vai trong bảng người dùng
// ở trên, đó mới là chỗ của việc ấy. Trộn hai việc vào một khối là mời người ta bấm nhầm.
export function HocSinhChuaCoLop({
  hocSinh,
  lops,
}: {
  hocSinh: {id: string; email: string; full_name: string | null}[];
  lops: {id: string; name: string; school_year: string | null}[];
}) {
  if (hocSinh.length === 0) {
    return (
      <p className="text-than font-semibold italic leading-relaxed text-grey-mid">
        Không có em nào đang lơ lửng. Em nào đăng nhập mà chưa được xếp lớp sẽ hiện ở đây.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-chu-thich font-semibold italic leading-relaxed text-grey-mid">
        Những em đã đăng nhập được nhưng chưa thuộc lớp nào. Chọn lớp rồi bấm Xếp lớp — em vào lớp
        ngay, không phải mời lại.
      </p>

      {hocSinh.map((h) => (
        <form
          key={h.id}
          action={xepLopChoHocSinh}
          className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 bg-white p-2.5"
        >
          <input type="hidden" name="email" value={h.email} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-than font-extrabold text-navy">
              {h.full_name || h.email}
            </span>
            {/* Tên hiển thị có thể là nickname Google, nên LUÔN kèm email — đó mới là thứ nhận
                diện được em nào với em nào khi hai bạn trùng tên. */}
            {h.full_name && (
              <span className="block truncate text-chu-thich font-semibold text-grey-mid">{h.email}</span>
            )}
          </span>
          <select name="class_id" aria-label={`Chọn lớp cho ${h.full_name || h.email}`} required className={`${selectInline} w-[190px]`}>
            <option value="">Chọn lớp</option>
            {lops.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.school_year ? ` · ${l.school_year}` : ''}
              </option>
            ))}
          </select>
          <SubmitButton
            className="btn-gold h-9 cursor-pointer rounded-[12px] px-3 text-than font-extrabold"
            wrapClass="contents"
          >
            Xếp lớp
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}
