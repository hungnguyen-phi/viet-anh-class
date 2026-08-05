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
        'id, name, school_year, grade, grade_id, campus_id, homeroom_teacher_id, is_active, wigs(count), enrollments(count)',
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

export const layPhuTro = cache(async () => {
  const supabase = await createClient();
  const [{data: grants}, {data: invites}, {data: areaCfg}, {data: networks}] = await Promise.all([
    supabase.from('pending_user_grants').select('email, role, class_id').order('created_at'),
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
