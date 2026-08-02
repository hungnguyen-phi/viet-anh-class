-- SAO LƯU 27 dòng lead_progress do NGƯỜI LỚN GÕ TAY (student_id IS NULL), xoá ngày 2026-08-02
-- khi chuyển sang mô hình "thắng/thua tính từ tick thật của học sinh" (migration 0073).
--
-- Chạy file này là hoàn nguyên đúng 27 dòng ấy, y nguyên id/giá trị/ngày/người ghi:
--   node scripts/run-sql.mjs scripts/restore-lead-progress-go-tay-2026-08-02.sql
--
-- HAI NHÓM, khác hẳn nhau về bản chất — nếu cần lấy lại thì nhiều khả năng chỉ cần nhóm 1:
--
--   Nhóm 1 (3 dòng, lớp 6A1, WIG NĂM, ghi 2026-07-22): "Tiến độ knowledge/english/physical"
--     = 144 / 40 / 35. Đây là SỐ ĐO cấp năm — thứ nhà trường đo được (bao nhiêu em đạt giỏi,
--     bao nhiêu em lên level AVQT), không phải hành vi hằng ngày để học sinh tick. Xoá đi thì
--     ba vòng donut WIG năm của 6A1 về 0 cho tới khi có WIG tuần con chạy lên.
--
--   Nhóm 2 (24 dòng, lớp 7B1, WIG TUẦN "Đọc sách 3 buổi/1 tuần", ghi 2026-07-28→29): 24 lần
--     bấm "Ghi +" liên tiếp, mỗi lần +1, cách nhau vài giây. Đây đúng là thứ 0073 sinh ra để
--     chấm dứt: một con số 24/30 mà "0/3 em đã góp". Không nên hoàn nguyên nhóm này.
begin;

insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('af9eed30-59d0-49a4-8c17-758f9c1b00c0','b4fab170-2026-4316-af1a-2c02d35592fd',null,144,'2026-07-22','d0d6e263-6336-4887-802c-5d73a2601cd5',null,'2026-07-22 02:57:42.604722+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('b6c81568-a22f-4f97-8d83-23865bcb88af','9bc2265f-3a10-412e-b82e-77a5a98723a4',null,40,'2026-07-22','d0d6e263-6336-4887-802c-5d73a2601cd5',null,'2026-07-22 02:57:42.604722+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('1332eb32-f2bc-4341-9e07-ceaf2e7a8ad3','a363d1f4-5c43-4774-b79b-2ad6d8155450',null,35,'2026-07-22','d0d6e263-6336-4887-802c-5d73a2601cd5',null,'2026-07-22 02:57:42.604722+00');

insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('126b3057-badd-45bf-a464-f1b1af067eef','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:34.001411+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('a4862744-5a85-465d-b97c-00177a0778fa','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:40.142408+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('80f7efa3-c5e9-4bbb-8cd9-089310911a90','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:43.963779+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('1cc069a4-de25-4c1b-a44b-ddae3f2d38b7','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:45.6826+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('d6a15960-f872-44fe-9e9d-519b3abcfdd7','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:47.380054+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('5a3f9700-3183-4453-9dad-47920cfadafd','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:48.683547+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('41f231ef-afc6-4c1d-b685-44eedefe60f5','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:49.9051+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('123c70c2-1248-4936-a280-a626a2eeb523','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:53.438038+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('a2c0651a-87ff-4463-99f1-70df4bd6af0f','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:55.46036+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('07381fc1-9d10-4eda-8e12-4f79437dc81c','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:53:56.508492+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('d0590888-179a-41a9-82af-2c8204a00adf','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:26.957104+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('5564d03b-1a66-4f80-be7f-70577cf40d84','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:29.336905+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('a065332d-34ab-4779-ad59-5c4918f46bc4','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:31.899975+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('ba41bebe-e2d2-42fc-912f-74ad52927b44','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:33.641741+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('afa0ea23-1510-458e-986b-3b445c56e862','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:35.340786+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('a90a0f1c-4102-411c-8b89-ae74824250e9','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:38.569755+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('33a9b466-2fb5-43c1-8300-1a4a1c2a6764','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:43.571115+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('44d7202d-c187-4e15-a0d8-4e9eb4aea532','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:46.042901+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('8b39c74e-89ea-4065-bb46-829838e0b387','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:49.572592+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('a3e045f4-7ab9-4db3-9980-47016dce2fe1','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:54.128485+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('5d415667-1daf-4da4-8b38-de4afcb84bc3','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:54:57.451197+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('a51db751-f695-40d0-aa28-1facb60efb32','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:56:30.390646+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('0cb26741-2e2d-4df9-9c69-cb6ffde8a83b','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-28','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-28 03:56:46.466879+00');
insert into lead_progress (id, lead_measure_id, student_id, value, logged_date, logged_by, note, created_at) values ('320412f2-8e71-47a0-b702-7a347748e0bb','6a1dbd38-1945-4fb7-9ea9-b2407d8e0b33',null,1,'2026-07-29','22ec9392-46c6-420a-bae4-d890bd09d54f',null,'2026-07-29 04:18:37.008523+00');

commit;
