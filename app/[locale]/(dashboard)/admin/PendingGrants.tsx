import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {layDanhMuc, layPhuTro} from './admin-data';
import {Disclosure} from './Disclosure';
import {GrantsPanel} from './GrantsPanel';

// ĐÃ KHAI SẴN — CHỜ ĐĂNG NHẬP LẦN ĐẦU.
//
// Đây là danh sách những email đã được gán trước vai trò (và lớp, nếu có), nằm chờ trong
// pending_user_grants. Người đó đăng nhập bằng Google lần đầu là trigger handle_new_user áp vai +
// đưa vào lớp, rồi xoá dòng chờ.
//
// VÌ SAO NÓ PHẢI HIỆN RA — và vì sao tôi đã sai khi ẩn nó đi:
// Ban đầu mục này mang tên "Lời mời đang chờ", tôi ẩn vì hệ thống KHÔNG gửi email nào cả, nên
// chữ "lời mời" hứa một việc không xảy ra. Nhưng ẩn hẳn thì mất luôn thông tin thật và cần: khai
// xong ba mươi ba email rồi không có chỗ nào xem lại đã khai những ai, vai gì, lớp nào. Cách đúng
// là gọi tên cho trúng, không phải giấu đi.
//
// Nên tiêu đề nói thẳng "chờ họ đăng nhập lần đầu", và có một câu nhắc rằng hệ thống không gửi
// mail — người khai phải tự báo cho họ.
//
// Mảnh này chỉ lo LẤY DỮ LIỆU; toàn bộ việc chia nhóm, phân trang, đóng băng và một-nút-lưu nằm ở
// GrantsPanel (client). Xem ghi chú ở đó để biết vì sao lọc chạy tại trình duyệt chứ không qua
// đường dẫn.
export async function PendingGrants() {
  const t = await getTranslations('admin');
  const supabase = await createClient();

  // layPhuTro/layDanhMuc đã được các mảnh khác của trang gọi và bọc cache() — dùng lại đúng kết
  // quả ấy, không thêm vòng đi-về nào ra Supabase.
  const [{grants, invites}, {allClasses}] = await Promise.all([layPhuTro(), layDanhMuc()]);

  // Tên học sinh cho lời mời phụ huynh: chỉ hỏi khi THẬT SỰ có lời mời đang chờ.
  const dangCho = invites.filter((i) => i.status === 'pending');
  const idHocSinh = [...new Set(dangCho.map((i) => i.student_id).filter(Boolean))] as string[];
  const tenHocSinh = new Map<string, string>();
  if (idHocSinh.length > 0) {
    const {data} = await supabase.from('profiles').select('id, full_name, email').in('id', idHocSinh);
    for (const p of data ?? []) tenHocSinh.set(p.id, p.full_name ?? p.email);
  }

  const classNames = Object.fromEntries(allClasses.map((c) => [c.id, c.name]));
  const lopDangDung = allClasses.filter((c) => c.is_active).map((c) => ({id: c.id, name: c.name}));
  const tong = grants.length + dangCho.length;
  if (tong === 0) return null;

  // DẤU VÂN TAY CỦA DỮ LIỆU, dùng làm key cho panel.
  //
  // "Lưu xong thì đóng băng" là một yêu cầu về trạng thái CLIENT, mà server action chỉ trả về bằng
  // cách dựng lại trang. Đổi key khi nội dung đổi là cách React tự vứt state cũ đi: panel dựng lại
  // ở trạng thái mặc định (đóng băng, chưa sửa gì) đúng lúc dữ liệu mới về. Không có nó thì lưu
  // xong màn hình vẫn nằm nguyên trong chế độ sửa, các ô chọn vẫn mở, không ai biết đã xong chưa.
  const vanTay = String(
    [...grants.map((g) => `${g.email}|${g.role}|${g.class_id ?? ''}`), ...dangCho.map((i) => `p${i.email}`)]
      .join(';')
      .split('')
      .reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 7),
  );

  return (
    <Disclosure title={t('grantsTitle')} count={tong}>
      <GrantsPanel
        key={vanTay}
        grants={grants}
        invites={dangCho.map((i) => ({
          email: i.email,
          childName: i.student_id ? (tenHocSinh.get(i.student_id) ?? t('classGone')) : null,
        }))}
        classes={lopDangDung}
        classNames={classNames}
      />

      {/* Nói thẳng giới hạn, ngay dưới bảng. Không nói thì người khai ngồi đợi một email mà hệ
          thống chưa bao giờ gửi — đúng thứ đã xảy ra. */}
      <p className="mt-2.5 rounded-[10px] bg-warn/[0.10] px-3 py-2 text-[12px] font-semibold leading-relaxed text-navy">
        {t('grantsNoMailWarning')}
      </p>
    </Disclosure>
  );
}
