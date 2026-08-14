-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 0123 — wig_id CỦA VIỆC DẪN DẮT LÀ CỘT SUY RA, NÊN THÔI ĐÒI NGƯỜI GỬI
-- ════════════════════════════════════════════════════════════════════════════════════════════
--
-- 0121 để lead_measures.wig_id lại làm bản sao có sẵn (cache) và giao cho trigger
-- lead_theo_cam_ket suy nó từ cam kết. Nhưng cột vẫn NOT NULL, mà type sinh từ schema thì đọc
-- NOT NULL thành "bắt buộc gửi lên" — nên mọi lệnh insert trong app đều phải khai một giá trị
-- mà chính nó sẽ bị trigger đè ngay sau đó. Khai một thứ vô nghĩa để qua cửa kiểu dữ liệu là
-- cách chắc chắn nhất khiến người sau tưởng nó có nghĩa.
--
-- Bỏ NOT NULL. Cái giữ cho cột không rỗng nay là trigger — đúng chỗ của một cột suy ra: thứ
-- điền nó cũng là thứ bảo đảm nó. Trigger chạy BEFORE INSERT nên không có cửa sổ nào cột này
-- rỗng thật, và khoá ngoại vẫn chặn giá trị bậy.
alter table lead_measures alter column wig_id drop not null;

comment on column lead_measures.wig_id is
  'CỘT SUY RA từ commitment_id (trigger lead_theo_cam_ket, 0121). Đừng ghi thẳng — mọi giá trị gửi lên đều bị đè.';
