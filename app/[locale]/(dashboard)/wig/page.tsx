import {getTranslations, setRequestLocale} from 'next-intl/server';
import {AlertTriangle, ArrowRight, Users} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';
import {Link} from '@/i18n/navigation';
import {
  isValidDayVN,
  gioiHanChonKy,
  isoWeekLabel,
  mondayOf,
  monthOptions,
  schoolYearOptions,
  todayInVN,
  vnNoon,
  weekFromMonday,
  weekOptions,
  shiftWeeks,
} from '@/lib/dates';
import {WeekNav} from '@/components/wig/WeekNav';
import {TaoWigMenu} from '@/components/wig/TaoWigMenu';
import {ViecTuan, type ViecItem} from '@/components/wig/ViecTuan';
import {BangTienDo, type DongTienDo} from '@/components/wig/BangTienDo';
import {AREAS, buildAreaMeta, areaLabel, type Area} from '@/lib/areas';
import {Flash} from '@/components/ui/Flash';

// ════════════════════════════════════════════════════════════════════════════
// /wig — MÀN HÌNH LÀM VIỆC HẰNG TUẦN CỦA GIÁO VIÊN CHỦ NHIỆM
// ════════════════════════════════════════════════════════════════════════════
//
// Dựng lại 2026-08-04. Bản cũ có đủ mọi thứ nhưng bày ra cùng một lúc: form tạo WIG năm, form tạo
// WIG tuần lồng trong từng WIG năm, form thêm lead measure lồng trong từng WIG tuần, bảng tick,
// khối họp, khối tạo WIG cá nhân cho cả lớp, và ba đoạn văn giải thích. Chủ dự án nói nguyên văn:
// "tôi vào trang wig của giáo viên, sau đó tôi nhìn từ trên xuống 1 lượt thấy toàn là ô xếp dọc
// nhau, toàn là chữ, tôi không biết mình nên làm gì luôn".
//
// Ba việc của một tuần được tách ra ba màn, mỗi màn trả lời đúng một câu hỏi:
//
//   /wig            "Tuần này lớp đang làm gì, tới đâu rồi?"   ← màn này
//   /wig/chi-tiet   "Em nào chưa làm, quên hôm nào?"
//   /wig/hop        "Tuần vừa rồi thế nào, tuần tới làm gì?"   ← tạo luôn mục tiêu tuần mới
//
// Việc TẠO mục tiêu rút về một nút duy nhất ở góc phải (TaoWigMenu), có ràng buộc chuỗi
// năm → tháng → tuần. Không còn form nào nằm chờ sẵn trên trang.

type Wig = {
  id: string;
  title: string | null; // 0051 — nullable cho các WIG tạo trước khi có cột này
  baseline: number | null; // 0051 — mốc X trong "Từ X lên Y"
  area: string;
  period: string;
  period_label: string | null;
  parent_wig_id: string | null;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
};
type Lead = {
  id: string;
  wig_id: string;
  title: string;
  target_value: number;
  unit: string | null;
  sub_category: string | null;
  // 0073 — những thứ trong tuần mà việc này được tick (ISO 1=T2…7=CN).
  active_weekdays: number[] | null;
  // 0076 — một lượt tick đáng bao nhiêu ĐƠN VỊ CỦA WIG cha. Mặc định 1.
  unit_per_tick: number | null;
};
type Prog = {actual: number | null; pct: number | null; status: string | null};
type MatrixRow = {student_id: string; ticked_dates: string[] | null};

export default async function WigPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; week?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, week: weekParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('wig');
  const supabase = await createClient();
  const [{myClass, classes: accessible}, {data: areaCfg}] = await Promise.all([
    getClassContext(supabase, profile, classParam),
    supabase.from('area_config').select('*').order('sort_order'),
  ]);
  const areaMeta = buildAreaMeta(areaCfg);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  // ── TUẦN ĐANG XEM ─────────────────────────────────────────────────────────────────────────
  // Cả trang bám vào MỘT tuần, hiện rõ ở thanh WeekNav với dải ngày thật. Trước khi có nó, một
  // WIG đã đóng từ tuần trước và một WIG đang chạy trông giống hệt nhau — sự cố 7B1 (03/08/2026).
  //
  // isValidDayVN chặn chuỗi rác đến thẳng từ thanh địa chỉ trước khi mondayOf() dựng Date; Date
  // hỏng làm toISOString() ném lỗi → trắng cả trang. mondayOf chuẩn hoá về Thứ Hai vì các RPC bên
  // dưới KHÔNG tự ép — chúng lấy nguyên cửa sổ [ngày truyền vào, +6].
  const todayVN = todayInVN();
  const thisMonday = mondayOf(todayVN);
  const monday = isValidDayVN(weekParam) ? mondayOf(weekParam as string) : thisMonday;
  const wk = weekFromMonday(monday);
  const laTuanNay = monday === thisMonday;
  // Chỉ đính ?week= khi ĐANG XEM tuần khác — ở tuần hiện tại thì URL sạch.
  const weekQ = laTuanNay ? '' : monday;
  // Tuần vừa kết thúc: đây là tuần buổi họp sẽ tổng kết.
  const tuanTruoc = shiftWeeks(thisMonday, -1);
  const nhanTuanTruoc = isoWeekLabel(vnNoon(tuanTruoc));

  const [{data: wigsData}, {data: progData}, {data: enrolled}, {data: matrixData}, {data: hopRoi}] =
    await Promise.all([
      // NHÚNG LUÔN lead_measures: PostgREST nhúng được theo khoá ngoại wig_id và RLS vẫn áp y như
      // khi hỏi rời, nên bỏ hẳn một chặng chờ so với hỏi WIG xong mới hỏi việc.
      supabase
        .from('wigs')
        .select(
          'id, title, baseline, area, period, period_label, parent_wig_id, target_value, unit, start_date, end_date, lead_measures(id, wig_id, title, target_value, unit, sub_category, active_weekdays, unit_per_tick)',
        )
        .eq('class_id', myClass.id)
        .eq('scope', 'class'),
      // Tiến độ: chỉ những mục tiêu thật sự được vẽ ra — năm, tháng, và tuần đang xem.
      supabase
        .from('wig_progress_v')
        .select('wig_id, actual, pct, status')
        .eq('class_id', myClass.id)
        .eq('scope', 'class')
        .or(
          `period.in.(year,month),and(period.eq.week,start_date.lte.${wk.end},end_date.gte.${wk.start})`,
        ),
      supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', myClass.id)
        .eq('is_active', true),
      // Ma trận (em × việc) của tuần đang xem — chỉ để đếm "mấy em chưa tick lần nào". Đó là con
      // số DUY NHẤT trên màn này đòi hành động ngay, nên đáng một lượt hỏi; phần chi tiết ai quên
      // hôm nào thì nằm ở /wig/chi-tiet.
      supabase.rpc('class_tick_matrix', {p_class: myClass.id, p_week_start: monday}),
      // Tuần vừa xong đã họp chưa — quyết định câu chữ trên nút mở phòng họp.
      supabase
        .from('wig_meetings')
        .select('id')
        .eq('class_id', myClass.id)
        .is('student_id', null)
        .eq('week_start', tuanTruoc)
        .maybeSingle(),
    ]);

  const studentCount = (enrolled ?? []).length;
  const wigsKemLead = (wigsData ?? []) as unknown as (Wig & {lead_measures: Lead[] | null})[];
  const wigs = wigsKemLead as Wig[];
  const progByWig = new Map((progData ?? []).map((p) => [p.wig_id, p as unknown as Prog]));

  // Một mục tiêu tuần thuộc về tuần đang xem khi khoảng ngày của nó GIAO với tuần đó.
  // ĐÚNG luật của class_lead_board (0073), cố ý chép cho khớp: dùng chung một luật là cách duy
  // nhất bảo đảm thứ GVCN thấy trùng khít thứ học sinh thấy — hai luật khác nhau là gốc sự cố 7B1.
  // Cùng vị ngữ ấy áp cho mục tiêu THÁNG: tháng nào phủ tuần đang xem thì đó là tháng của tuần
  // này. Một hàm, không phải hai bản chép tay — hai bản là hai cơ hội trôi khỏi nhau.
  const trongTuan = (w: Wig) => w.start_date <= wk.end && w.end_date >= wk.start;

  const yearWigs = wigs
    .filter((w) => w.period === 'year')
    .sort((a, b) => a.area.localeCompare(b.area));
  const monthWigs = wigs.filter((w) => w.period === 'month');
  const weekWigs = wigs.filter((w) => w.period === 'week' && trongTuan(w));

  // ── MẤY EM CHƯA TICK LẦN NÀO ──────────────────────────────────────────────────────────────
  // Tuần chưa bắt đầu thì KHÔNG báo động: chưa tới ngày nào để tick, đỏ ở đây là báo động giả và
  // làm nhờn cảnh báo thật của tuần đang chạy.
  const matrix = (matrixData ?? []) as MatrixRow[];
  const theoEm = new Map<string, number>();
  for (const m of matrix) {
    theoEm.set(m.student_id, (theoEm.get(m.student_id) ?? 0) + (m.ticked_dates ?? []).length);
  }
  const daGop = [...theoEm.values()].filter((n) => n > 0).length;
  const coViecTrongTuan = matrix.length > 0;
  const chuaLam = coViecTrongTuan ? theoEm.size - daGop : 0;
  const tuanChuaToi = monday > todayVN;

  // ── CẢNH BÁO ĐẶT SAI (0076/0078) ──────────────────────────────────────────────────────────
  // Tính tại chỗ thay vì gọi RPC lead_measure_canh_bao: mọi dữ liệu cần đã nằm trong `wigs` vừa
  // lấy về. Hàm SQL kia vẫn giữ — scripts/test-* dùng nó làm nguồn đối chiếu ĐỘC LẬP, hai bên
  // lệch nhau là phép kiểm báo ngay.
  //
  // Bỏ dấu tiếng Việt khi so đơn vị: production có cả 'buoi' lẫn 'buổi' trong cùng một cột (dữ
  // liệu cũ gõ không dấu) mà chúng là một thứ. Phải khớp private.bo_dau() trong 0078.
  const boDau = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
      .toLowerCase();

  const canhBaoLead = (l: Lead, w: Wig) => {
    const moiTick = Number(l.unit_per_tick ?? 1) || 1;
    // LÀM TRÒN TRƯỚC KHI ceil. CSDL tính bằng numeric thập phân chính xác, JavaScript bằng số
    // thực nhị phân — với hệ số 0.7 thì 21/0.7 ra 30.000000000000004 và Math.ceil biến nó thành
    // 31 trong khi Postgres nói 30. Lệch một đơn vị ấy đủ để bật cảnh báo đỏ trên một mục tiêu
    // đặt vừa khít, giục giáo viên hạ một con số đang đúng.
    const soTickCan = Math.ceil(Number((Number(l.target_value) / moiTick).toFixed(9)));
    // Số ngày THẬT SỰ tick được — đúng luật RLS dùng để chặn tick (lead_day_ok, 0073).
    const thu = new Set(l.active_weekdays ?? [1, 2, 3, 4, 5, 6, 7]);
    let soNgay = 0;
    for (const d = new Date(`${w.start_date}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > w.end_date) break;
      if (thu.has(d.getUTCDay() === 0 ? 7 : d.getUTCDay())) soNgay += 1;
    }
    // TRẦN PHẢI NHÂN SỐ NGƯỜI: cả lớp cùng tick vào một việc nên trần là "số ngày × sĩ số".
    // Bản đầu quên vế này — 7B1 chỉ có 3 em nên 7×3=21 vẫn nhỏ hơn mục tiêu 30 và cảnh báo vẫn
    // đúng, lỗi ẩn sau một lớp nhỏ. Lớp 24 em thì trần là 168 và mọi mục tiêu từ 8 tới 168 bị
    // kêu oan. Báo động giả tệ hơn không báo.
    const soNguoi = studentCount > 0 ? studentCount : 1;
    const tran = soNgay * soNguoi;
    return {
      soTickCan,
      soNgay,
      soNguoi,
      tran,
      // Hai đơn vị khác nhau mà hệ số vẫn để 1 → đang cộng cái nọ vào cái kia.
      lechDonVi:
        Boolean(l.unit) && Boolean(w.unit) && boDau(l.unit!) !== boDau(w.unit) && moiTick === 1,
      quaNhieu: soTickCan > tran,
    };
  };

  const viecCuaWig = (w: Wig): ViecItem[] =>
    ((wigsKemLead.find((x) => x.id === w.id)?.lead_measures ?? []) as Lead[]).map((l) => {
      const cb = canhBaoLead(l, w);
      return {
        id: l.id,
        title: l.title,
        target_value: Number(l.target_value),
        unit: l.unit,
        sub_category: l.sub_category,
        active_weekdays: l.active_weekdays,
        unit_per_tick: l.unit_per_tick,
        quaNhieu: cb.quaNhieu,
        lechDonVi: cb.lechDonVi,
        soTickCan: cb.soTickCan,
        tran: cb.tran,
        soNgay: cb.soNgay,
        soNguoi: cb.soNguoi,
      };
    });

  // ── CỘT PHẢI: NĂM → THÁNG → TUẦN ──────────────────────────────────────────────────────────
  // Mỗi mục tiêu năm một nhóm ba dòng. Cấp nào chưa có thì vẫn chiếm một dòng ghi "chưa đặt" —
  // ẩn đi thì cái thiếu trở nên vô hình, mà cái thiếu mới là việc cần làm tiếp.
  const dongCua = (w: Wig | undefined, cap: DongTienDo['cap'], khiTrong: string): DongTienDo => {
    if (!w) {
      return {
        id: null,
        cap,
        title: khiTrong,
        periodLabel: null,
        baseline: null,
        target: 0,
        unit: '',
        actual: 0,
        pct: 0,
        status: null,
      };
    }
    const p = progByWig.get(w.id);
    return {
      id: w.id,
      cap,
      title: w.title ?? areaLabel(areaMeta[w.area as Area], locale),
      periodLabel: w.period_label,
      baseline: w.baseline == null ? null : Number(w.baseline),
      target: Number(w.target_value),
      unit: w.unit,
      actual: Number(p?.actual ?? 0),
      pct: Number(p?.pct ?? 0),
      status: p?.status ?? null,
    };
  };

  // "CHƯA ĐẶT" KHÁC VỚI "ĐÃ ĐẶT NHƯNG CHO THÁNG KHÁC".
  //
  // Bảng này chỉ nhận mục tiêu tháng PHỦ LÊN tuần đang xem. Đúng luật — nhưng chủ dự án tạo mục
  // tiêu cho tháng 9 trong lúc đang đứng ở tuần đầu tháng 8, và bảng báo thẳng "chưa đặt mục tiêu
  // tháng". Cùng lúc đó tab "Tuần" ở nút Tạo lại MỞ, vì nó chỉ hỏi "lớp có mục tiêu tháng nào
  // không" bất kể tháng nào. Hai câu hỏi khác nhau trên cùng một màn hình, và người đọc thấy đúng
  // một điều: app vừa nói nó không có, vừa xử sự như nó có.
  //
  // Cách sửa KHÔNG phải là nới luật trongTuan — luật ấy đang giữ cho màn giáo viên và màn học
  // sinh cắt ra cùng một kết quả (sự cố 7B1). Mà là nói cho đủ: có thì bảo có, kèm kỳ của nó.
  const kyGanNhat = (ds: Wig[]): Wig | undefined =>
    [...ds].sort((a, b) => a.start_date.localeCompare(b.start_date)).find((w) => w.end_date >= wk.start) ??
    [...ds].sort((a, b) => b.end_date.localeCompare(a.end_date))[0];

  const nhomTienDo = yearWigs.map((yw) => {
    const thangCuaNam = monthWigs.filter((m) => m.parent_wig_id === yw.id);
    const thang = thangCuaNam.find(trongTuan);
    // Không có tháng nào phủ tuần này, nhưng lớp CÓ mục tiêu tháng: lấy cái gần nhất để nói ra.
    const thangKhac = thang ? undefined : kyGanNhat(thangCuaNam);
    const thangIds = new Set(thangCuaNam.map((m) => m.id));
    // Tuần có thể treo dưới THÁNG (luật mới) hoặc thẳng dưới NĂM (dữ liệu cũ) — nhận cả hai,
    // nếu không thì mục tiêu tuần đang chạy của các lớp cũ biến mất khỏi cột này.
    const tuan = weekWigs.find(
      (w) => w.parent_wig_id === yw.id || (w.parent_wig_id != null && thangIds.has(w.parent_wig_id)),
    );
    const meta = areaMeta[yw.area as Area];
    return {
      areaLabel: areaLabel(meta, locale),
      areaHex: meta.hex,
      areaSoft: meta.soft,
      dong: [
        dongCua(yw, 'year', t('emptyYear')),
        dongCua(
          thang,
          'month',
          thangKhac
            ? t('monthOtherPeriod', {label: thangKhac.period_label ?? ''})
            : t('emptyMonth'),
        ),
        dongCua(tuan, 'week', t('emptyWeek')),
      ],
    };
  });

  // Kỳ chọn sẵn trong menu tạo: theo TUẦN ĐANG XEM chứ không theo hôm nay. Đứng ở tuần sau mà bấm
  // tạo thì kỳ chọn sẵn phải là tuần sau — trước đây nó luôn nhảy về tuần hiện tại nên tạo xong
  // lại ra một mục tiêu rơi vào tuần khác với tuần đang nhìn.
  const neo = vnNoon(monday);
  const namOptions = schoolYearOptions(2, neo);
  const thangOptions = monthOptions(1, 4, neo);
  const tuanOptions = weekOptions(2, 4, neo);
  const kyMacDinh = {
    year: namOptions[0]?.label ?? '',
    month: thangOptions[1]?.label ?? thangOptions[0]?.label ?? '',
    week: wk.label,
  };
  const areaOptions = AREAS.map((a) => ({value: a, label: areaLabel(areaMeta[a], locale)}));

  const q = (extra: Record<string, string> = {}) => ({
    ...(classParam ? {class: classParam} : {}),
    ...(weekQ ? {week: weekQ} : {}),
    ...extra,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {/* Quản trị/BGH thấy bộ chọn KỂ CẢ khi chỉ có một lớp: nó là chỗ duy nhất trên màn hình
            nói rõ mình đang đứng ở lớp nào. Giáo viên chỉ có lớp mình thì giấu đi cho gọn. */}
        {(accessible.length > 1 || profile.role === 'admin' || profile.role === 'principal') && (
          <ClassPicker classes={accessible} current={myClass.id} />
        )}
        <ClassOwnerNote classId={myClass.id} viewerId={profile.id} viewerRole={profile.role} />
        <TaoWigMenu
          classId={myClass.id}
          areas={areaOptions}
          namOptions={namOptions}
          thangOptions={thangOptions}
          tuanOptions={tuanOptions}
          // Danh sách cha xếp theo NGÀY BẮT ĐẦU, không theo thứ tự tạo: lớp tạo mục tiêu tháng 9
          // trước rồi tháng 8 sau thì danh sách đọc thành 9, 8 — và cái đứng đầu lại là cái xa
          // hôm nay nhất. Menu tự chọn cha phủ kỳ đang đứng (xem TaoWigMenu), thứ tự này chỉ để
          // người đọc thấy đúng dòng thời gian.
          wigNam={[...yearWigs].sort((a, b) => a.start_date.localeCompare(b.start_date)).map((w) => ({
            id: w.id,
            title: w.title ?? areaLabel(areaMeta[w.area as Area], locale),
            start_date: w.start_date,
            end_date: w.end_date,
          }))}
          wigThang={[...monthWigs].sort((a, b) => a.start_date.localeCompare(b.start_date)).map((w) => ({
            id: w.id,
            title: `${w.title ?? t('month')} · ${w.period_label ?? ''}`,
            start_date: w.start_date,
            end_date: w.end_date,
          }))}
          gioiHan={gioiHanChonKy()}
          kyMacDinh={kyMacDinh}
        />
      </div>

      <Flash />

      <WeekNav
        monday={monday}
        thisMonday={thisMonday}
        label={wk.label}
        start={wk.start}
        end={wk.end}
        classParam={classParam}
      />

      {/* 2/3 — 1/3: bên trái là việc của tuần này (thứ phải làm), bên phải là lớp đang đi tới đâu
          (thứ phải biết). Chủ dự án chốt đúng tỉ lệ này. */}
      <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
        <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[15px] font-bold text-navy">{t('goalThisWeek')}</h2>
            <Link
              href={{pathname: '/wig/chi-tiet', query: q()}}
              className="ml-auto inline-flex items-center gap-1 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
            >
              {t('detail')}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          {weekWigs.length === 0 ? (
            <div className="rounded-[14px] border-[1.5px] border-dashed border-navy/20 p-5 text-center">
              <p className="text-[13px] font-bold text-navy">{t('noWeekWigsThisWeek', {label: wk.label})}</p>
              <p className="mx-auto mt-1 max-w-[420px] text-[11.5px] font-semibold leading-relaxed text-grey-mid">
                {monthWigs.length === 0 ? t('noWeekWigsHow') : t('noWeekWigsHowMeeting')}
              </p>
            </div>
          ) : (
            weekWigs.map((w) => {
              const p = progByWig.get(w.id);
              const pct = Math.round(Number(p?.pct ?? 0) * 100);
              const viec = viecCuaWig(w);
              return (
                <div key={w.id} className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-display text-[16px] font-bold text-navy">
                      {w.title ?? t('week')}
                    </span>
                    {/* Mục tiêu này GIAO với tuần đang xem nhưng hai đầu mốc không trùng khít
                        Thứ Hai → Chủ Nhật. Đây chính là cái bẫy đã cắn: màn hình học sinh cắt
                        theo tuần lịch, nên phải nói thẳng thay vì để người đọc tự đối chiếu. */}
                    {(w.start_date !== wk.start || w.end_date !== wk.end) && (
                      <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                        {t('weekDateOff', {start: w.start_date, end: w.end_date})}
                      </span>
                    )}
                    <span className="ml-auto text-[14px] font-extrabold tabular-nums text-navy">
                      {Number(p?.actual ?? 0)} / {w.target_value} {w.unit}
                    </span>
                  </div>
                  {w.baseline != null && (
                    <p className="-mt-1.5 text-[11.5px] font-semibold text-grey-mid">
                      {t('from')} {Number(w.baseline)} → {w.target_value} {w.unit}
                    </p>
                  )}
                  <div className="h-[10px] w-full overflow-hidden rounded-[6px] bg-navy/[0.08]">
                    <div
                      className="h-full rounded-[6px]"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background:
                          p?.status === 'on_track'
                            ? 'var(--color-success)'
                            : p?.status === 'off_track'
                              ? 'var(--color-status-bad)'
                              : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
                      }}
                    />
                  </div>

                  <h3 className="mt-1 font-display text-[13.5px] font-bold text-navy">
                    {t('workToTick')}
                  </h3>
                  <ViecTuan
                    wigId={w.id}
                    wigUnit={w.unit}
                    viec={viec}
                    dayShort={t.raw('dayShort') as string[]}
                    weekParam={weekQ}
                    classParam={classParam}
                  />
                </div>
              );
            })
          )}

          {/* Một dòng duy nhất tổng kết cả lớp — và chỉ hiện khi nó có nghĩa. */}
          {coViecTrongTuan && !tuanChuaToi && (
            <p className="flex flex-wrap items-center gap-1.5 border-t border-navy/[0.08] pt-3 text-[12px] font-semibold text-grey-mid">
              <Users size={13} strokeWidth={2.5} className="shrink-0" />
              {t('tickSummary', {n: daGop, total: theoEm.size})}
              {chuaLam > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[11px] font-extrabold text-status-bad">
                  <AlertTriangle size={11} strokeWidth={2.5} />
                  {t('tickBoardSilent', {n: chuaLam})}
                </span>
              )}
            </p>
          )}
          {tuanChuaToi && (
            <p className="border-t border-navy/[0.08] pt-3 text-[12px] font-semibold text-grey-mid">
              {t('tickBoardNotStarted')}
            </p>
          )}
        </section>

        <section className="glass rounded-[20px] p-[18px]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-navy">{t('progressRail')}</h2>
          <BangTienDo nhom={nhomTienDo} weekParam={weekQ} classParam={classParam} />
        </section>
      </div>

      {/* MỘT NÚT. Nhịp họp là việc quan trọng nhất của tuần trong 4DX, và trước đây nó là một khối
          dài chôn giữa trang cùng năm khối khác. Nay đứng riêng, không lẫn vào đâu được. */}
      <Link
        href={{pathname: '/wig/hop', query: q()}}
        className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[20px] bg-[linear-gradient(180deg,#2f3170,#26275d)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_28px_-6px_rgba(38,39,93,0.5)] ring-1 ring-white/10 transition-transform hover:-translate-y-px"
      >
        <span className="min-w-0">
          <span className="block font-display text-[17px] font-bold text-white">
            {hopRoi ? t('meetingDone', {week: nhanTuanTruoc}) : t('meetingTime')}
          </span>
          <span className="mt-0.5 block text-[12.5px] font-semibold leading-relaxed text-white/70">
            {t('meetingWhat', {truoc: nhanTuanTruoc, sau: isoWeekLabel(vnNoon(thisMonday))})}
          </span>
        </span>
        <span className="btn-gold ml-auto inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[12px] px-4 font-display text-[13.5px] font-black">
          {hopRoi ? t('meetingReopen') : t('meetingOpen')}
          <ArrowRight size={15} strokeWidth={2.8} />
        </span>
      </Link>
    </div>
  );
}
