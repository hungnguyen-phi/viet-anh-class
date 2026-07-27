-- 0048 — Vá hiệu năng RLS (286 cảnh báo advisor: 230 multiple_permissive + 27 auth_rls_initplan)
--
-- ⚠️ ĐÂY LÀ RLS BẢO VỆ DỮ LIỆU TRẺ EM. Migration này KHÔNG được phép nới quyền cho ai.
--    Hai phép biến đổi dưới đây đều BẢO TOÀN NGỮ NGHĨA TUYỆT ĐỐI — xem chứng minh từng cái.
--
-- ── Phép 1: bọc hàm không phụ thuộc dòng vào (select ...) ───────────────────
--    auth_role() → (select auth_role()), tương tự auth_campus(), auth.uid(), vn_today(),
--    vn_week_start().
--    VÌ SAO NHANH: các hàm này STABLE và không nhận cột nào, nên khi bọc trong (select ...)
--    Postgres nâng chúng thành InitPlan — tính ĐÚNG MỘT LẦN cho cả câu lệnh thay vì gọi lại
--    trên TỪNG DÒNG. auth_role() bản thân nó là một truy vấn vào profiles, nên trước đây quét
--    1.200 học sinh = 1.200 lượt truy vấn phụ.
--    VÌ SAO AN TOÀN: giá trị trả về không đổi, chỉ đổi số lần gọi. Đây đúng là cách Supabase
--    advisor khuyến nghị (lint 0003_auth_rls_initplan).
--    KHÔNG bọc được: is_class_teacher(class_id), is_my_child(student_id)… vì chúng nhận CỘT
--    của dòng đang xét → bắt buộc chạy từng dòng.
--
-- ── Phép 2: gộp các policy PERMISSIVE trùng (bảng, lệnh, role) ──────────────
--    VÌ SAO AN TOÀN: Postgres vốn đã kết hợp nhiều permissive policy bằng OR. Gộp N policy
--    thành 1 policy với điều kiện `A or B or C` cho ra ĐÚNG tập dòng cũ — chỉ khác là bộ tối
--    ưu chỉ phải dựng một biểu thức thay vì N lần lặp.
--    Với UPDATE: USING gộp bằng OR, WITH CHECK gộp bằng OR, độc lập nhau — đúng bằng cách
--    Postgres đánh giá hai pha đó khi có nhiều policy.
--    KHÔNG gộp chéo lệnh: policy `ALL` giữ nguyên là ALL, không nhập vào nhóm SELECT (làm thế
--    sẽ đổi quyền INSERT/UPDATE/DELETE).
--
-- ── ĐỔI TÊN POLICY ─────────────────────────────────────────────────────────
--    Gộp 5 policy thành 1 thì không giữ được tên cũ. Tên mới theo khuôn `rls_<lệnh>_<bảng>`.
--    HỆ QUẢ: migration/chú thích cũ có nhắc tên như `notif_own_read`, `prof_self_read`… giờ
--    không còn đối tượng đó nữa. Migration SAU này muốn sửa policy phải dùng tên mới.

-- ───────────────────────────── area_config ─────────────────────────────
drop policy if exists area_admin_all on public.area_config;
create policy rls_all_area_config on public.area_config as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists area_read on public.area_config;
create policy rls_select_area_config on public.area_config as permissive for SELECT to public
  using (((select auth.uid()) IS NOT NULL));

-- ─────────────────────────── attendance_records ────────────────────────
drop policy if exists att_admin_all on public.attendance_records;
create policy rls_all_attendance_records on public.attendance_records as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists att_teacher_delete on public.attendance_records;
create policy rls_delete_attendance_records on public.attendance_records as permissive for DELETE to public
  using ((is_class_teacher(class_id) AND ((date >= ((select vn_today()) - 6)) AND (date <= (select vn_today())))));

drop policy if exists att_leader_insert on public.attendance_records;
drop policy if exists att_teacher_insert on public.attendance_records;
create policy rls_insert_attendance_records on public.attendance_records as permissive for INSERT to public
  with check ((is_attendance_leader(class_id) AND (date = (select vn_today()))) or (is_class_teacher(class_id) AND ((date >= ((select vn_today()) - 6)) AND (date <= (select vn_today())))));

drop policy if exists att_leader_select on public.attendance_records;
drop policy if exists att_parent_select on public.attendance_records;
drop policy if exists att_principal_select on public.attendance_records;
drop policy if exists att_student_self on public.attendance_records;
drop policy if exists att_teacher_select on public.attendance_records;
create policy rls_select_attendance_records on public.attendance_records as permissive for SELECT to public
  using ((is_attendance_leader(class_id) AND (date = (select vn_today()))) or is_my_child(student_id) or (((select auth_role()) = 'principal'::user_role) AND is_campus_class(class_id)) or (student_id = (select auth.uid())) or is_class_teacher(class_id));

drop policy if exists att_leader_update on public.attendance_records;
drop policy if exists att_teacher_update on public.attendance_records;
create policy rls_update_attendance_records on public.attendance_records as permissive for UPDATE to public
  using ((is_attendance_leader(class_id) AND (date = (select vn_today()))) or (is_class_teacher(class_id) AND ((date >= ((select vn_today()) - 6)) AND (date <= (select vn_today())))))
  with check ((is_attendance_leader(class_id) AND (date = (select vn_today()))) or (is_class_teacher(class_id) AND ((date >= ((select vn_today()) - 6)) AND (date <= (select vn_today())))));

-- ───────────────────────────── audit_log ───────────────────────────────
drop policy if exists audit_admin_read on public.audit_log;
create policy rls_select_audit_log on public.audit_log as permissive for SELECT to public
  using (((select auth_role()) = 'admin'::user_role));

-- ─────────────────────────── buddy_messages ────────────────────────────
drop policy if exists bm_admin_all on public.buddy_messages;
drop policy if exists bm_staff_manage on public.buddy_messages;
create policy rls_all_buddy_messages on public.buddy_messages as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role) or (EXISTS ( SELECT 1
   FROM wig_meetings m
  WHERE ((m.id = buddy_messages.meeting_id) AND staff_can_manage_class(m.class_id)))))
  with check (((select auth_role()) = 'admin'::user_role) or (EXISTS ( SELECT 1
   FROM wig_meetings m
  WHERE ((m.id = buddy_messages.meeting_id) AND staff_can_manage_class(m.class_id)))));

drop policy if exists bm_student_insert on public.buddy_messages;
create policy rls_insert_buddy_messages on public.buddy_messages as permissive for INSERT to public
  with check (((role = 'user'::text) AND (EXISTS ( SELECT 1
   FROM wig_meetings m
  WHERE ((m.id = buddy_messages.meeting_id) AND (m.student_id = (select auth.uid())) AND m.buddy_chat_open)))));

drop policy if exists bm_staff_read on public.buddy_messages;
drop policy if exists bm_student_read on public.buddy_messages;
create policy rls_select_buddy_messages on public.buddy_messages as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM wig_meetings m
  WHERE ((m.id = buddy_messages.meeting_id) AND staff_can_read_class(m.class_id)))) or (EXISTS ( SELECT 1
   FROM wig_meetings m
  WHERE ((m.id = buddy_messages.meeting_id) AND (m.student_id = (select auth.uid()))))));

-- ───────────────────────────── campuses ────────────────────────────────
drop policy if exists campus_admin_all on public.campuses;
create policy rls_all_campuses on public.campuses as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists campus_read on public.campuses;
create policy rls_select_campuses on public.campuses as permissive for SELECT to public
  using (((select auth.uid()) IS NOT NULL));

-- ────────────────────────────── classes ────────────────────────────────
drop policy if exists class_admin_all on public.classes;
create policy rls_all_classes on public.classes as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists class_principal_delete on public.classes;
create policy rls_delete_classes on public.classes as permissive for DELETE to public
  using ((((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))));

drop policy if exists class_principal_insert on public.classes;
create policy rls_insert_classes on public.classes as permissive for INSERT to public
  with check ((((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))));

drop policy if exists class_parent_read on public.classes;
drop policy if exists class_principal_read on public.classes;
drop policy if exists class_student_read on public.classes;
drop policy if exists class_teacher_read on public.classes;
create policy rls_select_classes on public.classes as permissive for SELECT to public
  using (is_parent_of_class(id) or (((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))) or is_class_student(id) or is_class_teacher(id));

drop policy if exists class_principal_update on public.classes;
drop policy if exists class_teacher_update on public.classes;
create policy rls_update_classes on public.classes as permissive for UPDATE to public
  using ((((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))) or is_class_teacher(id))
  with check ((((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))) or is_class_teacher(id));

-- ──────────────────────────── edit_requests ────────────────────────────
drop policy if exists er_admin_all on public.edit_requests;
create policy rls_all_edit_requests on public.edit_requests as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists er_requester_delete on public.edit_requests;
create policy rls_delete_edit_requests on public.edit_requests as permissive for DELETE to public
  using (((requester_id = (select auth.uid())) AND (status = 'pending'::text)));

drop policy if exists er_requester_insert on public.edit_requests;
create policy rls_insert_edit_requests on public.edit_requests as permissive for INSERT to public
  with check (((requester_id = (select auth.uid())) AND (is_class_student(class_id) OR is_my_child(student_id))));

drop policy if exists er_requester_read on public.edit_requests;
drop policy if exists er_staff_read on public.edit_requests;
create policy rls_select_edit_requests on public.edit_requests as permissive for SELECT to public
  using ((requester_id = (select auth.uid())) or staff_can_read_class(class_id));

drop policy if exists er_requester_update on public.edit_requests;
drop policy if exists er_staff_update on public.edit_requests;
create policy rls_update_edit_requests on public.edit_requests as permissive for UPDATE to public
  using (((requester_id = (select auth.uid())) AND (status = 'pending'::text)) or staff_can_manage_class(class_id))
  with check (((requester_id = (select auth.uid())) AND (status = 'pending'::text) AND (is_class_student(class_id) OR is_my_child(student_id))) or staff_can_manage_class(class_id));

-- ──────────────────────────── enrollments ──────────────────────────────
drop policy if exists enr_admin_all on public.enrollments;
create policy rls_all_enrollments on public.enrollments as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists enr_leader_read on public.enrollments;
drop policy if exists enr_parent_read on public.enrollments;
drop policy if exists enr_principal_read on public.enrollments;
drop policy if exists enr_student_self on public.enrollments;
drop policy if exists enr_teacher_read on public.enrollments;
create policy rls_select_enrollments on public.enrollments as permissive for SELECT to public
  using (is_attendance_leader(class_id) or is_my_child(student_id) or (((select auth_role()) = 'principal'::user_role) AND is_campus_class(class_id)) or (student_id = (select auth.uid())) or is_class_teacher(class_id));

drop policy if exists enr_teacher_update on public.enrollments;
create policy rls_update_enrollments on public.enrollments as permissive for UPDATE to public
  using (is_class_teacher(class_id))
  with check (is_class_teacher(class_id));

-- ────────────────────────────── grades ─────────────────────────────────
drop policy if exists grade_admin_all on public.grades;
drop policy if exists grade_principal_manage on public.grades;
create policy rls_all_grades on public.grades as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role) or (((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))))
  with check (((select auth_role()) = 'admin'::user_role) or (((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))));

drop policy if exists grade_read on public.grades;
create policy rls_select_grades on public.grades as permissive for SELECT to public
  using (((select auth.uid()) IS NOT NULL));

-- ─────────────────────────── lead_measures ─────────────────────────────
drop policy if exists lm_manage on public.lead_measures;
create policy rls_all_lead_measures on public.lead_measures as permissive for ALL to public
  using (staff_can_manage_class(wig_class(wig_id)))
  with check (staff_can_manage_class(wig_class(wig_id)));

drop policy if exists lm_read on public.lead_measures;
create policy rls_select_lead_measures on public.lead_measures as permissive for SELECT to public
  using ((staff_can_read_class(wig_class(wig_id)) OR (EXISTS ( SELECT 1
   FROM wigs w
  WHERE ((w.id = lead_measures.wig_id) AND is_class_student(w.class_id) AND ((w.scope = 'class'::wig_scope) OR (w.student_id = (select auth.uid()))))))));

-- ─────────────────────────── lead_progress ─────────────────────────────
drop policy if exists lp_staff_manage on public.lead_progress;
create policy rls_all_lead_progress on public.lead_progress as permissive for ALL to public
  using (staff_can_manage_class(lead_class(lead_measure_id)))
  with check (staff_can_manage_class(lead_class(lead_measure_id)));

drop policy if exists lp_student_delete on public.lead_progress;
create policy rls_delete_lead_progress on public.lead_progress as permissive for DELETE to public
  using (((logged_by = (select auth.uid())) AND (logged_date >= (select vn_week_start())) AND tick_open(lead_class(lead_measure_id))));

drop policy if exists lp_student_insert on public.lead_progress;
create policy rls_insert_lead_progress on public.lead_progress as permissive for INSERT to public
  with check (((student_id = (select auth.uid())) AND (logged_by = (select auth.uid())) AND is_class_student(lead_class(lead_measure_id)) AND (logged_date >= (select vn_week_start())) AND (logged_date <= (select vn_today())) AND tick_open(lead_class(lead_measure_id))));

drop policy if exists lp_read on public.lead_progress;
create policy rls_select_lead_progress on public.lead_progress as permissive for SELECT to public
  using (((student_id = (select auth.uid())) OR is_my_child(student_id) OR staff_can_read_class(lead_class(lead_measure_id))));

drop policy if exists lp_student_update on public.lead_progress;
create policy rls_update_lead_progress on public.lead_progress as permissive for UPDATE to public
  using (((logged_by = (select auth.uid())) AND (logged_date >= (select vn_week_start())) AND tick_open(lead_class(lead_measure_id))))
  with check (((logged_by = (select auth.uid())) AND (logged_date >= (select vn_week_start())) AND (logged_date <= (select vn_today())) AND tick_open(lead_class(lead_measure_id))));

-- ─────────────────────────── mood_checkins ─────────────────────────────
drop policy if exists mc_admin_all on public.mood_checkins;
create policy rls_all_mood_checkins on public.mood_checkins as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists mc_staff_read on public.mood_checkins;
drop policy if exists mc_student_read on public.mood_checkins;
create policy rls_select_mood_checkins on public.mood_checkins as permissive for SELECT to public
  using ((is_my_child(student_id) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.student_id = mood_checkins.student_id) AND staff_can_read_class(e.class_id))))) or (student_id = (select auth.uid())));

-- ─────────────────────────── notifications ─────────────────────────────
drop policy if exists notif_own_read on public.notifications;
create policy rls_select_notifications on public.notifications as permissive for SELECT to public
  using ((user_id = (select auth.uid())));

drop policy if exists notif_own_update on public.notifications;
create policy rls_update_notifications on public.notifications as permissive for UPDATE to public
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

-- ─────────────────────── parent_invitations / links ────────────────────
drop policy if exists pi_admin_all on public.parent_invitations;
create policy rls_all_parent_invitations on public.parent_invitations as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists pl_admin_all on public.parent_links;
create policy rls_all_parent_links on public.parent_links as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists pl_parent_self on public.parent_links;
create policy rls_select_parent_links on public.parent_links as permissive for SELECT to public
  using ((parent_id = (select auth.uid())));

-- ─────────────────────── pending_user_grants ───────────────────────────
drop policy if exists pug_admin_all on public.pending_user_grants;
create policy rls_all_pending_user_grants on public.pending_user_grants as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

-- ────────────────────────────── profiles ───────────────────────────────
drop policy if exists prof_admin_all on public.profiles;
create policy rls_all_profiles on public.profiles as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists prof_leader_classmates on public.profiles;
drop policy if exists prof_parent_child on public.profiles;
drop policy if exists prof_principal_campus on public.profiles;
drop policy if exists prof_self_read on public.profiles;
drop policy if exists prof_teacher_students on public.profiles;
create policy rls_select_profiles on public.profiles as permissive for SELECT to public
  using (is_classmate_via_leader(id) or is_my_child(id) or (((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))) or (id = (select auth.uid())) or is_my_student(id));

drop policy if exists prof_self_update on public.profiles;
create policy rls_update_profiles on public.profiles as permissive for UPDATE to public
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

-- ────────────────────────── school_networks ────────────────────────────
drop policy if exists sn_admin_all on public.school_networks;
drop policy if exists sn_principal_manage on public.school_networks;
create policy rls_all_school_networks on public.school_networks as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role) or (((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))))
  with check (((select auth_role()) = 'admin'::user_role) or (((select auth_role()) = 'principal'::user_role) AND (campus_id = (select auth_campus()))));

drop policy if exists sn_read on public.school_networks;
create policy rls_select_school_networks on public.school_networks as permissive for SELECT to public
  using (((select auth.uid()) IS NOT NULL));

-- ─────────────────────── scoreboard_entries ────────────────────────────
drop policy if exists sb_admin_all on public.scoreboard_entries;
create policy rls_all_scoreboard_entries on public.scoreboard_entries as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists sb_class_read on public.scoreboard_entries;
drop policy if exists sb_parent_read on public.scoreboard_entries;
drop policy if exists sb_student_self_read on public.scoreboard_entries;
create policy rls_select_scoreboard_entries on public.scoreboard_entries as permissive for SELECT to public
  using (((class_id IS NOT NULL) AND (is_class_teacher(class_id) OR (is_class_student(class_id) AND (student_id IS NULL)) OR (((select auth_role()) = 'principal'::user_role) AND is_campus_class(class_id)))) or ((student_id IS NOT NULL) AND is_my_child(student_id)) or (student_id = (select auth.uid())));

-- ─────────────────────── signup_email_domains ──────────────────────────
drop policy if exists sed_admin_all on public.signup_email_domains;
create policy rls_all_signup_email_domains on public.signup_email_domains as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role))
  with check (((select auth_role()) = 'admin'::user_role));

drop policy if exists sed_read on public.signup_email_domains;
create policy rls_select_signup_email_domains on public.signup_email_domains as permissive for SELECT to public
  using (((select auth.uid()) IS NOT NULL));

-- ────────────────────── timetable_overrides / slots ────────────────────
drop policy if exists tto_manage on public.timetable_overrides;
create policy rls_all_timetable_overrides on public.timetable_overrides as permissive for ALL to public
  using ((EXISTS ( SELECT 1
   FROM timetable_slots s
  WHERE ((s.id = timetable_overrides.slot_id) AND staff_can_manage_class(s.class_id)))))
  with check ((EXISTS ( SELECT 1
   FROM timetable_slots s
  WHERE ((s.id = timetable_overrides.slot_id) AND staff_can_manage_class(s.class_id)))));

drop policy if exists tto_read on public.timetable_overrides;
create policy rls_select_timetable_overrides on public.timetable_overrides as permissive for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM timetable_slots s
  WHERE ((s.id = timetable_overrides.slot_id) AND (is_class_student(s.class_id) OR staff_can_read_class(s.class_id) OR is_parent_of_class(s.class_id))))));

drop policy if exists tt_manage on public.timetable_slots;
create policy rls_all_timetable_slots on public.timetable_slots as permissive for ALL to public
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

drop policy if exists tt_read on public.timetable_slots;
create policy rls_select_timetable_slots on public.timetable_slots as permissive for SELECT to public
  using ((is_class_student(class_id) OR staff_can_read_class(class_id) OR is_parent_of_class(class_id)));

-- ─────────────────────────── wig_meetings ──────────────────────────────
drop policy if exists wm_admin_all on public.wig_meetings;
drop policy if exists wm_teacher_all on public.wig_meetings;
create policy rls_all_wig_meetings on public.wig_meetings as permissive for ALL to public
  using (((select auth_role()) = 'admin'::user_role) or is_class_teacher(class_id))
  with check (((select auth_role()) = 'admin'::user_role) or is_class_teacher(class_id));

drop policy if exists wm_parent_select on public.wig_meetings;
drop policy if exists wm_principal_select on public.wig_meetings;
drop policy if exists wm_student_select on public.wig_meetings;
create policy rls_select_wig_meetings on public.wig_meetings as permissive for SELECT to public
  using (((student_id IS NOT NULL) AND is_my_child(student_id)) or (((select auth_role()) = 'principal'::user_role) AND is_campus_class(class_id)) or (is_class_student(class_id) AND ((student_id IS NULL) OR (student_id = (select auth.uid())) OR (buddy_id = (select auth.uid())))));

-- ──────────────────────────────── wigs ─────────────────────────────────
drop policy if exists wig_manage on public.wigs;
create policy rls_all_wigs on public.wigs as permissive for ALL to public
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

drop policy if exists wig_read on public.wigs;
create policy rls_select_wigs on public.wigs as permissive for SELECT to public
  using (((is_class_student(class_id) AND ((scope = 'class'::wig_scope) OR (student_id = (select auth.uid())))) OR staff_can_read_class(class_id) OR ((scope = 'student'::wig_scope) AND is_my_child(student_id))));
