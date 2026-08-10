// GỬI KÈM BẢN DỰ PHÒNG — chữa cái ĐUÔI, không phải chữa con số trung vị.
//
// ════════════════════════════════════════════════════════════════════════════
// VÌ SAO (đo trên chính VPS, 10/08/2026)
// ════════════════════════════════════════════════════════════════════════════
//
// 20 lượt gọi Supabase từ container của app:
//
//     nhanh nhất 12ms · GIỮA 34ms · p90 100ms · CHẬM NHẤT 520ms
//
// Đường này khi khoẻ chỉ 34ms. Nhưng cứ mươi lượt lại có một lượt 100ms, và trong 20 lượt đã có
// một lượt 520ms — gấp mười lăm lần. Đo từ ngoài vào còn thấy tệ hơn: một route KHÔNG chạm CSDL
// (/api/health, 67 byte) vẫn có lần mất 976ms và 1118ms.
//
// Nguyên do là mất gói (1,77% đo được ở /api/diag): TCP mất một gói thì phải đợi hết một chu kỳ
// chờ mới gửi lại. Không có gì trong mã sửa được chuyện gói rơi — nhưng KHÔNG PHẢI CỨ RƠI LÀ
// PHẢI NGỒI CHỜ. Một trang gọi 7–11 lượt, nên xác suất dính ít nhất một cú như thế là rất cao;
// đó chính là cái đuôi p95 1,8–2,2 giây mà giáo viên cảm nhận, chứ không phải con số trung vị.
//
// Cách chữa kinh điển cho đúng bệnh này: quá một ngưỡng mà chưa thấy trả lời thì bắn thêm MỘT
// bản sao của cùng câu hỏi ấy, ai về trước dùng nấy, cái còn lại huỷ. Bản sao đi trên một kết nối
// khác, nên nó không dính cái gói vừa rơi. Cú 520ms thành ~180ms.
//
// ════════════════════════════════════════════════════════════════════════════
// LUẬT AN TOÀN — CHỈ ÁP CHO CÂU ĐỌC
// ════════════════════════════════════════════════════════════════════════════
//
// Chỉ hedge phương thức GET. Đây không phải chuyện cẩn thận thừa: PostgREST dùng POST cho cả RPC
// lẫn ghi, mà trong app này có mark_attendance, student_checkin, set_my_mood… Gửi kèm bản sao một
// câu ghi là có ngày một em điểm danh hai lần, hoặc một lượt tick thành hai. Đọc thì gửi bao
// nhiêu lần cũng ra một kết quả, nên chỉ đọc mới được phép.
//
// Ngưỡng 150ms ≈ p90 của đường này: dưới ngưỡng là 9/10 lượt bình thường, không tốn thêm gì cả.
// Chỉ khoảng một phần mười số câu đọc phải trả giá một bản sao — đổi lại cái đuôi bị cắt.
//
// Đúng MỘT bản dự phòng, không phải nhiều: nếu cả hai cùng chậm thì đường đang thật sự tắc, bắn
// tiếp chỉ làm tắc thêm.

const NGUONG_MS = 150;

/** Có được phép gửi kèm bản sao cho lượt gọi này không. Chỉ GET — xem ghi chú luật an toàn. */
function duocHedge(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET') return false;
  // Người gọi đã tự cầm tín hiệu huỷ (ví dụ streaming) thì đừng xen vào.
  if (init?.signal || (input instanceof Request && input.signal)) return false;
  return true;
}

/**
 * fetch có gửi kèm bản dự phòng cho câu ĐỌC.
 *
 * Truyền vào supabase-js qua `global.fetch` (xem lib/supabase/server.ts) chứ KHÔNG đặt toàn cục:
 * chỉ những lượt gọi tới Supabase mới cần, còn mọi thứ khác của Next giữ nguyên hành vi.
 */
export const fetchKemDuPhong: typeof fetch = async (input, init) => {
  if (!duocHedge(input, init)) return fetch(input, init);

  const boChinh = new AbortController();
  const boPhu = new AbortController();
  let xong = false;
  let henGio: ReturnType<typeof setTimeout> | undefined;

  const chay = (bo: AbortController) =>
    fetch(input, {...init, signal: bo.signal}).then((res) => {
      // Ai về trước thì huỷ người kia — nhưng chỉ huỷ SAU khi đã có phản hồi trong tay, để
      // không bao giờ tự huỷ mất bản duy nhất đang bay.
      xong = true;
      if (henGio) clearTimeout(henGio);
      (bo === boChinh ? boPhu : boChinh).abort();
      return res;
    });

  const chinh = chay(boChinh);

  const duPhong = new Promise<Response>((giai, tuChoi) => {
    henGio = setTimeout(() => {
      if (xong) return;
      chay(boPhu).then(giai, tuChoi);
    }, NGUONG_MS);
  });

  try {
    // Lấy bản nào về trước. Bản bị huỷ ném AbortError — Promise.any bỏ qua nhánh ném, chỉ khi
    // CẢ HAI cùng hỏng mới ném ra ngoài, và khi ấy ném đúng lỗi thật của bản chính.
    return await Promise.any([chinh, duPhong]);
  } catch (e) {
    if (henGio) clearTimeout(henGio);
    if (e instanceof AggregateError) throw e.errors[0] ?? e;
    throw e;
  } finally {
    if (henGio) clearTimeout(henGio);
  }
};
