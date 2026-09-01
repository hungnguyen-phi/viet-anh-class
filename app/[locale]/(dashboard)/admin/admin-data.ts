import {cache} from 'react';
import {createClient} from '@/lib/supabase/server';

// Dữ liệu nền của màn Quản trị, GOM LẠI VÀ DÙNG CHUNG TRONG MỘT LƯỢT DỰNG TRANG.
//
// Vì sao cần cache(): sau khi tách trang ra nhiều mảnh chảy song song, có hai chỗ cùng cần danh
// sách cơ sở/khối/lớp/nhân sự — nút "Tạo mới" ở đầu trang và cây Cơ sở ở giữa trang. Không gói lại
// thì mỗi chỗ tự hỏi một lần, và trên đường truyền này mỗi lần hỏi là một phần tư giây. cache()
// của React chỉ giữ trong PHẠM VI MỘT LƯỢT DỰNG — không phải bộ nhớ đệm giữa các lần tải trang,
// nên không có chuyện người quản trị vừa tạo lớp xong lại thấy danh sách cũ.
//
// Tách làm hai nhóm chứ không gộp một: nút "Tạo mới" chỉ cần nhóm danh mục, chờ thêm bốn truy vấn
// phụ trợ (lời mời, lĩnh vực, wifi) chỉ để hiện được một cái nút là chờ vô ích.

export const layDanhMuc = cache(async () => {
  const supabase = await createClient();
  const [{data: campuses}, {data: grades}, {data: classes}, {data: staff}] = await Promise.all([
    supabase.from('campuses').select('id, name, code, is_active, levels').order('name'),
    supabase.from('grades').select('id, name, campus_id, sort_order, is_active').order('sort_order'),
    supabase
      .from('classes')
      // wigs(count) / enrollments(count): PostgREST gộp luôn vào CÙNG MỘT truy vấn, không thêm
      // vòng đi-về nào. Cần hai con số này để nút Xoá nói được vì sao nó không xoá được — hàm
      // deleteClass từ chối xoá lớp còn WIG hoặc còn học sinh, mà trước đây giao diện không hề
      // báo trước: nút trông y như xoá được, hộp thoại vẫn hỏi "chắc chưa", bấm đồng ý xong mới
      // hiện một dòng đỏ thoáng qua. Chủ dự án đã tưởng mình xoá hết lớp rồi trong khi còn bốn.
      .select(
        'id, name, school_year, grade, grade_id, campus_id, homeroom_teacher_id, is_active, muc_tieu(count), enrollments(count)',
      )
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('role', ['teacher', 'principal', 'admin'])
      .order('email')
      .limit(500),
  ]);
  return {
    allCampuses: campuses ?? [],
    allGrades: grades ?? [],
    allClasses: classes ?? [],
    staffList: staff ?? [],
  };
});

// HỌC SINH ĐÃ CÓ TÀI KHOẢN NHƯNG CHƯA THUỘC LỚP NÀO.
//
// Vì sao phải có: có em tự đăng nhập từ ngoài, quản trị viên duyệt cho vai học sinh xong là em
// nằm im ở đó — không lớp, không ai biết để xếp. Chủ dự án gặp đúng cảnh ấy: "tôi duyệt xong ko
// biết rơi vào đâu". Trước bản này không màn nào liệt kê những em như vậy, nên họ vô hình.
//
// Hỏi bằng HAI truy vấn rồi trừ nhau trong bộ nhớ, không phải một truy vấn lồng: PostgREST không
// có "not exists" trên bảng khác, và lọc bằng .not('id','in',...) thì danh sách id nhét vào URL —
// trường vài trăm em là URL vượt giới hạn, gãy im.
export const layHocSinhChuaCoLop = cache(async () => {
  const supabase = await createClient();
  const [{data: hocSinh}, {data: dangHoc}] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').eq('role', 'student').order('email').limit(2000),
    supabase.from('enrollments').select('student_id').eq('is_active', true).limit(5000),
  ]);
  const coLop = new Set((dangHoc ?? []).map((e) => e.student_id));
  return (hocSinh ?? []).filter((h) => !coLop.has(h.id));
});

export const layPhuTro = cache(async () => {
  const supabase = await createClient();
  const [{data: grants}, {data: invites}, {data: areaCfg}, {data: networks}] = await Promise.all([
    supabase.from('pending_user_grants').select('email, role, class_id, created_at').order('created_at', {ascending: false}),
    supabase.from('parent_invitations').select('email, student_id, status').order('created_at'),
    supabase.from('area_config').select('*').order('sort_order'),
    // Mạng đang bật lên trên, rồi theo nhãn A→Z — chứ không theo thứ tự vừa thêm. Một dải mạng
    // mới khai luôn rơi xuống cuối là lý do danh sách này càng dùng càng khó đọc.
    supabase
      .from('school_networks')
      .select('id, label, cidr, campus_id, is_active')
      .order('is_active', {ascending: false})
      .order('label'),
  ]);
  return {
    grants: grants ?? [],
    invites: invites ?? [],
    areaCfg: areaCfg ?? [],
    networks: networks ?? [],
  };
});
