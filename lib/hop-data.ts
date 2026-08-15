import {shiftWeeks, weekFromMonday} from '@/lib/dates';
import type {createClient} from '@/lib/supabase/server';
import type {ViecTuanQua, EmTrongTuan, EmHop, ViecMau, WigOption} from '@/components/wig/PhongHop';
import {tenHienThi} from '@/lib/ten-hien-thi';

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
  // area — để biết việc này thuộc LĨNH VỰC nào khi mang sang tuần tới (0106: mỗi lĩnh vực một
  // khối). KHÔNG dùng wig_id: board là của tuần VỪA XONG (hopMonday), còn khối cần khớp là mốc
  // tuần TỚI (dichWk) — hai tuần là hai WIG khác id dù cùng lĩnh vực. Lĩnh vực mới là thứ bền.
  area: string;
  // 0122 — việc nay treo dưới CAM KẾT; board trả kèm để buổi họp gom việc theo đúng cam kết mẹ.
  commitment_id: string;
  commitment_title: string;
  verdict: string | null;
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
  /** CẢ LỚP — mỗi em một dòng để buổi họp hỏi lại "tuần này con làm gì" và ghi biên bản riêng. */
  emHop: EmHop[];
  loiHuaTruoc: string | null;
  chiemNghiemCu: string;
  camKetCu: string;
  // Tuần này đã có biên bản chưa. Chính dòng ấy là thứ khoá tick (0081), nên phòng họp phải biết
  // để bày đường gỡ — không có nó thì họp nhầm tuần là khoá tick một tuần đang chạy, không lối ra.
  daCoBienBan: boolean;
  /** Buổi họp đã được bấm CHỐT chưa — thứ thật sự khoá tick và số đo của tuần (0108). */
  daChot: boolean;
  // CAM KẾT CỦA TUẦN VỪA QUA — thứ buổi họp chấm V/X. `goiY` là gợi ý của máy: đủ mọi việc dẫn
  // dắt thì gợi thắng. Gợi ý KHÔNG tự thành kết quả; người bấm mới là kết quả (0121).
  camKetTuanQua: {
    id: string;
    title: string;
    area: string;
    verdict: 'win' | 'lose' | null;
    goiY: 'win' | 'lose';
    viecXong: number;
    viecTong: number;
  }[];
  /** Cam kết ĐÃ đặt cho tuần tới — để mở lại buổi họp không đẻ bản sao. */
  camKetDich: {id: string; title: string; wigId: string}[];
  /** Mục tiêu NĂM đang chạy — danh sách để chọn khi đặt cam kết. */
  namHienCo: WigOption[];
  // BẢNG PDR (0126) — ba con số PRD đòi, cho TỪNG em, của đúng tuần đang tổng kết. Không phải
  // màn hình mới: chủ dự án chốt "dashboard pdr chính là cái trang họp wig bên gv đó".
  bangPdr: {
    id: string;
    ten: string;
    camKetTong: number;
    camKetDat: number;
    viecTong: number;
    viecDat: number;
    soLanSua: number;
    chamKhacMay: number;
  }[];
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

  const [
    {data: boardData},
    {data: matrixData},
    {data: ghiChu},
    {data: bienBan},
    {data: bienBanTruoc},
    {data: wigData},
    {data: emRows},
    {data: mucTieuEmRows},
    {data: bienBanEmRows},
    {data: ckTuanQua},
    {data: ckDich},
    {data: pdrRows},
  ] = await Promise.all([
      supabase.rpc('class_lead_board', {p_class: classId, p_week_start: hopMonday}),
      supabase.rpc('class_tick_matrix', {p_class: classId, p_week_start: hopMonday}),
      supabase
        .from('wig_meeting_notes')
        .select('lead_measure_id, verdict, note')
        .eq('class_id', classId)
        .eq('week_start', hopMonday),
      supabase
        .from('wig_meetings')
        .select('results, commitments, chot_at')
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
        .eq('scope', 'class')
        // Phòng họp chấm thắng/thua TỪNG TUẦN. Mục tiêu cuộn là con số của cả năm và không có
        // mốc tuần nào, nên đứng ở đây nó chỉ làm dài thêm bảng mà không ai chấm được.
        .neq('measure_by', 'cuon'),

      // ── BA CÂU CHO KHỐI "TỪNG EM" (0108, lát 4+5) ──────────────────────────────────────
      //
      // CẢ LỚP, không chỉ những em có tên trong bảng tick. Buổi họp phải hỏi được MỌI em "tuần này
      // con làm gì" — kể cả em chưa đặt mục tiêu, vì đó chính là em cần hỏi nhất.
      supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(full_name, email)')
        .eq('class_id', classId)
        .eq('is_active', true),
      // Mục tiêu năm của từng em kèm VIỆC treo dưới nó. `lead_measures` là mảng vì PostgREST trả
      // quan hệ 1-nhiều; trigger chan_viec_thu_hai (0100) đảm bảo tối đa một phần tử.
      supabase
        .from('wigs')
        .select('id, student_id, kind, lead_measures(id, title, target_value, unit, active_weekdays)')
        .eq('class_id', classId)
        .eq('scope', 'student')
        .eq('period', 'year'),
      // Biên bản CÁ NHÂN của tuần đang họp. Cùng bảng với biên bản lớp, khác nhau ở student_id.
      supabase
        .from('wig_meetings')
        .select('student_id, results, commitments')
        .eq('class_id', classId)
        .eq('week_start', hopMonday)
        .not('student_id', 'is', null),
      // CAM KẾT của lớp: tuần vừa qua (để chấm V/X) và tuần tới (để mở lại không đẻ bản sao).
      supabase
        .from('commitments')
        .select('id, title, area, verdict')
        .eq('class_id', classId)
        .is('student_id', null)
        .eq('week_start', hopMonday),
      supabase
        .from('commitments')
        .select('id, title, wig_id')
        .eq('class_id', classId)
        .is('student_id', null)
        .eq('week_start', dichWk.start),
      supabase.rpc('pdr_bang', {p_class: classId, p_week: hopMonday}),
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
  // ── TỪNG EM: việc tuần này + biên bản riêng ───────────────────────────────────────────────
  //
  // Dựng từ DANH SÁCH LỚP chứ không từ bảng tick: bảng tick chỉ có những em đã được giao việc, mà
  // em chưa có việc nào mới là em buổi họp cần hỏi trước nhất.
  const viecTheoEm = new Map<string, {wigId: string; leadId: string | null; title: string; unit: string | null; days: number[]}>();
  for (const w of (mucTieuEmRows ?? []) as unknown as {
    id: string;
    student_id: string | null;
    kind: string | null;
    lead_measures: {id: string; title: string; target_value: number; unit: string | null; active_weekdays: number[] | null}[] | null;
  }[]) {
    // Chỉ mục tiêu HỌC TẬP mang việc để tick; mục tiêu riêng là chuyện của em, buổi họp không giao.
    if (!w.student_id || w.kind !== 'academic') continue;
    const lm = w.lead_measures?.[0] ?? null;
    viecTheoEm.set(w.student_id, {
      wigId: w.id,
      leadId: lm?.id ?? null,
      title: lm?.title ?? '',
      unit: lm?.unit ?? null,
      days: lm?.active_weekdays ?? [1, 3, 5],
    });
  }
  const bbTheoEm = new Map<string, {results: string; commitments: string}>();
  for (const b of (bienBanEmRows ?? []) as unknown as {
    student_id: string | null;
    results: string | null;
    commitments: string | null;
  }[]) {
    if (b.student_id) bbTheoEm.set(b.student_id, {results: b.results ?? '', commitments: b.commitments ?? ''});
  }
  const emHop: EmHop[] = (
    (emRows ?? []) as unknown as {student_id: string; profiles: {full_name: string | null; email: string | null} | null}[]
  )
    .map((e) => {
      const vi = viecTheoEm.get(e.student_id);
      const bb = bbTheoEm.get(e.student_id);
      return {
        id: e.student_id,
        // Một luật tên duy nhất cho cả app (lib/ten-hien-thi.ts). Trước đây chỗ này rơi về
        // dấu gạch "—": cô nhìn một ô trống trong buổi họp và không biết đang ghi cho ai.
        ten: tenHienThi(e.profiles?.full_name, e.profiles?.email),
        wigId: vi?.wigId ?? null,
        leadId: vi?.leadId ?? null,
        viecTitle: vi?.title ?? '',
        viecUnit: vi?.unit ?? null,
        viecDays: vi?.days ?? [1, 3, 5],
        ketQua: bb?.results ?? '',
        camKet: bb?.commitments ?? '',
      };
    })
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

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
    emHop,
    // Vòng cam kết của 4DX: đặt lời hứa tuần trước cạnh kết quả là đủ để buổi họp tự đối chiếu.
    // Đọc CAM KẾT trước, next_actions chỉ là đường lùi cho biên bản cũ (trước khi mục tiêu tuần
    // sau trở thành một WIG thật thay vì một ô chữ).
    loiHuaTruoc:
      (bienBanTruoc?.commitments ?? '').trim() || (bienBanTruoc?.next_actions ?? '').trim() || null,
    chiemNghiemCu: bienBan?.results ?? '',
    camKetCu: bienBan?.commitments ?? '',
    daCoBienBan: Boolean(bienBan),
    // ĐÃ CHỐT hay CHƯA là hai chuyện khác nhau với "đã có biên bản" (0108). Lưu bao nhiêu lần cũng
    // được; tuần chỉ khoá — hết tick, hết nhập số đo — khi có người bấm chốt.
    daChot: Boolean(bienBan?.chot_at),
    // GỢI Ý V/X: đủ MỌI việc dẫn dắt của cam kết thì gợi thắng. Cùng một luật với cam_ket_goi_y()
    // ở CSDL (0121) — tính lại ở đây từ bảng việc đã có sẵn thay vì bắn thêm một câu hỏi cho mỗi
    // cam kết, nhưng luật thì phải giống hệt, nếu không màn hình gợi một đằng CSDL hiểu một nẻo.
    camKetTuanQua: ((ckTuanQua ?? []) as {id: string; title: string; area: string; verdict: string | null}[]).map(
      (c) => {
        const viec = board.filter((r) => r.commitment_id === c.id);
        const xong = viec.filter((r) => Number(r.class_total) >= Number(r.target_value)).length;
        return {
          id: c.id,
          title: c.title,
          area: c.area,
          verdict: c.verdict === 'win' || c.verdict === 'lose' ? c.verdict : null,
          goiY: (viec.length > 0 && xong === viec.length ? 'win' : 'lose') as 'win' | 'lose',
          viecXong: xong,
          viecTong: viec.length,
        };
      },
    ),
    camKetDich: ((ckDich ?? []) as {id: string; title: string; wig_id: string}[]).map((c) => ({
      id: c.id,
      title: c.title,
      wigId: c.wig_id,
    })),
    bangPdr: ((pdrRows ?? []) as {
      student_id: string;
      student_name: string;
      cam_ket_tong: number;
      cam_ket_dat: number;
      viec_tong: number;
      viec_dat: number;
      so_lan_sua: number;
      cham_khac_may: number;
    }[]).map((r) => ({
      id: r.student_id,
      ten: r.student_name,
      camKetTong: Number(r.cam_ket_tong),
      camKetDat: Number(r.cam_ket_dat),
      viecTong: Number(r.viec_tong),
      viecDat: Number(r.viec_dat),
      soLanSua: Number(r.so_lan_sua),
      chamKhacMay: Number(r.cham_khac_may),
    })),
    namHienCo: wigs
      .filter((w) => w.period === 'year' && phuDich(w))
      .map((w) => ({id: w.id, title: w.title ?? w.period_label ?? nhan.year})),
    // 4DX bảo thước đo dẫn dắt phải bền — đổi mỗi tuần thì không đo được xu hướng gì. Nên mặc
    // định là chép lại việc của tuần vừa rồi, còn sửa hay xoá thì tuỳ buổi họp.
    //
    // MANG THEO area — 0106: PhongHop nay bày MỘT KHỐI CHO MỖI LĨNH VỰC, nên việc mang sang phải
    // biết mình thuộc lĩnh vực nào để khớp đúng khối. Thiếu nó thì việc của Thể chất trôi vào
    // khối Kiến thức.
    viecMau: board.map((r) => ({
      title: r.title,
      target: String(Number(r.target_value)),
      unit: r.unit ?? '',
      upt: String(Number(r.unit_per_tick ?? 1)),
      days: (r.active_weekdays ?? [1, 2, 3, 4, 5]).map(Number),
      area: r.area,
    })),
  };
}
