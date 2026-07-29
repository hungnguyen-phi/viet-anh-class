-- 0055 — Dọn bảng school_networks + chặn trùng, và TẮT cổng IP trong giai đoạn thử.
--
-- Ba việc, tất cả đều bắt nguồn từ một phát hiện khi soi dữ liệu thật:
--
-- 1) Bảng có 21 dòng nhưng chỉ là 3 dải khác nhau. Nút "Thêm IP hiện tại" dùng INSERT trần nên
--    bấm bao nhiêu lần thì đẻ bấy nhiêu bản sao; danh sách trên màn quản trị không còn đọc được.
--
-- 2) Nghiêm trọng hơn: hai trong ba dải là 162.158.163.250 và 104.23.175.175 — đó là IP của
--    CHÍNH CLOUDFLARE, không phải đường truyền của trường. Nguyên nhân ở lib/ip.ts: nó đọc
--    x-forwarded-for, mà Cloudflare ghi đè header đó. Đã sửa để ưu tiên cf-connecting-ip.
--    Hệ quả nếu để nguyên dữ liệu này SAU KHI sửa code: IP thật của trường sẽ không khớp dòng
--    nào → cổng chặn TOÀN BỘ học sinh. Nên phải dọn cùng lúc với bản sửa code.
--
-- 3) Người dùng xác nhận: chặn theo mạng trường là CỐ Ý, nhưng giai đoạn thử nghiệm chưa cần.
--    Hàm ip_allowed() đã có sẵn quy tắc "không dải nào đang bật → cho qua hết", nên chỉ cần tắt
--    là xong, không phải sửa hàm. Bật lại: vào /admin → mục mạng trường → bấm bật dải đúng
--    (đứng TẠI trường bấm "Thêm IP hiện tại" để lấy đúng IP, giờ đã đọc đúng nhờ bản sửa trên).

-- (1) Gộp trùng: giữ dòng cũ nhất của mỗi (campus_id, cidr).
delete from school_networks a
using school_networks b
where a.ctid > b.ctid
  and a.cidr = b.cidr
  and a.campus_id is not distinct from b.campus_id;

-- Chặn trùng từ gốc. coalesce vì campus_id NULL nghĩa là "áp cho toàn trường", mà trong SQL
-- thì NULL <> NULL nên unique index thường KHÔNG chặn được hai dòng toàn-trường trùng nhau.
create unique index if not exists uq_school_networks_campus_cidr
  on school_networks (coalesce(campus_id, '00000000-0000-0000-0000-000000000000'::uuid), cidr);

-- (3) Tắt cổng cho đợt thử. KHÔNG xoá dữ liệu: giữ lại để đối chiếu, bật lại khi chạy thật.
update school_networks set is_active = false where is_active;
