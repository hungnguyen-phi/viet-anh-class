import {shiftWeeks, weekFromMonday} from '@/lib/dates';
import type {createClient} from '@/lib/supabase/server';
import type {ViecTuanQua, EmTrongTuan, ViecMau, WigOption} from '@/components/wig/PhongHop';

type Sb = Awaited<ReturnType<typeof createClient>>;

// ════════════════════════════════════════════════════════════════════════════
// DỮ LIỆU CỦA MỘT BUỔI HỌP WIG — lấy ở MỘT chỗ cho cả hai lối vào.
// ════════════════════════════════════════════════════════════════════════════
//
// Hai trang mở cùng một buổi họp: /wig/hop (giáo viên chủ nhiệm, ghi được) và /meeting (ban giám
// hiệu, chỉ đọc). Trước đây mỗi trang tự dựng lấy, và chúng ĐÃ trôi khỏi nhau thật — bản trong
// /wig có ô "ngày chốt tick", bản ở /meeting không; bản này lọc theo ngày, bản kia theo nhãn.
// Ban giám hiệu mở ra đọc một con số khác với con số giáo viên vừa họp, mà không ai biết.
//
// Đặt ở lib/ để cả hai trang gọi cùng một hàm. Lệch nhau thì phải lệch ở đây, tức là không lệch.

// Đơn vị đếm người ở cột kết quả — tách hằng để không rải chữ trong chuỗi ghép.
const DON_VI_EM = 'em đủ';

type BoardRow = {
  lead_measure_id: string;
  title: string;
  target_value: number | string;
  unit: string | null;
  active_weekdays: number[] | null;
  unit_per_tick: number | string | null;
  class_total: number | string;
  contributors: number | string;
  class_size: number | string;
  // 0098 — số em đã đạt ĐỦ phần của mình. Đây mới là con số quyết định thắng/thua của một việc.
  students_done: number | string;
};

type MatrixRow = {
  student_id: string;
  student_name: string;
  lead_measure_id: string;
  active_weekdays: number[] | null;
  ticked_dates: string[] | null;
};

type W = {
  id: string;
  title: string | null;
  area: string;
  period: string;
  period_label: string | null;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
};

export type DuLieuHop = {
  hop: {start: string; end: string; label: string};
  dich: {start: string; end: string; label: string};
  truocMonday: string;
  viecTuanQua: ViecTuanQua[];
  tungEm: EmTrongTuan[];
  loiHuaTruoc: string | null;
  chiemNghiemCu: string;
  camKetCu: string;
  // Tuần này đã có biên bản chưa. Chính dòng ấy là thứ khoá tick (0081), nên phòng họp phải biết
  // để bày đường gỡ — không có nó thì họp nhầm tuần là khoá tick một tuần đang chạy, không lối ra.
  daCoBienBan: boolean;
  // MỐC TUẦN ĐÍCH — app đã rải sẵn khi cô khai mục tiêu năm (lib/wig-nhip.ts), mỗi lĩnh vực một
  // cái. Buổi họp CHỈNH nó, không tạo mới: trong 4DX mục tiêu đặt một lần cho cả kỳ, còn buổi họp
  // chỉ báo cáo → nhìn bảng điểm → dọn đường. Xem docs/MO_HINH_WIG.md §6.4.
  mocDich: {id: string; area: string; title: string; target: number; unit: string}[];
  // Chỉ dùng khi mốc tuần đích BỊ THIẾU — cô khai mục tiêu năm sau khi tuần ấy đã trôi qua, nên
  // nhịp không phủ tới. Để BÙ đúng một mốc, không phải để đẻ mục tiêu mới.
  namHienCo: WigOption[];
  viecMau: ViecMau[];
};

export async function layDuLieuHop(
  supabase: Sb,
  classId: string,
  hopMonday: string,
  nhan: {year: string; month: string; week: string},
): Promise<DuLieuHop> {
  const hopWk = weekFromMonday(hopMonday);
  // Mục tiêu đặt ra trong buổi họp thuộc về TUẦN KẾ TIẾP tuần đang tổng kết. Lùi ← để họp bù một
  // tuần cũ thì đích cũng lùi theo, nên không bao giờ đặt mục tiêu nhầm tuần.
  const dichWk = weekFromMonday(shiftWeeks(hopMonday, 1));
  const truocMonday = shiftWeeks(hopMonday, -1);

  const [{data: boardData}, {data: matrixData}, {data: ghiChu}, {data: bienBan}, {data: bienBanTruoc}, {data: wigData}] =
    await Promise.all([
      supabase.rpc('class_lead_board', {p_class: classId, p_week_start: hopMonday}),
      supabase.rpc('class_tick_matrix', {p_class: classId, p_week_start: hopMonday}),
      supabase
        .from('wig_meeting_notes')
        .select('lead_measure_id, verdict, note')
        .eq('class_id', classId)
        .eq('week_start', hopMonday),
      supabase
        .from('wig_meetings')
        .select('results, commitments')
        .eq('class_id', classId)
        .is('student_id', null)
        .eq('week_start', hopMonday)
        .maybeSingle(),
      supabase
        .from('wig_meetings')
        .select('commitments, next_actions')
        .eq('class_id', classId)
        .is('student_id', null)
        .eq('week_start', truocMonday)
        .maybeSingle(),
      // Mọi mục tiêu của lớp — để biết có năm nào, tháng nào phủ tuần đích, và tuần đích đã có
      // mục tiêu chưa. Một câu thay ba.
      supabase
        .from('wigs')
        .select('id, title, area, period, period_label, target_value, unit, start_date, end_date')
        .eq('class_id', classId)
        .eq('scope', 'class'),
    ]);

  const board = (boardData ?? []) as BoardRow[];
  const matrix = (matrixData ?? []) as MatrixRow[];
  const noteById = new Map(
    ((ghiChu ?? []) as {lead_measure_id: string; verdict: string | null; note: string | null}[]).map(
      (r) => [r.lead_measure_id, r],
    ),
  );

  const viecTuanQua: ViecTuanQua[] = board.map((r) => {
    const gc = noteById.get(r.lead_measure_id);
    return {
      id: r.lead_measure_id,
      title: r.title,
      // KẾT QUẢ CỦA MỘT VIỆC = BAO NHIÊU EM ĐÃ ĐỦ (0098), không phải tổng tick của cả lớp.
      //
      // Mục tiêu nay là của MỖI EM, nên "2/3 bài" của bản cũ trả lời sai câu hỏi mà buổi họp đặt
      // ra: lớp có làm được việc này không. Hai em mỗi em tick một lượt thì tổng là 2, trông như
      // gần xong, trong khi thật ra CHƯA EM NÀO đủ.
      ketQua: `${Number(r.students_done)}/${Number(r.class_size)} ${DON_VI_EM}`,
      daGop: Number(r.contributors),
      siSo: Number(r.class_size),
      verdict: gc?.verdict === 'win' || gc?.verdict === 'lose' ? gc.verdict : null,
      note: gc?.note ?? '',
      daCo: Boolean(gc),
    };
  });

  // ── TỪNG EM LÀM ĐƯỢC BAO NHIÊU ──────────────────────────────────────────────────────────
  // Mẫu số là số ô em ĐÁNG LẼ tick được trong tuần ấy: với mỗi việc, đếm những ngày trong tuần
  // có thứ nằm trong active_weekdays. Cùng luật RLS dùng để chặn tick (lead_day_ok, 0073), nên
  // đây là trần thật — không phải "7 ngày × số việc" cho mọi trường hợp.
  const soNgayApDung = (thu: number[] | null) => {
    const on = new Set(thu ?? [1, 2, 3, 4, 5, 6, 7]);
    let n = 0;
    for (const d = new Date(`${hopWk.start}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > hopWk.end) break;
      if (on.has(d.getUTCDay() === 0 ? 7 : d.getUTCDay())) n += 1;
    }
    return n;
  };
  const theoEm = new Map<string, {ten: string; lam: number; can: number}>();
  for (const m of matrix) {
    const cur = theoEm.get(m.student_id) ?? {ten: m.student_name, lam: 0, can: 0};
    cur.lam += (m.ticked_dates ?? []).length;
    cur.can += soNgayApDung(m.active_weekdays);
    theoEm.set(m.student_id, cur);
  }
  // Em làm ít nhất đứng đầu — buổi họp hỏi "ai chưa làm", đừng bắt giáo viên dò ba mươi cái tên.
  const tungEm: EmTrongTuan[] = [...theoEm.entries()]
    .map(([id, x]) => ({id, ...x}))
    .sort(
      (a, b) =>
        (a.can > 0 ? a.lam / a.can : 0) - (b.can > 0 ? b.lam / b.can : 0) ||
        a.ten.localeCompare(b.ten, 'vi'),
    );

  const wigs = (wigData ?? []) as W[];
  const phuDich = (w: W) => w.start_date <= dichWk.end && w.end_date >= dichWk.start;

  return {
    hop: hopWk,
    dich: dichWk,
    truocMonday,
    viecTuanQua,
    tungEm,
    // Vòng cam kết của 4DX: đặt lời hứa tuần trước cạnh kết quả là đủ để buổi họp tự đối chiếu.
    // Đọc CAM KẾT trước, next_actions chỉ là đường lùi cho biên bản cũ (trước khi mục tiêu tuần
    // sau trở thành một WIG thật thay vì một ô chữ).
    loiHuaTruoc:
      (bienBanTruoc?.commitments ?? '').trim() || (bienBanTruoc?.next_actions ?? '').trim() || null,
    chiemNghiemCu: bienBan?.results ?? '',
    camKetCu: bienBan?.commitments ?? '',
    daCoBienBan: Boolean(bienBan),
    mocDich: wigs
      .filter((w) => w.period === 'week' && w.period_label === dichWk.label)
      .map((w) => ({
        id: w.id,
        area: w.area,
        title: w.title ?? nhan.week,
        target: Number(w.target_value),
        unit: w.unit,
      })),
    namHienCo: wigs
      .filter((w) => w.period === 'year' && phuDich(w))
      .map((w) => ({id: w.id, title: w.title ?? w.period_label ?? nhan.year})),
    // 4DX bảo thước đo dẫn dắt phải bền — đổi mỗi tuần thì không đo được xu hướng gì. Nên mặc
    // định là chép lại việc của tuần vừa rồi, còn sửa hay xoá thì tuỳ buổi họp.
    viecMau: board.map((r) => ({
      title: r.title,
      target: String(Number(r.target_value)),
      unit: r.unit ?? '',
      upt: String(Number(r.unit_per_tick ?? 1)),
      days: (r.active_weekdays ?? [1, 2, 3, 4, 5]).map(Number),
    })),
  };
}
