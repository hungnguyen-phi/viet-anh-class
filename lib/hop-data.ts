import {shiftWeeks, weekFromMonday} from '@/lib/dates';
import {kieuDonVi} from '@/lib/don-vi';
import type {createClient} from '@/lib/supabase/server';
import type {CamKetHop, EmHop, WigOption} from '@/components/wig/PhongHop';
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
//
// ── MỘT TRỤC DUY NHẤT: CAM KẾT (16/08/2026) ──────────────────────────────────────────────────
//
// Bản trước dựng buổi họp từ BỐN nguồn không nối nhau: class_lead_board (việc chung, đếm "em đủ"),
// class_tick_matrix (từng em tick việc chung), pdr_bang (ba con số), và biên bản riêng — rồi bày
// thành bốn khối rời: "Việc chung", "Từng em 0/8", "Bảng PDR", "Từng em: Tuần rồi / Tuần tới hứa".
// Chủ dự án đọc thành "rất rời rạc và thừa mà ko có tính liên kết chặt chẽ nào".
//
// Nay đọc thẳng bảng `commitments` của tuần đang họp, kèm việc và tick treo dưới. Cam kết của LỚP
// (student_id null) và cam kết của TỪNG EM là cùng một hình: lời hứa → việc → tick → V/X. Mọi con
// số trên màn (việc đạt mấy/mấy, cam kết thắng mấy/mấy, đã đổi mấy lần) đều suy từ đúng một mảng
// này, nên không còn hai bảng nói hai số khác nhau về cùng một em.

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

// Một dòng commitments kèm việc và tick — đúng hình PostgREST trả về khi nhúng hai tầng.
type CkRow = {
  id: string;
  student_id: string | null;
  title: string;
  area: string;
  verdict: string | null;
  so_lan_sua: number | null;
  lead_measures:
    | {
        id: string;
        title: string;
        target_value: number | string;
        unit: string | null;
        unit_per_tick: number | string | null;
        lead_progress:
          | {student_id: string | null; value: number | string | null; logged_date: string}[]
          | null;
      }[]
    | null;
};

export type DuLieuHop = {
  hop: {start: string; end: string; label: string};
  dich: {start: string; end: string; label: string};
  /** Cam kết của LỚP tuần đang họp — chấm V/X ở đây. */
  camKetLop: CamKetHop[];
  /** CẢ LỚP — mỗi em một dòng: cam kết + việc + tick của em, và năm câu em tự viết. */
  tungEm: EmHop[];
  chiemNghiemCu: string;
  // Tuần này đã có biên bản chưa. Chính dòng ấy là thứ khoá tick (0081), nên phòng họp phải biết
  // để bày đường gỡ — không có nó thì họp nhầm tuần là khoá tick một tuần đang chạy, không lối ra.
  daCoBienBan: boolean;
  /** Buổi họp đã được bấm CHỐT chưa — thứ thật sự khoá tick và số đo của tuần (0108). */
  daChot: boolean;
  // PHÒNG ĐANG MỞ CHƯA (0130). Cô bấm "Bắt đầu họp" là mở; bấm "Kết thúc" là đóng. Màn của em
  // nghe đúng dấu này để hiện lời mời vào phòng.
  phongMo: boolean;
  /** Cam kết ĐÃ đặt cho tuần tới — để mở lại buổi họp không đẻ bản sao. */
  camKetDich: {id: string; title: string; wigId: string}[];
  /** Mục tiêu NĂM đang chạy — danh sách để chọn khi đặt cam kết. */
  namHienCo: WigOption[];
};

// Từ một dòng commitments ra hình mà phòng họp bày. `cuaAi` = null với cam kết lớp (đếm tick của
// cô — student_id null), = id em với cam kết riêng (đếm tick của chính em).
function docCamKet(c: CkRow, cuaAi: string | null, tuan: string, den: string): CamKetHop {
  const viec = (c.lead_measures ?? []).map((lm) => {
    const target = Number(lm.target_value) || 0;
    // ĐẾM ĐÚNG LUẬT GỘP (audit 18/08/2026): bản cũ đếm SỐ DÒNG tick — sai với đơn vị 'do' (điểm,
    // kg: lấy số MỚI NHẤT) và với việc nhập-lượng (viết 15 bài trong 1 dòng value=15, ×hệ số).
    // Cùng luật cam_ket_goi_y (0121) và myTotal (StudentScoreboard): lọc tick TRONG TUẦN, đơn vị
    // 'do' lấy giá trị mới nhất theo ngày, còn lại cộng value × unit_per_tick.
    const upt = Number(lm.unit_per_tick) || 1;
    const tick = (lm.lead_progress ?? []).filter(
      (p) => (p.student_id ?? null) === cuaAi && p.logged_date >= tuan && p.logged_date <= den,
    );
    let dat: number;
    if (kieuDonVi(lm.unit ?? '') === 'do') {
      const moiNhat = tick.slice().sort((a, b) => b.logged_date.localeCompare(a.logged_date))[0];
      dat = moiNhat ? Number(moiNhat.value) || 0 : 0;
    } else {
      dat = tick.reduce((s, p) => s + (Number(p.value) || 0), 0) * upt;
    }
    return {id: lm.id, title: lm.title, unit: lm.unit, dat, target, xong: target > 0 && dat >= target};
  });
  const xong = viec.filter((v) => v.xong).length;
  return {
    id: c.id,
    title: c.title,
    area: c.area,
    verdict: c.verdict === 'win' || c.verdict === 'lose' ? c.verdict : null,
    // GỢI Ý V/X: đủ MỌI việc dẫn dắt của cam kết thì gợi thắng. Cùng một luật với cam_ket_goi_y()
    // ở CSDL (0121) — tính lại ở đây từ dữ liệu đã có sẵn, nhưng luật thì phải giống hệt.
    goiY: viec.length > 0 && xong === viec.length ? 'win' : 'lose',
    viec,
    soLanSua: Number(c.so_lan_sua ?? 0),
  };
}

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

  const [{data: bienBan}, {data: wigData}, {data: emRows}, {data: bienBanEmRows}, {data: ckRows}, {data: ckDich}] =
    await Promise.all([
      supabase
        .from('wig_meetings')
        .select('results, chot_at, mo_luc')
        .eq('class_id', classId)
        .is('student_id', null)
        .eq('week_start', hopMonday)
        .maybeSingle(),
      // Mọi mục tiêu của lớp — để biết tuần đích có mục tiêu năm nào để treo cam kết. Không lấy
      // mục tiêu cuộn: nó là con số cả năm, không có gì để hứa theo tuần.
      supabase
        .from('wigs')
        .select('id, title, area, period, period_label, target_value, unit, start_date, end_date')
        .eq('class_id', classId)
        .eq('scope', 'class')
        .neq('measure_by', 'cuon'),
      // CẢ LỚP, không chỉ những em có cam kết. Buổi họp phải nhìn được MỌI em — kể cả em chưa hứa
      // gì tuần này, vì đó chính là em cần hỏi nhất.
      supabase
        .from('enrollments')
        .select('student_id, profiles!enrollments_student_id_fkey(full_name, email)')
        .eq('class_id', classId)
        .eq('is_active', true),
      // NĂM CÂU EM TỰ VIẾT trong phòng họp của em (/student/hop, 0111/0130). Cô đọc, không sửa.
      //
      // Sắp theo hs_go_luc giảm dần: cùng một em cùng một tuần mà có hai dòng (nhãn tuần khác
      // nhau — đã gặp với dữ liệu gieo) thì dòng EM TỰ GÕ đứng trước và thắng.
      supabase
        .from('wig_meetings')
        .select('student_id, results, commitments, kho_khan, vuot_qua, cach_tot_hon, tham_gia_luc, hs_go_luc')
        .eq('class_id', classId)
        .eq('week_start', hopMonday)
        .not('student_id', 'is', null)
        .order('hs_go_luc', {ascending: false, nullsFirst: false}),
      // TRỤC CHÍNH: mọi cam kết của tuần đang họp — lớp lẫn từng em — kèm việc và tick.
      supabase
        .from('commitments')
        .select(
          'id, student_id, title, area, verdict, so_lan_sua, lead_measures(id, title, target_value, unit, unit_per_tick, lead_progress(student_id, value, logged_date))',
        )
        .eq('class_id', classId)
        .eq('week_start', hopMonday)
        .order('created_at'),
      supabase
        .from('commitments')
        .select('id, title, wig_id')
        .eq('class_id', classId)
        .is('student_id', null)
        .eq('week_start', dichWk.start),
    ]);

  const ck = (ckRows ?? []) as unknown as CkRow[];
  // Biên tuần đang họp [Thứ Hai, Chủ Nhật] để lọc tick — cùng khung cam_ket_goi_y (0121).
  const tuanDen = hopWk.end;
  const camKetLop = ck.filter((c) => !c.student_id).map((c) => docCamKet(c, null, hopMonday, tuanDen));
  const ckTheoEm = new Map<string, CamKetHop[]>();
  for (const c of ck) {
    if (!c.student_id) continue;
    ckTheoEm.set(c.student_id, [...(ckTheoEm.get(c.student_id) ?? []), docCamKet(c, c.student_id, hopMonday, tuanDen)]);
  }

  const traLoiTheoEm = new Map<string, EmHop['traLoi'] & {thamGia: boolean}>();
  for (const b of (bienBanEmRows ?? []) as unknown as {
    student_id: string | null;
    results: string | null;
    commitments: string | null;
    kho_khan: string | null;
    vuot_qua: string | null;
    cach_tot_hon: string | null;
    tham_gia_luc: string | null;
  }[]) {
    if (!b.student_id || traLoiTheoEm.has(b.student_id)) continue;
    traLoiTheoEm.set(b.student_id, {
      khoKhan: b.kho_khan ?? '',
      vuotQua: b.vuot_qua ?? '',
      cachTotHon: b.cach_tot_hon ?? '',
      ketQua: b.results ?? '',
      camKet: b.commitments ?? '',
      // 0130 — em đã bấm "Tham gia" chưa. Chỉ để cô biết ai đang ngồi trong phòng; không phải
      // điều kiện để em điền, vì chủ dự án chốt "điền sau cũng được".
      thamGia: Boolean(b.tham_gia_luc),
    });
  }

  const tungEm: EmHop[] = (
    (emRows ?? []) as unknown as {student_id: string; profiles: {full_name: string | null; email: string | null} | null}[]
  )
    .map((e) => {
      const tl = traLoiTheoEm.get(e.student_id);
      return {
        id: e.student_id,
        // Một luật tên duy nhất cho cả app (lib/ten-hien-thi.ts).
        ten: tenHienThi(e.profiles?.full_name, e.profiles?.email),
        camKet: ckTheoEm.get(e.student_id) ?? [],
        traLoi: {
          khoKhan: tl?.khoKhan ?? '',
          vuotQua: tl?.vuotQua ?? '',
          cachTotHon: tl?.cachTotHon ?? '',
          ketQua: tl?.ketQua ?? '',
          camKet: tl?.camKet ?? '',
        },
        thamGia: tl?.thamGia ?? false,
      };
    })
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));

  const wigs = (wigData ?? []) as W[];
  const phuDich = (w: W) => w.start_date <= dichWk.end && w.end_date >= dichWk.start;

  return {
    hop: hopWk,
    dich: dichWk,
    camKetLop,
    tungEm,
    chiemNghiemCu: bienBan?.results ?? '',
    daCoBienBan: Boolean(bienBan),
    // ĐÃ CHỐT hay CHƯA là hai chuyện khác nhau với "đã có biên bản" (0108). Lưu bao nhiêu lần cũng
    // được; tuần chỉ khoá — hết tick, hết nhập số đo — khi có người bấm chốt.
    daChot: Boolean(bienBan?.chot_at),
    phongMo: Boolean(bienBan?.mo_luc) && !bienBan?.chot_at,
    camKetDich: ((ckDich ?? []) as {id: string; title: string; wig_id: string}[]).map((c) => ({
      id: c.id,
      title: c.title,
      wigId: c.wig_id,
    })),
    namHienCo: wigs
      .filter((w) => w.period === 'year' && phuDich(w))
      .map((w) => ({id: w.id, title: w.title ?? w.period_label ?? nhan.year})),
  };
}
