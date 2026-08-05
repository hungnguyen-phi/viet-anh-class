-- 0086 — Nút "Thêm mạng"/"Thêm IP hiện tại" bấm vào chỉ ra "Đã xảy ra lỗi. Vui lòng thử lại."
--
-- TRIỆU CHỨNG: bấm thêm dải wifi ở màn Quản trị là bị đá về /admin?flash_err=Đã xảy ra lỗi…
-- Bảng school_networks có ĐÚNG 0 DÒNG, tức tính năng này chưa từng chạy được lần nào — trong khi
-- nó là cổng IP quyết định học sinh có check-in cảm xúc (và được ghi có mặt) hay không.
--
-- NGUYÊN NHÂN: 0055 chặn trùng bằng một chỉ mục BIỂU THỨC:
--     create unique index … on school_networks (coalesce(campus_id, '000…0'::uuid), cidr);
-- Lý do dùng coalesce là đúng — campus_id NULL nghĩa là "áp cho toàn trường", mà trong SQL thì
-- NULL <> NULL nên unique index thường không chặn nổi hai dòng toàn-trường trùng nhau.
--
-- Nhưng network-actions.ts lại upsert với `onConflict: 'campus_id,cidr'`, và ON CONFLICT chỉ khớp
-- được chỉ mục trên ĐÚNG CỘT, không khớp chỉ mục trên biểu thức. Postgres trả:
--     42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
-- Mã 42P10 không nằm trong bảng dịch của friendlyError() nên rơi xuống nhánh mặc định — người dùng
-- nhận đúng một câu vô nghĩa, và không có gì trong câu đó dẫn được về đây.
--
-- CÁCH CHỮA: Postgres 15 trở lên có UNIQUE … NULLS NOT DISTINCT, làm được đúng việc mà coalesce
-- đang làm nhưng trên chính hai cột thật. Máy chủ này chạy Postgres 17.6.
-- Ngữ nghĩa không đổi (NULL vẫn bị coi là bằng nhau) nên không dòng nào đang hợp lệ mà thành sai;
-- đổi chỉ mục là an toàn.

drop index if exists uq_school_networks_campus_cidr;

create unique index if not exists uq_school_networks_campus_cidr
  on school_networks (campus_id, cidr) nulls not distinct;

comment on index uq_school_networks_campus_cidr is
  'Chặn trùng dải mạng. NULLS NOT DISTINCT để campus_id NULL (toàn trường) cũng bị coi là trùng nhau. PHẢI là chỉ mục trên đúng cột — network-actions.ts upsert với onConflict campus_id,cidr.';
