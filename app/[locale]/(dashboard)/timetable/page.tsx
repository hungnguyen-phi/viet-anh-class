import {getTranslations, setRequestLocale} from 'next-intl/server';
import {CalendarDays, MapPin, UserRound, ArrowRight, Plus} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext, getChildren, conDangXem} from '@/lib/queries';
import {todayInVN, weekRangeVN} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {TietProvider, NutTiet} from '@/components/timetable/OTiet';
import {OverrideForm} from './OverrideForm';
import {deleteSlot, deleteOverride, seedSubjects} from './actions';
import {KhuCLBCoSo} from '@/components/timetable/KhuCLBCoSo';
import {GioTietForm, type GioTiet} from '@/components/timetable/GioTietForm';
import {NhapHangLoat} from '@/components/timetable/NhapHangLoat';
import {SaoChepTkb} from '@/components/timetable/SaoChepTkb';
import {TkbHomNay, type NgayTkb} from '@/components/timetable/TkbHomNay';
import {Flash} from '@/components/ui/Flash';
import {ConfirmButton} from '@/components/ui/ConfirmButton';

const DAYS = [2, 3, 4, 5, 6, 7, 8]; // T2..CN — PRD v3 #14 thêm Chủ Nhật (8 = CN, xem migration 0144)
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

type Slot = {
  id: string;
  day_of_week: number;
  period_no: number;
  // Cột chữ CŨ (trước 0069 là ô gõ tay). Giữ lại CHỈ để hiện những dòng cũ chưa có subject_id —
  // không dòng mã nào ghi vào đây nữa, xem quyết định E của migration 0069.
  subject: string | null;
  subject_id: string | null;
  // Tên môn lấy thẳng từ danh mục qua khoá ngoại. Đây mới là nguồn sự thật.
  subjects: {name: string; short_name: string} | null;
  room: string | null;
  teacher_name: string | null;
  kind: string;
  start_time: string | null;
  end_time: string | null;
};
// Một môn trong chương trình của lớp (class_subjects → subjects).
type MonHoc = {id: string; name: string; short_name: string; sort_order: number; is_active: boolean};
type Override = {
  id: string;
  slot_id: string;
  date: string;
  status: string;
  new_date: string | null;
  new_period_no: number | null;
  substitute_name: string | null;
  note: string | null;
};

// Màu theo loại tiết — theo yêu cầu: thi = vàng, thực hành = xanh lá, còn lại = navy nhạt.
// Dùng token brand (gold / success / navy) chứ không màu tự phát.
const KIND_STYLE: Record<string, {box: string; dot: string}> = {
  exam: {box: 'border-gold/60 bg-gold/[0.18]', dot: 'bg-gold-deep'},
  practice: {box: 'border-success/40 bg-success/[0.12]', dot: 'bg-success'},
  regular: {box: 'border-navy/12 bg-navy/[0.05]', dot: 'bg-navy/40'},
};

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; child?: string; week?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, child: childParam, week: weekParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  const t = await getTranslations('timetable');
  const supabase = await createClient();

  // ===== Phụ huynh: con nào, lớp nào =====
  //
  // Trang này trước đây KHÔNG có chỗ đổi con. Bố mẹ hai đứa ở hai lớp mở Thời khoá biểu ra là
  // thấy lịch của một đứa — và là đứa đầu theo THỨ TỰ UUID, tức khác với đứa mà /báo bài, /học bạ
  // và /báo cáo đang mở (ba trang ấy sắp theo TÊN). Bốn mục menu, hai đứa trẻ, không màn hình nào
  // nói ra là vừa đổi người.
  const laPhuHuynh = profile.role === 'parent';
  const children = laPhuHuynh ? await getChildren(supabase) : [];
  const con = conDangXem(children, childParam);
  const {myClass, classes: accessible} = await getClassContext(
    supabase,
    profile,
    laPhuHuynh ? con?.classId : classParam,
  );
  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  // Hiệu trưởng cũng quản lý được TKB của cơ sở mình (xem migration 0057).
  const canManage =
    profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'principal';
  // CLB do BGH/Admin điều phối (liên lớp) — GVCN không quản. RLS cc_manage là chốt thật.
  const quanClb = profile.role === 'admin' || profile.role === 'principal';

  // ===== Tuần đang xem =====
  // TKB là mẫu tuần lặp, nhưng huỷ/dời/dạy thay là chuyện của NGÀY cụ thể → phải có ngữ cảnh tuần.
  // ?week=YYYY-MM-DD (bất kỳ ngày trong tuần đó); mặc định tuần hiện tại theo giờ VN.
  const today = todayInVN();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? '') ? weekParam! : today;
  const {start: weekStart} = weekRangeVN(new Date(`${anchor}T00:00:00Z`));
  const dateOf = (dow: number) => {
    // weekStart là Thứ Hai (dow=1 trong ISO); DAYS dùng 2..7 = T2..T7 nên lệch 2.
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (dow - 2));
    return d.toISOString().slice(0, 10);
  };
  const shiftWeek = (deltaDays: number) => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
  };
  const weekDates = DAYS.map(dateOf);
  const rangeLabel = `${weekDates[0].slice(5)} → ${weekDates[weekDates.length - 1].slice(5)}`;

  const [{data: slotData}, {data: overData}, {data: monData}, {data: gioData}] = await Promise.all([
    supabase
      .from('timetable_slots')
      // Nhặt luôn tên môn từ danh mục trong CÙNG một truy vấn — hỏi riêng bảng subjects là thêm
      // một chặng mạng mà chẳng biết thêm gì.
      .select('id, day_of_week, period_no, subject, subject_id, room, teacher_name, kind, start_time, end_time, subjects(name, short_name)')
      .eq('class_id', myClass.id),
    // Ngoại lệ của TUẦN ĐANG XEM. Lọc theo dải ngày → không tải cả năm.
    supabase
      .from('timetable_overrides')
      .select('id, slot_id, date, status, new_date, new_period_no, substitute_name, note')
      .gte('date', weekDates[0])
      .lte('date', weekDates[weekDates.length - 1]),
    // Chương trình của lớp = nguồn DUY NHẤT cho ô chọn môn (0069 mục B). Chỉ hỏi khi người xem
    // có quyền sửa: học sinh và phụ huynh không thấy form nào, hỏi thêm là tốn một chặng mạng
    // cho không (đúng bài học ở roster/page.tsx:91).
    canManage
      ? supabase
          .from('class_subjects')
          .select('subjects(id, name, short_name, sort_order, is_active)')
          .eq('class_id', myClass.id)
          .eq('is_active', true)
      : Promise.resolve({data: null}),
    // Khung giờ tiết (0149): "Tiết 3" nói được là mấy giờ — ai đọc lưới cũng cần.
    supabase
      .from('class_period_times')
      .select('period_no, start_time, end_time')
      .eq('class_id', myClass.id)
      .order('period_no'),
  ]);
  const slots = (slotData ?? []) as unknown as Slot[];
  // Môn đã ngừng dùng (is_active = false) vẫn còn trong chương trình lớp nhưng KHÔNG được chọn
  // tiếp — DB cũng chặn ở subject_fits_class, chặn sẵn ở đây để khỏi báo lỗi khó hiểu.
  const monLop = ((monData ?? []) as unknown as {subjects: MonHoc | null}[])
    .map((r) => r.subjects)
    .filter((m): m is MonHoc => !!m && m.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'));
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const byKey = new Map(slots.map((s) => [`${s.day_of_week}-${s.period_no}`, s]));
  // RLS tto_read đã giới hạn theo lớp, nhưng lọc lại theo slot của lớp đang xem cho chắc
  // (người dùng có thể quản nhiều lớp).
  const overrides = ((overData ?? []) as Override[]).filter((o) => slotById.has(o.slot_id));
  const overByKey = new Map(overrides.map((o) => [`${o.slot_id}|${o.date}`, o]));

  const dayLabel = (d: number) => (d === 8 ? t('sun') : d === 7 ? t('sat') : `${t('dayShort')}${d}`);
  // Khung giờ theo tiết — Postgres trả 'HH:MM:SS', màn hình chỉ cần HH:MM.
  const hhmm = (x: string) => String(x).slice(0, 5);
  const gioTiet: GioTiet = Object.fromEntries(
    (gioData ?? []).map((g) => [g.period_no, {tu: hhmm(g.start_time), den: hhmm(g.end_time)}]),
  );
  const cellInput =
    'w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-2.5 text-than font-semibold text-navy outline-none focus:border-navy';

  // TÊN MÔN ĐỂ HIỆN. Đọc từ danh mục; dòng cũ còn subject_id NULL thì hiện tạm chữ cũ — chỉ để
  // không mất dữ liệu đang có, KHÔNG phải để ghi tiếp vào cột đó.
  const tenMon = (s: Slot) => s.subjects?.name ?? s.subject ?? '—';
  // Bản NGẮN cho ô lưới: ô một tiết rộng chưa tới 90px nên "Giáo dục kinh tế và pháp luật" bị CSS
  // cắt cụt. Cột short_name sinh ra chính vì lý do đó (xem comment trong migration 0069).
  const tenMonNgan = (s: Slot) => s.subjects?.short_name ?? s.subject ?? '—';

// (CLB tách sang bảng theo cơ sở — xem KhuCLBCoSo. Lưới chính khoá không còn kind='club'.)

  const slotOptions = slots
    .slice()
    .filter((s) => s.kind !== 'club') // ngoại lệ huỷ/dời/dạy thay là chuyện của TIẾT chính khoá
    .sort((a, b) => a.day_of_week - b.day_of_week || a.period_no - b.period_no)
    .map((s) => ({
      id: s.id,
      label: `${dayLabel(s.day_of_week)} · ${t('period')} ${s.period_no} · ${tenMon(s)}`,
      date: dateOf(s.day_of_week),
    }));

  // Nhãn cho hộp thoại sửa ô — dựng ở máy chủ, xem ghi chú đầu components/timetable/OTiet.tsx.
  const nhanTiet = {
    them: t('addSlot'),
    sua: t('editSlot'),
    mon: t('subject'),
    phong: t('room'),
    giaoVien: t('teacher'),
    loaiTiet: t('kindLabel'),
    luu: t('save'),
    huy: t('cancel'),
    loai: (['regular', 'practice', 'exam'] as const).map((k) => ({value: k, label: t(`kind_${k}`)})),
    apDung: t('applyDays'),
    cacThu: DAYS.map((d) => ({value: d, label: dayLabel(d)})),
  };
  const monChon = monLop.map((m) => ({id: m.id, name: m.name}));
  // Toạ độ của ô, gói sẵn cho hộp thoại: bấm ô nào thì thứ/tiết của ô đó đi theo.
  const oCua = (d: number, p: number, s?: Slot) => ({
    day: d,
    period: p,
    nhanO: `${dayLabel(d)} · ${t('period')} ${p}`,
    slot: s
      ? {subjectId: s.subject_id, room: s.room, teacher: s.teacher_name, kind: s.kind}
      : null,
  });

  // LƯỚI TUẦN dựng MỘT lần, dùng ở hai chỗ: màn rộng, và trong "Cả tuần" của máy hẹp.
  const luoi = (
      <div className="glass overflow-x-auto rounded-[20px] p-2">
        <div className="min-w-[1000px]">
          <div className="flex">
            {/* CỘT "TIẾT" DÍNH LẠI KHI CUỘN NGANG.
                Lưới này rộng 860px và là lưới HAI CHIỀU — không xuống thẻ được như các bảng
                khác, nên trên máy 360px bắt buộc phải cuộn ngang, và audit mobile 2026-08-06 cho
                thấy chỉ nhìn được T2 với T3 trong sáu ngày. Cuộn sang T5 thì cột số tiết trôi
                mất, người xem không còn biết ô đang nhìn là tiết mấy — mà đó chính là toạ độ
                thứ hai của mỗi ô. sticky giữ nó lại; nền trắng để chữ bên dưới không lộ qua. */}
            <div className="sticky left-0 z-10 w-14 shrink-0 bg-white px-2 py-2 text-nhan font-extrabold uppercase text-grey-mid">
              {t('period')}
            </div>
            {DAYS.map((d, i) => (
              <div key={d} className={`flex-1 rounded-t-[10px] px-2 py-2 text-center ${weekDates[i] === today ? 'bg-gold/[0.14]' : ''}`}>
                <div className="text-chu-thich font-extrabold text-navy">
                  {dayLabel(d)}
                  {weekDates[i] === today && (
                    <span className="ml-1 rounded-full bg-gold px-1.5 py-px align-middle text-nhan font-black uppercase text-navy">
                      {t('today')}
                    </span>
                  )}
                </div>
                <div
                  className={`text-chu-thich font-bold ${
                    weekDates[i] === today ? 'text-gold-text' : 'text-grey-mid'
                  }`}
                >
                  {weekDates[i].slice(5)}
                </div>
              </div>
            ))}
          </div>
          {PERIODS.map((p) => (
            <div key={p} className="flex border-t border-navy/[0.08]">
              <div className="sticky left-0 z-10 flex w-14 shrink-0 flex-col items-center justify-center bg-white leading-tight">
                <span className="text-than font-bold text-grey-mid">{p}</span>
                {gioTiet[p] && (
                  <span className="text-chu-thich font-bold tabular-nums text-grey-mid/80">
                    {gioTiet[p].tu}
                    <br />
                    {gioTiet[p].den}
                  </span>
                )}
              </div>
              {DAYS.map((d, i) => {
                const s = byKey.get(`${d}-${p}`);
                const ov = s ? overByKey.get(`${s.id}|${weekDates[i]}`) : undefined;
                const style = KIND_STYLE[s?.kind ?? 'regular'] ?? KIND_STYLE.regular;
                return (
                  <div key={d} className={`min-w-0 flex-1 p-1.5 ${weekDates[i] === today ? 'bg-gold/[0.07]' : ''}`}>
                    {s ? (
                      <div
                        className={`relative rounded-[8px] border-[1.5px] px-2 py-1.5 ${style.box} ${
                          ov?.status === 'cancelled' ? 'opacity-55' : ''
                        }`}
                      >
                        {/* CẢ Ô LÀ NÚT SỬA. Trước đây chỉ mỗi tên môn là liên kết, và nó điền
                            sẵn một khung nhập tận cuối trang — xa chỗ vừa bấm đến mức người
                            dùng không nối được hai thứ với nhau. Nay bấm vào ô là hộp thoại
                            của đúng ô ấy mở ra tại chỗ. */}
                        <NutTiet
                          o={oCua(d, p, s)}
                          title={`${t('editSlot')} · ${tenMon(s)}`}
                          className="block w-full cursor-pointer text-left"
                        >
                          <span
                            title={tenMon(s)}
                            className={`flex min-h-[24px] items-center truncate text-than font-bold text-navy ${
                              ov?.status === 'cancelled' ? 'line-through' : ''
                            }`}
                          >
                            {tenMonNgan(s)}
                          </span>
                          {(s.room || s.teacher_name) && (
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-chu-thich font-semibold text-grey-mid">
                              {s.room && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MapPin size={12} strokeWidth={2.5} />
                                  {s.room}
                                </span>
                              )}
                              {s.teacher_name && (
                                <span className="inline-flex min-w-0 items-center gap-0.5">
                                  <UserRound size={12} strokeWidth={2.5} />
                                  <span className="truncate">{s.teacher_name}</span>
                                </span>
                              )}
                            </span>
                          )}
                        </NutTiet>
                        {/* Ngoại lệ của đúng ngày này */}
                        {ov && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {ov.status === 'cancelled' && (
                              <span className="rounded-full bg-status-bad/[0.14] px-1.5 py-0.5 text-chu-thich font-extrabold text-status-bad">
                                {t('ovCancelled')}
                              </span>
                            )}
                            {ov.status === 'substituted' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-navy/[0.10] px-1.5 py-0.5 text-chu-thich font-extrabold text-navy">
                                {t('ovSubstituted')}: {ov.substitute_name}
                              </span>
                            )}
                            {ov.status === 'moved' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-navy/[0.10] px-1.5 py-0.5 text-chu-thich font-extrabold text-navy">
                                <ArrowRight size={12} strokeWidth={2.5} />
                                {ov.new_date?.slice(5)} · {t('period')} {ov.new_period_no}
                              </span>
                            )}
                          </div>
                        )}
                        {canManage && (
                          <form action={deleteSlot} className="absolute right-1 top-1">
                            <input type="hidden" name="class_id" value={myClass.id} />
                            <input type="hidden" name="id" value={s.id} />
                            {/* PHẢI HỎI LẠI. Lưới này có 48 ô, mỗi ô một dấu ✕ đỏ ở góc, và xoá
                                một tiết là xoá nó ở MỌI TUẦN — cho cả lớp lẫn phụ huynh — không
                                có đường hoàn tác. Chạm nhầm trên điện thoại là mất luôn. Mọi nút
                                xoá khác của dự án (/roster, /wig, biên bản họp) đều đã hỏi lại;
                                đúng cái ô này bị sót. Câu hỏi nêu rõ TÊN MÔN và TIẾT để người ta
                                biết mình đang xoá cái gì, thay vì một câu "chắc chưa?" chung chung. */}
                            <ConfirmButton
                              message={t('confirmDeleteSlot', {
                                subject: tenMon(s),
                                day: dayLabel(d),
                                period: p,
                              })}
                              label={t('delete')}
                              // Hiện 24px (ô lịch chật, dưới là nút sửa tiết) nhưng VÙNG CHẠM 44px
                              // qua ::before nới ra 10px mỗi bên — audit 04/09: nút xoá không hoàn
                              // tác mà chạm 24px trên điện thoại là chạm hụt / chạm nhầm.
                              className="relative grid h-6 w-6 cursor-pointer place-items-center rounded text-status-bad before:absolute before:-inset-2.5 before:content-['']"
                            >
                              ✕
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    ) : canManage && monChon.length > 0 ? (
                      /* Ô TRỐNG LÀ MỘT DẤU CỘNG BẤM ĐƯỢC. Dấu chấm mờ cũ không nói được rằng
                         chỗ này thêm tiết được — nó đọc như một ô hỏng. */
                      <NutTiet
                        o={oCua(d, p)}
                        title={`${t('addSlot')} · ${dayLabel(d)} · ${t('period')} ${p}`}
                        className="grid w-full cursor-pointer place-items-center rounded-[8px] border-[1.5px] border-dashed border-navy/15 py-2 text-navy/25 transition-colors hover:border-navy/45 hover:bg-navy/[0.04] hover:text-navy"
                      >
                        <Plus size={14} strokeWidth={2.5} />
                      </NutTiet>
                    ) : (
                      <div className="rounded-[8px] py-1.5 text-center text-chu-thich text-navy/15">·</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
  );

  // Dữ liệu cho máy hẹp: mỗi ngày một danh sách tiết (xem TkbHomNay).
  const ngayTkb: NgayTkb[] = DAYS.map((d, i) => ({
    d,
    nhan: dayLabel(d),
    ngay: weekDates[i].slice(5),
    laHomNay: weekDates[i] === today,
    tiet: PERIODS.map((p) => {
      const s = byKey.get(`${d}-${p}`);
      const ov = s ? overByKey.get(`${s.id}|${weekDates[i]}`) : undefined;
      return {
        p,
        gio: gioTiet[p],
        ten: s ? tenMon(s) : null,
        phong: s?.room ?? null,
        giaoVien: s?.teacher_name ?? null,
        kind: s?.kind ?? 'regular',
        ov: ov
          ? {status: ov.status, new_date: ov.new_date, new_period_no: ov.new_period_no, substitute_name: ov.substitute_name}
          : null,
        o: oCua(d, p, s),
      };
    }),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-dau font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      <Flash />

      {/* Cùng kiểu chip với /báo bài và /báo cáo — phụ huynh không phải học lại một thao tác mới
          ở mỗi trang. Chỉ hiện khi thật sự có nhiều hơn một con để chọn. */}
      {laPhuHuynh && children.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {children.map((c) => (
            <Link
              key={c.id}
              href={{pathname: '/timetable', query: {child: c.id}}}
              className={`rounded-full border px-2.5 py-1 text-chu-thich font-bold transition-colors ${
                c.id === con?.id
                  ? 'border-navy bg-navy text-white'
                  : 'border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
              }`}
            >
              {c.name}
              {c.className ? ` · ${c.className}` : ''}
            </Link>
          ))}
        </div>
      )}

      {/* Nói rõ đây là MẪU TUẦN LẶP.
          Ban giám hiệu hiểu nhầm là phải lập lại mỗi tuần ("kì trước mình đóng vai trò GV thì
          thấy cần tạo từng tuần. Việc này rất mất thời gian") và đề nghị làm một TKB cố định.
          Thực ra app đã cố định sẵn từ đầu — lưới này lặp cho mọi tuần, ô chọn tuần chỉ để đánh
          dấu huỷ/dời/dạy thay cho một ngày cụ thể. Đây là lỗi diễn đạt của màn hình chứ không
          thiếu tính năng, nên sửa chữ. */}

      {/* Điều hướng tuần + chú thích màu */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-than font-bold text-navy">
          <CalendarDays size={14} strokeWidth={2} className="text-grey-mid" />
          {rangeLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {[
            {d: -7, label: t('prevWeek')},
            {d: 0, label: t('thisWeek')},
            {d: 7, label: t('nextWeek')},
          ].map(({d, label}) => (
            <Link
              key={d}
              href={{
                pathname: '/timetable',
                query: {
                  ...(classParam ? {class: classParam} : {}),
                  ...(childParam ? {child: childParam} : {}),
                  ...(d === 0 ? {} : {week: shiftWeek(d)}),
                },
              }}
              className="inline-flex min-h-[44px] items-center rounded-[8px] border-[1.5px] border-navy/15 bg-white/60 px-2.5 text-chu-thich font-extrabold text-navy transition-colors hover:border-navy sm:min-h-0 sm:h-8"
            >
              {label}
            </Link>
          ))}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2.5">
          {/* NHẬP HÀNG LOẠT + SAO CHÉP (audit 04/09/2026): 28 lớp × 40 ô mà chỉ có cách bấm từng
              ô thì không ai nhập — lớp thật trống trơn. Dán từ bảng tính hoặc chép từ lớp cùng
              khối là hai đường mà phòng đào tạo vẫn làm trên giấy. */}
          {canManage && (
            <NhapHangLoat
              classId={myClass.id}
              monHoc={monLop.map((m) => ({id: m.id, name: m.name, ngan: m.short_name}))}
              cacThu={nhanTiet.cacThu}
              soTiet={PERIODS.length}
              nhan={{
                nut: t('bulkBtn'),
                tieuDe: t('bulkTitle'),
                huongDan: t('bulkHint'),
                oDan: t('bulkPaste'),
                xemTruoc: t('bulkPreview'),
                ghiDe: t('bulkOverwrite'),
                ghiDeHint: t('bulkOverwriteHint'),
                khongKhop: t('bulkNoMatch'),
                chonMon: t('bulkPick'),
                boQua: t('bulkSkip'),
                // t.raw: chuỗi có {n}/{m} do component tự điền — gọi t() thường là FORMATTING_ERROR.
                tomTat: t.raw('bulkSummary'),
                luu: t('save'),
                huy: t('cancel'),
                tiet: t('period'),
                khongCoMon: t('bulkNoSubjects'),
              }}
            />
          )}
          {canManage && (
            <SaoChepTkb
              classId={myClass.id}
              lopKhac={accessible.filter((c) => c.id !== myClass.id).map((c) => ({id: c.id, name: c.name}))}
              nhan={{
                nut: t('copyBtn'),
                tieuDe: t('copyTitle'),
                huongDan: t('copyHint'),
                lopNguon: t('copySource'),
                chonLop: t('copyPick'),
                ghiDe: t('copyOverwrite'),
                ghiDeHint: t('bulkOverwriteHint'),
                hoi: t.raw('copyAsk'),
                dongY: t('copyGo'),
                luu: t('copyGo'),
                huy: t('cancel'),
                khongCoLop: t('copyNoClasses'),
              }}
            />
          )}
          {canManage && (
            <GioTietForm
              classId={myClass.id}
              gio={gioTiet}
              soTiet={PERIODS.length}
              nhan={{
                moNut: t('periodTimes'),
                tieuDe: t('periodTimesTitle'),
                tiet: t('period'),
                tu: t('clubFrom'),
                den: t('clubTo'),
                tuDien: t('autofill'),
                batDau1: t('firstStart'),
                doDai: t('periodLen'),
                nghi: t('periodGap'),
                luu: t('save'),
                huy: t('cancel'),
              }}
            />
          )}
          {(['regular', 'practice', 'exam'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-chu-thich font-bold text-grey-mid">
              <span className={`h-2.5 w-2.5 rounded-full ${KIND_STYLE[k].dot}`} />
              {t(`kind_${k}`)}
            </span>
          ))}
        </span>
      </div>

      {/* KHUNG GIỜ CHƯA KHAI: cột Tiết chỉ có số, không có giờ — người xem không biết "tiết 3" là
          mấy giờ (10A1 trên production đúng cảnh này, audit 04/09). Nhắc ngay chỗ cần, kèm nút. */}
      {canManage && Object.keys(gioTiet).length === 0 && (
        <div className="glass flex flex-wrap items-center gap-2.5 rounded-[16px] px-4 py-3">
          <p className="min-w-[220px] flex-1 text-than font-semibold leading-relaxed text-navy">{t('timesMissing')}</p>
          <GioTietForm
            classId={myClass.id}
            gio={gioTiet}
            soTiet={PERIODS.length}
            nhan={{
              moNut: t('periodTimes'),
              tieuDe: t('periodTimesTitle'),
              tiet: t('period'),
              tu: t('clubFrom'),
              den: t('clubTo'),
              tuDien: t('autofill'),
              batDau1: t('firstStart'),
              doDai: t('periodLen'),
              nghi: t('periodGap'),
              luu: t('save'),
              huy: t('cancel'),
            }}
          />
        </div>
      )}

      {/* EM/PHỤ HUYNH mở lớp chưa có tiết nào: nói thẳng, không bày một bảng câm 56 ô trống. */}
      {!canManage && slots.length === 0 && (
        <p className="glass hidden rounded-[16px] px-4 py-6 text-center text-than font-semibold leading-relaxed text-grey-mid sm:block">
          {t('emptyForStudent')}
        </p>
      )}

      {/* Lưới TKB: hàng = tiết, cột = thứ (kèm ngày thật của tuần đang xem).
          Bọc trong TietProvider: mỗi ô là một nút mở hộp thoại sửa đúng ô ấy. */}
      <TietProvider
        classId={myClass.id}
        monHoc={monChon}
        nhan={nhanTiet}
        batDuoc={canManage && monChon.length > 0}
      >
      {/* Màn rộng: lưới 7 ngày. Máy hẹp: một ngày một cột (TkbHomNay), bấm "Cả tuần" mới bung lưới
          — audit 04/09: ở 360px lưới 1000px chỉ lộ 2/7 ngày mà không có dấu hiệu cuộn. */}
      <div className="hidden sm:block">{luoi}</div>
      <div className="sm:hidden">
        <TkbHomNay
          ngay={ngayTkb}
          batDuoc={canManage && monChon.length > 0}
          trong={!canManage && slots.length === 0 ? t('emptyForStudent') : null}
          nhan={{
            caTuan: t('fullWeek'),
            homNay: t('today'),
            tiet: t('period'),
            trongNgay: t('emptyForStudent'),
            ovCancelled: t('ovCancelled'),
            ovSubstituted: t('ovSubstituted'),
            them: t('addCell'),
          }}
        >
          {luoi}
        </TkbHomNay>
      </div>
      </TietProvider>

      {/* TKB CLB THEO CƠ SỞ (0152): CLB liên lớp nên là một lịch DÙNG CHUNG của cơ sở đặt song
          song dưới lưới chính khoá — cả cơ sở xem, chỉ Admin/BGH cơ sở này quản. */}
      <KhuCLBCoSo campusId={myClass.campus_id} canManage={quanClb} />

      {/* KHUNG NHẬP Ở CUỐI TRANG ĐÃ BỎ (09/08/2026).
          Nó bắt người xếp lịch khai lại bằng lời cái toạ độ mà mắt vừa nhìn thấy trên lưới —
          chọn thứ trong một ô xổ, chọn tiết trong một ô xổ nữa — rồi mới tới môn. Nay bấm thẳng
          vào ô cần xếp, thứ và tiết đi theo ô đó. Chỉ còn lại đây lời nhắc khai môn, vì không có
          môn thì hộp thoại kia mở ra cũng chỉ có một ô chọn rỗng. */}
      {canManage && monChon.length === 0 && (
        <div className="glass rounded-[20px] p-4">
          {/* RPC seed_class_subjects gieo cả bộ môn đang dùng của cơ sở, gọi lại bao nhiêu lần
              cũng an toàn. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="min-w-[240px] flex-1 text-than font-semibold leading-[1.55] text-txt">
              {/* Câu này trước đây gõ THẲNG tiếng Việt vào JSX, nên bản tiếng Anh của trang
                  cũng hiện ra một đoạn tiếng Việt. Bộ kiểm khoá dịch không bắt được: nó chỉ
                  soi những khoá ĐƯỢC GỌI có tồn tại hay không, chứ không biết chỗ nào lẽ ra
                  phải gọi mà lại gõ tay. */}
              {t('noSubjects')}
            </p>
            <form action={seedSubjects}>
              <input type="hidden" name="class_id" value={myClass.id} />
              <SubmitButton
                className="btn-gold h-11 cursor-pointer rounded-[8px] px-4 text-sm font-extrabold"
                wrapClass="contents"
              >
                {t('addSubjects')}
              </SubmitButton>
            </form>
          </div>
        </div>
      )}

      {/* GVCN/Admin: ngoại lệ theo ngày (huỷ / dời / dạy thay) + danh sách của tuần đang xem */}
      {canManage && slotOptions.length > 0 && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2 font-display text-noi-dung font-bold text-navy">{t('ovTitle')}</div>
          <OverrideForm
            classId={myClass.id}
            slots={slotOptions}
            periods={PERIODS}
            inputCls={cellInput}
            labels={{
              slot: t('ovSlot'),
              date: t('ovDate'),
              status: t('ovStatus'),
              cancelled: t('ovCancelled'),
              moved: t('ovMoved'),
              substituted: t('ovSubstituted'),
              newDate: t('ovNewDate'),
              newPeriod: t('ovNewPeriod'),
              substitute: t('ovSubstitute'),
              note: t('ovNote'),
              save: t('save'),
              period: t('period'),
            }}
          />

          {overrides.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-navy/[0.08] pt-3">
              {overrides
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((o) => {
                  const s = slotById.get(o.slot_id);
                  return (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 text-chu-thich font-semibold text-navy">
                      <span className="font-extrabold">{o.date.slice(5)}</span>
                      <span className="text-grey-mid">
                        {s ? `${tenMon(s)} · ${t('period')} ${s.period_no}` : '—'}
                      </span>
                      <span className="rounded-full bg-navy/[0.08] px-2 py-0.5 text-chu-thich font-extrabold">
                        {o.status === 'cancelled'
                          ? t('ovCancelled')
                          : o.status === 'moved'
                            ? `${t('ovMoved')} → ${o.new_date?.slice(5)} · ${t('period')} ${o.new_period_no}`
                            : `${t('ovSubstituted')}: ${o.substitute_name}`}
                      </span>
                      {o.note && <span className="text-grey-mid">“{o.note}”</span>}
                      <form action={deleteOverride} className="ml-auto">
                        <input type="hidden" name="class_id" value={myClass.id} />
                        <input type="hidden" name="id" value={o.id} />
                        <ConfirmButton
                          message={t('confirmRemoveOverride')}
                          label={t('ovRemove')}
                          className="cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-1 text-chu-thich font-extrabold text-navy hover:border-navy"
                        >
                          {t('ovRemove')}
                        </ConfirmButton>
                      </form>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
