import {getTranslations, setRequestLocale} from 'next-intl/server';
import {CalendarDays, MapPin, UserRound, ArrowRight} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {todayInVN, weekRangeVN} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {OverrideForm} from './OverrideForm';
import {saveSlot, deleteSlot, deleteOverride, seedSubjects} from './actions';
import {FlashToast} from '@/components/ui/FlashToast';

const DAYS = [2, 3, 4, 5, 6, 7]; // T2..T7 (tuần học VN)
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
  searchParams: Promise<{class?: string; flash?: string; week?: string; editSlot?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, flash, week: weekParam, editSlot: editSlotId} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  const t = await getTranslations('timetable');
  const tc = await getTranslations('class');
  const supabase = await createClient();

  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);
  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  // Hiệu trưởng cũng quản lý được TKB của cơ sở mình (xem migration 0057).
  const canManage =
    profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'principal';

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

  const [{data: slotData}, {data: overData}, {data: monData}] = await Promise.all([
    supabase
      .from('timetable_slots')
      // Nhặt luôn tên môn từ danh mục trong CÙNG một truy vấn — hỏi riêng bảng subjects là thêm
      // một chặng mạng mà chẳng biết thêm gì.
      .select('id, day_of_week, period_no, subject, subject_id, room, teacher_name, kind, subjects(name, short_name)')
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

  // Ô đang sửa (?editSlot=) — theo đúng lối ?editWig= của /wig: điền sẵn panel bên dưới thay vì
  // dựng 48 form inline trên lưới.
  const editing = editSlotId ? slotById.get(editSlotId) ?? null : null;

  const dayLabel = (d: number) => (d === 7 ? t('sat') : `${t('dayShort')}${d}`);
  const cellInput =
    'w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-2.5 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';

  // TÊN MÔN ĐỂ HIỆN. Đọc từ danh mục; dòng cũ còn subject_id NULL thì hiện tạm chữ cũ — chỉ để
  // không mất dữ liệu đang có, KHÔNG phải để ghi tiếp vào cột đó.
  const tenMon = (s: Slot) => s.subjects?.name ?? s.subject ?? '—';
  // Bản NGẮN cho ô lưới: ô một tiết rộng chưa tới 90px nên "Giáo dục kinh tế và pháp luật" bị CSS
  // cắt cụt. Cột short_name sinh ra chính vì lý do đó (xem comment trong migration 0069).
  const tenMonNgan = (s: Slot) => s.subjects?.short_name ?? s.subject ?? '—';

  const slotOptions = slots
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week || a.period_no - b.period_no)
    .map((s) => ({
      id: s.id,
      label: `${dayLabel(s.day_of_week)} · ${t('period')} ${s.period_no} · ${tenMon(s)}`,
      date: dateOf(s.day_of_week),
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      {flash && <FlashToast message={flash} />}

      {/* Nói rõ đây là MẪU TUẦN LẶP.
          Ban giám hiệu hiểu nhầm là phải lập lại mỗi tuần ("kì trước mình đóng vai trò GV thì
          thấy cần tạo từng tuần. Việc này rất mất thời gian") và đề nghị làm một TKB cố định.
          Thực ra app đã cố định sẵn từ đầu — lưới này lặp cho mọi tuần, ô chọn tuần chỉ để đánh
          dấu huỷ/dời/dạy thay cho một ngày cụ thể. Đây là lỗi diễn đạt của màn hình chứ không
          thiếu tính năng, nên sửa chữ. */}
      <p className="text-[12px] font-semibold leading-[1.55] text-grey-mid">
        {t('repeatNote')}
      </p>

      {/* Điều hướng tuần + chú thích màu */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-navy">
          <CalendarDays size={14} strokeWidth={2.2} className="text-grey-mid" />
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
                  ...(d === 0 ? {} : {week: shiftWeek(d)}),
                },
              }}
              className="inline-flex h-8 items-center rounded-[9px] border-[1.5px] border-navy/15 bg-white/60 px-2.5 text-[11.5px] font-extrabold text-navy transition-colors hover:border-navy"
            >
              {label}
            </Link>
          ))}
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2.5">
          {(['regular', 'practice', 'exam'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-grey-mid">
              <span className={`h-2.5 w-2.5 rounded-full ${KIND_STYLE[k].dot}`} />
              {t(`kind_${k}`)}
            </span>
          ))}
        </span>
      </div>

      {/* Lưới TKB: hàng = tiết, cột = thứ (kèm ngày thật của tuần đang xem) */}
      <div className="glass overflow-x-auto rounded-[20px] p-2">
        <div className="min-w-[860px]">
          <div className="flex">
            <div className="w-14 shrink-0 px-2 py-2 text-[11px] font-extrabold uppercase text-grey-mid">
              {t('period')}
            </div>
            {DAYS.map((d, i) => (
              <div key={d} className="flex-1 px-2 py-2 text-center">
                <div className="text-[12px] font-extrabold text-navy">{dayLabel(d)}</div>
                <div
                  className={`text-[10.5px] font-bold ${
                    weekDates[i] === today ? 'text-gold-deep' : 'text-grey-mid'
                  }`}
                >
                  {weekDates[i].slice(5)}
                </div>
              </div>
            ))}
          </div>
          {PERIODS.map((p) => (
            <div key={p} className="flex border-t border-navy/[0.08]">
              <div className="grid w-14 shrink-0 place-items-center text-[13px] font-bold text-grey-mid">{p}</div>
              {DAYS.map((d, i) => {
                const s = byKey.get(`${d}-${p}`);
                const ov = s ? overByKey.get(`${s.id}|${weekDates[i]}`) : undefined;
                const style = KIND_STYLE[s?.kind ?? 'regular'] ?? KIND_STYLE.regular;
                return (
                  <div key={d} className="min-w-0 flex-1 p-1.5">
                    {s ? (
                      <div
                        className={`relative rounded-[10px] border-[1.5px] px-2 py-1.5 ${style.box} ${
                          ov?.status === 'cancelled' ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Bấm tên môn để sửa ô ngay (điền sẵn panel bên dưới) */}
                        {canManage ? (
                          <Link
                            href={{
                              pathname: '/timetable',
                              query: {
                                ...(classParam ? {class: classParam} : {}),
                                ...(weekParam ? {week: weekParam} : {}),
                                editSlot: s.id,
                              },
                            }}
                            title={tenMon(s)}
                            className={`block truncate text-[12.5px] font-bold text-navy underline-offset-2 hover:underline ${
                              ov?.status === 'cancelled' ? 'line-through' : ''
                            }`}
                          >
                            {tenMonNgan(s)}
                          </Link>
                        ) : (
                          <div
                            title={tenMon(s)}
                            className={`truncate text-[12.5px] font-bold text-navy ${
                              ov?.status === 'cancelled' ? 'line-through' : ''
                            }`}
                          >
                            {tenMonNgan(s)}
                          </div>
                        )}
                        {(s.room || s.teacher_name) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] font-semibold text-grey-mid">
                            {s.room && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin size={10} strokeWidth={2.5} />
                                {s.room}
                              </span>
                            )}
                            {s.teacher_name && (
                              <span className="inline-flex min-w-0 items-center gap-0.5">
                                <UserRound size={10} strokeWidth={2.5} />
                                <span className="truncate">{s.teacher_name}</span>
                              </span>
                            )}
                          </div>
                        )}
                        {/* Ngoại lệ của đúng ngày này */}
                        {ov && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {ov.status === 'cancelled' && (
                              <span className="rounded-full bg-status-bad/[0.14] px-1.5 py-0.5 text-[9.5px] font-extrabold text-status-bad">
                                {t('ovCancelled')}
                              </span>
                            )}
                            {ov.status === 'substituted' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-navy/[0.10] px-1.5 py-0.5 text-[9.5px] font-extrabold text-navy">
                                {t('ovSubstituted')}: {ov.substitute_name}
                              </span>
                            )}
                            {ov.status === 'moved' && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-navy/[0.10] px-1.5 py-0.5 text-[9.5px] font-extrabold text-navy">
                                <ArrowRight size={9} strokeWidth={3} />
                                {ov.new_date?.slice(5)} · {t('period')} {ov.new_period_no}
                              </span>
                            )}
                          </div>
                        )}
                        {canManage && (
                          <form action={deleteSlot} className="absolute right-1 top-1">
                            <input type="hidden" name="class_id" value={myClass.id} />
                            <input type="hidden" name="id" value={s.id} />
                            <button
                              type="submit"
                              aria-label={t('delete')}
                              className="grid h-4 w-4 cursor-pointer place-items-center rounded text-status-bad"
                            >
                              ✕
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-[10px] py-1.5 text-center text-[11px] text-navy/15">·</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* GVCN/Admin: thêm hoặc sửa 1 ô của MẪU TUẦN */}
      {canManage && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold text-navy">
              {editing ? `${t('editSlot')} · ${dayLabel(editing.day_of_week)} · ${t('period')} ${editing.period_no}` : t('addSlot')}
            </span>
            {editing && (
              <Link
                href={{
                  pathname: '/timetable',
                  query: {
                    ...(classParam ? {class: classParam} : {}),
                    ...(weekParam ? {week: weekParam} : {}),
                  },
                }}
                className="text-[11.5px] font-extrabold text-gold-deep underline underline-offset-2"
              >
                {t('editCancel')}
              </Link>
            )}
          </div>
          {monLop.length === 0 ? (
            /* Lớp CHƯA khai môn nào → ô chọn sẽ rỗng. Đừng để giáo viên nhìn một ô trống rồi
               đoán: nói thẳng phải làm gì, và đặt sẵn nút làm hộ. RPC seed_class_subjects gieo cả
               bộ môn đang dùng của cơ sở, gọi lại bao nhiêu lần cũng an toàn. */
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="min-w-[240px] flex-1 text-[12.5px] font-semibold leading-[1.55] text-txt">
                Lớp này chưa khai môn nào nên chưa chọn được môn cho ô thời khoá biểu. Bấm nút bên
                cạnh để thêm cả bộ môn của cơ sở vào chương trình lớp, rồi xếp lịch như thường.
              </p>
              <form action={seedSubjects}>
                <input type="hidden" name="class_id" value={myClass.id} />
                <SubmitButton
                  className="btn-gold h-11 cursor-pointer rounded-[10px] px-4 text-sm font-extrabold"
                  wrapClass="contents"
                >
                  Thêm bộ môn cho lớp
                </SubmitButton>
              </form>
            </div>
          ) : (
            <>
              {/* key ép remount khi đổi ô đang sửa → defaultValue nạp lại đúng ô mới */}
              <form key={editing?.id ?? 'new'} action={saveSlot} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="class_id" value={myClass.id} />
                {editing ? (
                  // Đang sửa: KHOÁ thứ/tiết. saveSlot upsert theo (class, day, period) nên đổi hai ô
                  // này sẽ tạo ô MỚI chứ không "dời" ô cũ — dời lịch là việc của ngoại lệ theo ngày.
                  <>
                    <input type="hidden" name="day_of_week" value={editing.day_of_week} />
                    <input type="hidden" name="period_no" value={editing.period_no} />
                  </>
                ) : (
                  <>
                    <select name="day_of_week" aria-label={t('dayLabel')} defaultValue="2" className={`${cellInput} w-24 cursor-pointer`}>
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          {dayLabel(d)}
                        </option>
                      ))}
                    </select>
                    <select name="period_no" aria-label={t('period')} defaultValue="1" className={`${cellInput} w-24 cursor-pointer`}>
                      {PERIODS.map((p) => (
                        <option key={p} value={p}>
                          {t('period')} {p}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {/* MÔN: chọn từ danh mục, không gõ tay nữa. Trước 0069 hai lớp gõ "Ngữ văn"/"Ngữ Văn"
                    thành hai môn khác nhau, và thời khoá biểu không nối được với bảng điểm. */}
                <select
                  name="subject_id"
                  aria-label={t('subject')}
                  defaultValue={editing?.subject_id ?? ''}
                  className={`${cellInput} min-w-[130px] flex-1 cursor-pointer`}
                  required
                >
                  {/* Bắt buộc chọn: bỏ trống thì trình duyệt chặn ngay, không phải chờ máy chủ trả lỗi. */}
                  <option value="">— {t('subject')} —</option>
                  {monLop.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input name="room" placeholder={t('room')} aria-label={t('room')} defaultValue={editing?.room ?? ''} className={`${cellInput} w-24`} />
                <input
                  name="teacher_name"
                  placeholder={t('teacher')} aria-label={t('teacher')}
                  defaultValue={editing?.teacher_name ?? ''}
                  className={`${cellInput} w-36`}
                />
                <select name="kind" aria-label={t('kindLabel')} defaultValue={editing?.kind ?? 'regular'} className={`${cellInput} w-32 cursor-pointer`}>
                  {(['regular', 'practice', 'exam'] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(`kind_${k}`)}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn-gold h-11 cursor-pointer rounded-[10px] px-4 text-sm font-extrabold" wrapClass="contents">
                  {t('save')}
                </SubmitButton>
              </form>
              {/* Câu hướng dẫn thêm ô viết thẳng tiếng Việt: khoá cũ trong messages/*.json còn ghi
                  "nhập môn", nay là CHỌN môn trong danh mục — để nguyên là chỉ đường sai. */}
              <p className="mt-1.5 text-[11px] italic text-grey-mid">
                {editing
                  ? t('editHint')
                  : 'Chọn thứ + tiết, chọn môn trong danh mục của lớp (và phòng nếu có) rồi Lưu. Lưu lại cùng một ô sẽ ghi đè.'}
              </p>
            </>
          )}
        </div>
      )}

      {/* GVCN/Admin: ngoại lệ theo ngày (huỷ / dời / dạy thay) + danh sách của tuần đang xem */}
      {canManage && slotOptions.length > 0 && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2 font-display text-[15px] font-bold text-navy">{t('ovTitle')}</div>
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
          <p className="mt-1.5 text-[11px] italic text-grey-mid">{t('ovHint')}</p>

          {overrides.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 border-t border-navy/[0.08] pt-3">
              {overrides
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((o) => {
                  const s = slotById.get(o.slot_id);
                  return (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-navy">
                      <span className="font-extrabold">{o.date.slice(5)}</span>
                      <span className="text-grey-mid">
                        {s ? `${tenMon(s)} · ${t('period')} ${s.period_no}` : '—'}
                      </span>
                      <span className="rounded-full bg-navy/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold">
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
                        <button
                          type="submit"
                          className="cursor-pointer rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-1 text-[11px] font-extrabold text-navy hover:border-navy"
                        >
                          {t('ovRemove')}
                        </button>
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
