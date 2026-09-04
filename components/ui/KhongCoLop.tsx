import {getTranslations} from 'next-intl/server';
import {SchoolIcon} from 'lucide-react';
import {getCurrentProfile, type Role} from '@/lib/auth';

// ════════════════════════════════════════════════════════════════════════════
// "CHƯA CÓ LỚP" — nói vì sao trống, và ai làm gì để hết trống.
// ════════════════════════════════════════════════════════════════════════════
//
// Mười trang cùng vẽ đúng ba chữ "Chưa có lớp" rồi bỏ mặc. Ba chữ ấy không phân biệt được bốn
// tình huống hoàn toàn khác nhau, và người dùng chỉ đọc ra một điều: app hỏng.
//
//   giáo viên bộ môn  chưa chủ nhiệm lớp nào — app này xếp theo LỚP CHỦ NHIỆM, nên đúng là
//                     không có gì để xem, và đó không phải lỗi của họ
//   phụ huynh         con chưa được xếp lớp, hoặc vừa nghỉ học
//   học sinh          chưa được ghi danh vào lớp nào
//   quản trị/BGH      cơ sở chưa có lớp nào đang hoạt động
//
// Câu giải thích đầy đủ ĐÃ NẰM SẴN trong file dịch từ lâu (`class.noClassDesc`) — chỉ là không
// trang nào gọi tới. Bản này gọi nó, và thêm một câu riêng cho từng vai.
export async function KhongCoLop({role}: {role: Role}) {
  const tc = await getTranslations('class');

  // HIỆU TRƯỞNG CHƯA ĐƯỢC GÁN CƠ SỞ LÀ MỘT TÌNH HUỐNG THỨ NĂM.
  //
  // Trước đây họ nhận chung câu của nhóm quản lý: "Cơ sở này chưa có lớp nào đang hoạt động.
  // Tạo lớp ở mục Quản trị rồi quay lại đây." Audit mobile 2026-08-06 chụp được câu ấy trên màn
  // Họp WIG của một hiệu trưởng, trong khi trường đang có ba lớp — câu ấy vừa sai, vừa sai cách
  // sửa: nó bảo người ta đi tạo những lớp đã tồn tại. Nguyên nhân thật là hồ sơ của họ chưa có
  // campus_id, nên mọi truy vấn theo cơ sở đều trả về rỗng.
  //
  // Hỏi lại hồ sơ ngay tại đây thay vì bắt mười trang gọi tới cùng truyền thêm một tham số:
  // getCurrentProfile đã được cache() theo request nên không tốn thêm vòng đi-về nào.
  const profile = role === 'principal' ? await getCurrentProfile() : null;
  const chuaGanCoSo = role === 'principal' && profile != null && !profile.campus_id;

  const theoVai: Partial<Record<Role, string>> = {
    teacher: tc('noClassTeacher'),
    parent: tc('noClassParent'),
    student: tc('noClassStudent'),
    principal: chuaGanCoSo ? tc('noCampusAssigned') : tc('noClassStaff'),
    admin: tc('noClassStaff'),
  };

  return (
    <div className="glass rounded-[20px] p-8 text-center">
      <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-navy/[0.06] text-navy/50">
        <SchoolIcon size={26} strokeWidth={2} />
      </span>
      <p className="font-display text-doc font-bold text-navy">{tc('noClass')}</p>
      <p className="mx-auto mt-2 max-w-[440px] text-than font-semibold leading-relaxed text-grey-mid">
        {theoVai[role] ?? tc('noClassDesc')}
      </p>
    </div>
  );
}
