import {isoWeekLabel, mondayOf, shiftWeeks, vnNoon, weekDaysVN} from './dates.ts';

// ════════════════════════════════════════════════════════════════════════════
// CHIA NHỊP — từ một mục tiêu năm, sinh ra mốc tháng và mốc tuần.
// ════════════════════════════════════════════════════════════════════════════
//
// Trước đây giáo viên phải khai TAY cả ba cấp: năm, rồi tháng, rồi tuần — và `lib/wig-tao.ts` còn
// bắt đúng thứ tự ấy (có năm mới tạo được tháng, có tháng mới tạo được tuần). Nhân 4 lĩnh vực là
// 12 lượt khai, mỗi lượt 6 ô, TRƯỚC khi có một việc nào để tick. Trên production ngày 11/08/2026
// chỉ đúng một lớp làm nổi chuyện đó, và lớp ấy tên "Test".
//
// Nay cô khai một lần cái đích của năm, app rải nó ra theo thời gian.
//
// ── CHIA THEO THỜI GIAN LÀ HỢP LỆ, CHIA THEO NGƯỜI THÌ KHÔNG ─────────────────────────────────
//
// Phân biệt này là cả mô hình mới. Chia 1200 bài cho 48 tuần là nói "tuần này lẽ ra tới đâu" —
// đó chính là Kỷ luật 3 của 4DX. Chia 1200 bài cho 3 em rồi ghi xuống bản ghi của từng em là giao
// chỉ tiêu, thứ canon gọi đích danh là dictate. Cái đầu ở đây; cái sau đã bị xoá cùng 0100.
//
// ── VÌ SAO SINH CẢ 52 TUẦN NGAY TỪ ĐẦU ───────────────────────────────────────────────────────
//
// Vì việc (lead measure) treo dưới WIG TUẦN. Không có sẵn WIG tuần thì mỗi lần muốn giao một việc,
// cô lại phải tạo một WIG tuần trước — đúng cái ma sát đang giết tính năng. Sinh sẵn thì cô mở
// tuần nào cũng có chỗ để gắn việc ngay.

export type MocNhip = {label: string; start: string; end: string; target: number};
export type Nhip = {thang: MocNhip[]; tuan: MocNhip[]};

/** Tháng theo lịch của một ngày, dạng nhãn 'YYYY-MM'. */
function nhanThang(day: string): string {
  return day.slice(0, 7);
}

/**
 * Rải `tong` đơn vị đều cho `n` mốc, KHÔNG để mốc nào bằng 0.
 *
 * Vì sao không để 0: cột `wigs.target_value` có CHECK `> 0`. Một mục tiêu năm nhỏ hơn số tuần
 * (ví dụ "đọc 20 cuốn sách" trong 48 tuần) mà chia đều thì phần lớn tuần ra 0 và cả loạt insert
 * đổ — trong khi ý định của cô hoàn toàn hợp lý. Nên khi không đủ chia, ta giao 1 cho những mốc
 * ĐẦU rồi dừng: 20 cuốn rơi vào 20 tuần đầu, các tuần sau không có mốc. Cô kéo lại sau nếu muốn.
 */
function raiDeu(tong: number, n: number): number[] {
  if (n <= 0 || tong <= 0) return [];
  const nen = Math.floor(tong / n);
  if (nen === 0) return Array.from({length: tong}, () => 1);
  const du = tong - nen * n;
  return Array.from({length: n}, (_, i) => nen + (i < du ? 1 : 0));
}

/**
 * Chia một mục tiêu năm thành mốc tháng + mốc tuần.
 *
 * `tong` là phần PHẢI ĐI THÊM, tức `target_value - baseline` — không phải target_value. Mốc tuần
 * đo lượng làm được TRONG tuần ấy (wig_actual lọc lead_progress theo start_date..end_date của
 * chính mốc), nên nếu rải cả phần đã có sẵn thì mọi mốc đều bị thổi lên.
 */
export function chiaNhip(start: string, end: string, tong: number): Nhip {
  if (!(tong > 0) || end < start) return {thang: [], tuan: []};

  // Mọi tuần (Thứ Hai → Chủ Nhật) có giao với [start, end], đã CẮT về trong khoảng.
  // Cắt là quan trọng: tuần đầu và tuần cuối của năm học thường bị hụt vài ngày, mà mốc thì phải
  // nằm gọn trong kỳ của cha — nếu không thì kiểm `chaPhuKy` ở nơi khác sẽ báo lệch.
  const khung: {start: string; end: string; label: string}[] = [];
  for (let t = mondayOf(start); t <= end; t = shiftWeeks(t, 1)) {
    const ngay = weekDaysVN(t);
    const s = ngay[0] < start ? start : ngay[0];
    const e = ngay[6] > end ? end : ngay[6];
    if (s > e) continue;
    khung.push({start: s, end: e, label: isoWeekLabel(vnNoon(ngay[0]))});
  }

  const phan = raiDeu(tong, khung.length);
  const tuan: MocNhip[] = khung
    .slice(0, phan.length)
    .map((k, i) => ({label: k.label, start: k.start, end: k.end, target: phan[i]}));

  // Mốc tháng = TỔNG các tuần thuộc nó, không chia lại từ đầu. Hai lý do:
  //   · tổng tháng luôn khớp tổng năm, không có sai số làm tròn nào lọt vào giữa;
  //   · một tuần vắt qua hai tháng chỉ được tính đúng một lần.
  // Tuần thuộc tháng nào thì tính theo ngày ĐẦU (đã cắt) của tuần ấy.
  const gom = new Map<string, MocNhip>();
  for (const w of tuan) {
    const nhan = nhanThang(w.start);
    const cu = gom.get(nhan);
    if (cu) {
      cu.target += w.target;
      if (w.end > cu.end) cu.end = w.end;
    } else {
      gom.set(nhan, {label: nhan, start: w.start, end: w.end, target: w.target});
    }
  }

  return {thang: [...gom.values()], tuan};
}

// ════════════════════════════════════════════════════════════════════════════
// NHỊP CỦA MỘT MỐC — mốc tuần CẦN bao nhiêu, việc đang giao CHO được bao nhiêu
// ════════════════════════════════════════════════════════════════════════════
//
// Mục tiêu của một VIỆC là mục tiêu CỦA MỖI EM (0098), nên trần mà cả lớp có thể đạt trong tuần
// là tổng mục tiêu các việc NHÂN sĩ số. So nó với mốc tuần thì ra ngay khoảng hụt.
//
// MỘT NGUỒN CHO HAI MÀN (0106). Công thức này trước nằm trong PhongHop.tsx, còn ViecTuan.tsx —
// chỗ cô THẬT SỰ gõ mục tiêu của việc (§6.1 bước 4) — thì không có cảnh báo nào. Chép sang là
// chép luôn cái bệnh "hai đường tính cho một khái niệm" mà repo đã dính một lần.
//
// NHÂN unit_per_tick: một lượt tick đáng bao nhiêu đơn vị của mục tiêu. private.wig_actual nhân
// hệ số này khi đọc, nên bản cũ ở PhongHop (không nhân) so hai vế khác thang: việc "đọc 1 buổi =
// 30 trang" bị đếm thành 1, và màn hình kêu hụt nhịp trong khi lớp đang thừa.
export function nhipCuaMoc({
  mocCan,
  siSo,
  viec,
}: {
  mocCan: number;
  siSo: number;
  viec: {target: number; upt?: number}[];
}): {mocCan: number; tongViecCho: number; thieuNhip: number} {
  const tongViecCho =
    viec.reduce((s, v) => s + (Number(v.target) || 0) * (Number(v.upt ?? 1) || 1), 0) * siSo;
  return {
    mocCan,
    tongViecCho: Math.round(tongViecCho),
    thieuNhip: tongViecCho > 0 && mocCan > 0 ? Math.round(mocCan - tongViecCho) : 0,
  };
}
