-- 0176 — Thêm đơn vị "ngày" cho VIỆC BỔ TRỢ.
--
-- Việc bổ trợ (lead measure) là thói quen tick HẰNG NGÀY — đo bằng "số ngày làm / số ngày cần"
-- (vd 5/5 ngày), TÁCH khỏi số hứa của cam kết (khác đơn vị, không đổ số qua nhau). `thuoc.don_vi_id`
-- là NOT NULL nên việc bổ trợ phải có một đơn vị; "ngày" là đơn vị đúng nghĩa cho nhịp mỗi-ngày.
--
-- Trước đây việc bổ trợ mượn đơn vị của WIG (vd "lần"), khiến nó hiện "4/1 lần" vô nghĩa và buộc
-- phải có WIG-có-đơn-vị mới tạo được. Từ nay việc bổ trợ luôn dùng "ngày".
--
-- 0113 đã coi 'ngay' là nhóm 'luot' (đo bằng lượt/tick) nên không cần đụng gì thêm ở phần tính số.

insert into don_vi (ma, nhan_vi, nhan_en) values
  ('ngay', 'ngày', 'days')
on conflict do nothing;
