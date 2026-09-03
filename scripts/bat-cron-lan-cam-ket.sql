-- BẬT lịch "cam kết tự lăn sang tuần sau".
--
-- CHẠY SAU KHI: (1) đã cài migration 0177 (hàm lan_cam_ket_tuan), (2) đã kiểm bằng
-- scripts/test-lan-cam-ket.sql và thấy "TẤT CẢ TEST ĐẠT". Trước đó KHÔNG chạy file này.
--
-- Hằng ngày 00:15 UTC (~07:15 giờ VN — sau nửa đêm thứ Hai VN). Hàm idempotent và dừng bằng dấu
-- 'huy' nên chạy hằng ngày an toàn, bắt kịp cả ngày lỡ. Chỉ lăn cam kết của EM (chu_the='em').
--
-- GỠ khi cần:  select cron.unschedule('lan-cam-ket-tuan');
-- XEM lịch:    select jobname, schedule, command, active from cron.job where jobname='lan-cam-ket-tuan';

select cron.schedule('lan-cam-ket-tuan', '15 0 * * *', $$select public.lan_cam_ket_tuan()$$);
