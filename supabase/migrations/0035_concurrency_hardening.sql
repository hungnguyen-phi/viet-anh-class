-- 0035 — Chịu lỗi/đồng thời (audit nghiệm thu): chống TRÙNG biên bản họp + yêu cầu-sửa,
-- và thông báo GVCN khi có yêu cầu-sửa mới.

-- ============ 1) wig_meetings: chống trùng (lớp,tuần) & (HS,tuần) ============
-- Dedup dữ liệu cũ trước (giữ bản mới nhất) rồi tạo unique index từng phần.
delete from wig_meetings a using wig_meetings b
where a.student_id is null and b.student_id is null
  and a.class_id = b.class_id and a.week_label = b.week_label
  and (a.created_at, a.id) < (b.created_at, b.id);

delete from wig_meetings a using wig_meetings b
where a.student_id is not null and b.student_id is not null
  and a.student_id = b.student_id and a.week_label = b.week_label
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists wig_meetings_class_week_uidx
  on wig_meetings (class_id, week_label) where student_id is null;
create unique index if not exists wig_meetings_student_week_uidx
  on wig_meetings (student_id, week_label) where student_id is not null;

-- ============ 2) edit_requests: 1 yêu cầu pending / (HS, loại, đối tượng) ============
-- HS bấm "Xin sửa" nhiều lần cho cùng 1 tick → chỉ 1 pending (ref_id NULL vẫn cho nhiều 'other').
create unique index if not exists edit_requests_pending_uidx
  on edit_requests (student_id, kind, ref_id) where status = 'pending';

-- ============ 3) Thông báo GVCN khi có yêu cầu-sửa mới ============
-- notifications chỉ insert được qua definer (authenticated không có quyền insert) → dùng trigger.
create or replace function notify_edit_request() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_teacher uuid;
begin
  select homeroom_teacher_id into v_teacher from classes where id = new.class_id;
  if v_teacher is not null then
    insert into notifications (user_id, title, body, link)
    values (v_teacher,
            'Yêu cầu chỉnh sửa mới',
            left(coalesce(new.message, ''), 200),
            '/student/' || new.student_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_edit_request on edit_requests;
create trigger trg_notify_edit_request after insert on edit_requests
  for each row execute function notify_edit_request();
