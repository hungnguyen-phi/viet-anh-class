import {getTranslations} from 'next-intl/server';
import {Users, CalendarClock, Shuffle} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {taoBuddyNhom, goBuddyNhom, chiaNhomNgauNhien, luuLichBuddy, luuLichCoach} from '@/app/[locale]/(dashboard)/roster/buddy-actions';

// ════════════════════════════════════════════════════════════════════════════
// BUDDY & LỊCH PDR — khu của GVCN trên /roster (PRD v3, migration 0146 + 0153)
// ════════════════════════════════════════════════════════════════════════════
//
// GVCN ghép NHÓM buddy 2 hoặc 3 em (chốt 19/08/2026 — lớp lẻ thì một nhóm 3), cài lịch họp
// buddy hằng tuần cho từng nhóm, và lịch PDR 1-1 với giáo viên (một ngày cố định 1–28 hằng
// tháng cho từng em). Học sinh chỉ XEM các thứ này trên màn của mình — đăng ký/đổi nhóm là
// nói với GVCN, đúng luật PRD. Dưới CSDL một nhóm 3 là 3 cặp đôi một (0153); màn này gộp
// ngược cặp → nhóm để cô chỉ thấy và thao tác trên NHÓM.

const THU = [2, 3, 4, 5, 6, 7, 8];

export async function KhuBuddyPdr({
  ve = 'roster',
  classId,
  hocSinh,
}: {
  classId: string;
  /** Sau action quay về đâu: 'roster' (mặc định) hay 'wig' (popup Lịch họp trên /wig). */
  ve?: 'roster' | 'wig';
  /** Danh sách em đang học của lớp (id + tên hiển thị) — trang roster đã có sẵn. */
  hocSinh: {id: string; name: string}[];
}) {
  const t = await getTranslations('buddy');
  const supabase = await createClient();

  const [{data: capRows}, {data: lichRows}] = await Promise.all([
    supabase
      .from('buddy_pairs')
      .select('id, student_id, buddy_id')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('created_at'),
    supabase
      .from('pdr_schedules')
      .select('id, type, buddy_pair_id, student_id, weekday, time_slot, monthly_day, nhac_khi')
      .eq('class_id', classId)
      .eq('is_active', true),
  ]);
  const cap = capRows ?? [];
  const lich = lichRows ?? [];
  const ten = new Map(hocSinh.map((h) => [h.id, h.name]));
  const lichCua = new Map(lich.filter((l) => l.type === 'buddy').map((l) => [l.buddy_pair_id, l]));
  const coachCua = new Map(lich.filter((l) => l.type === 'coach').map((l) => [l.student_id, l]));
  const nhanThu = (d: number | null) => (d === 8 ? 'CN' : d ? `T${d}` : '');
  const oNho =
    'min-h-[44px] rounded-[12px] border-[1.5px] border-navy/15 bg-white px-2.5 text-base sm:text-than font-bold text-navy focus:border-navy';

  // ── GỘP CẶP → NHÓM (union-find tí hon) ────────────────────────────────────────────────────
  // Nhóm 3 nằm dưới CSDL là 3 cặp đôi một; đây là phép gộp ngược để mỗi nhóm hiện MỘT dòng.
  const goc = new Map<string, string>();
  const tim = (x: string): string => {
    const p = goc.get(x) ?? x;
    if (p === x) return x;
    const r = tim(p);
    goc.set(x, r);
    return r;
  };
  for (const c of cap) goc.set(tim(c.student_id), tim(c.buddy_id));
  const nhom = new Map<string, {emIds: string[]; pairIds: string[]}>();
  for (const c of cap) {
    const r = tim(c.student_id);
    let g = nhom.get(r);
    if (!g) {
      g = {emIds: [], pairIds: []};
      nhom.set(r, g);
    }
    for (const id of [c.student_id, c.buddy_id]) if (!g.emIds.includes(id)) g.emIds.push(id);
    g.pairIds.push(c.id);
  }

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <h2 className="mb-1 inline-flex items-center gap-1.5 font-display text-[16px] font-bold text-navy">
        <Users size={16} strokeWidth={2.2} className="text-gold-deep" />
        {t('title')}
      </h2>

      {/* Các nhóm hiện có + lịch tuần của từng nhóm */}
      <div className="mt-2 flex flex-col gap-2">
        {nhom.size === 0 && <p className="text-[12.5px] italic text-grey-mid">{t('noPairs')}</p>}
        {[...nhom.values()].map((g) => {
          // Lịch của nhóm nằm trên MỌI cặp (luuLichBuddy ghi đủ); đọc thì cặp nào có là đủ.
          const l = g.pairIds.map((id) => lichCua.get(id)).find(Boolean);
          const tenNhom = g.emIds.map((id) => ten.get(id) ?? '—').join(' ↔ ');
          return (
            <div key={g.pairIds[0]} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-navy/[0.035] p-2.5">
              <span className="min-w-0 text-[13px] font-extrabold text-navy">{tenNhom}</span>
              {g.emIds.length === 3 && (
                <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                  {t('groupOf3')}
                </span>
              )}
              <form action={luuLichBuddy} className="ml-auto flex items-center gap-1.5">
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="ve" value={ve} />
                <input type="hidden" name="pair_ids" value={g.pairIds.join(',')} />
                {/* CHƯA CÓ LỊCH THÌ Ô PHẢI TỰ TỐ CÁO (audit 19/08/2026): mặc định "T6" làm nhóm
                    chưa đặt lịch nhìn y hệt nhóm đã lưu lịch T6 — sau một cú "Chia ngẫu nhiên"
                    ra chục nhóm thì chục hàng đều mang "T6" giả. Chưa lưu → option rỗng "— chưa
                    đặt lịch —"; bấm Lưu khi chưa chọn thì server đã có câu "Chọn thứ trong tuần." */}
                <select
                  name="weekday"
                  defaultValue={l?.weekday ?? ''}
                  className={`${oNho} cursor-pointer`}
                  aria-label={t('weekday')}
                >
                  {!l && <option value="">{t('noScheduleYet')}</option>}
                  {THU.map((d) => (
                    <option key={d} value={d}>
                      {nhanThu(d)}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  name="time_slot"
                  defaultValue={l?.time_slot ? String(l.time_slot).slice(0, 5) : ''}
                  className={`${oNho} w-24`}
                  aria-label={t('time')}
                />
                {/* NHẮC KHI NÀO — người cài lịch tự chọn (0159). Không cắm cứng vì lớp họp
                    giờ ra chơi và lớp họp buổi tối cần hai mốc khác hẳn nhau. */}
                <select
                  name="nhac_khi"
                  defaultValue={l?.nhac_khi ?? 'sang_hom_do'}
                  className={`${oNho} cursor-pointer`}
                  aria-label={t('remindLabel')}
                >
                  <option value="sang_hom_do">{t('remindMorning')}</option>
                  <option value="toi_hom_truoc">{t('remindEveBefore')}</option>
                  <option value="mot_gio_truoc">{t('remindHourBefore')}</option>
                  <option value="khong">{t('remindNone')}</option>
                </select>
                <SubmitButton className={`${oNho} cursor-pointer font-extrabold hover:border-navy`} wrapClass="contents">
                  {t('saveSchedule')}
                </SubmitButton>
              </form>
              <form action={goBuddyNhom}>
                <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="ve" value={ve} />
                <input type="hidden" name="pair_ids" value={g.pairIds.join(',')} />
                <ConfirmButton
                  message={t('confirmUnpair', {names: tenNhom})}
                  label={t('unpair')}
                  className="grid h-11 w-11 cursor-pointer place-items-center rounded-[12px] text-status-bad transition-colors hover:bg-status-bad/10"
                >
                  ✕
                </ConfirmButton>
              </form>
            </div>
          );
        })}
      </div>

      {/* Tạo nhóm mới — 2 em, em thứ ba tuỳ chọn (lớp lẻ thì một nhóm 3) */}
      <form action={taoBuddyNhom} className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy/[0.08] pt-3">
        <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="ve" value={ve} />
        <select name="em_a" defaultValue="" required className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('studentA')}>
          <option value="" disabled>
            {t('studentA')}
          </option>
          {hocSinh.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <span aria-hidden className="text-[13px] font-extrabold text-grey-mid">↔</span>
        <select name="em_b" defaultValue="" required className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('studentB')}>
          <option value="" disabled>
            {t('studentB')}
          </option>
          {hocSinh.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <span aria-hidden className="text-[13px] font-extrabold text-grey-mid">↔</span>
        <select name="em_c" defaultValue="" className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('studentC')}>
          <option value="">{t('studentC')}</option>
          {hocSinh.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <SubmitButton className="btn-gold min-h-[44px] cursor-pointer rounded-[12px] px-4 text-than font-extrabold" wrapClass="contents">
          {t('pair')}
        </SubmitButton>
      </form>

      {/* Chia ngẫu nhiên phần còn trống — chỉ hiện khi còn ít nhất 2 em chưa có nhóm.
          Không đụng nhóm đã ghép tay: cô ghép tay vài nhóm đặc biệt trước, random phần còn lại. */}
      {(() => {
        const daCoNhom = new Set([...nhom.values()].flatMap((g) => g.emIds));
        const conTrong = hocSinh.filter((h) => !daCoNhom.has(h.id));
        if (conTrong.length < 2) return null;
        return (
          <form action={chiaNhomNgauNhien} className="mt-2">
            <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="ve" value={ve} />
            <ConfirmButton
              message={t('confirmRandom', {n: conTrong.length})}
              label={t('randomize', {n: conTrong.length})}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[12px] border-[1.5px] border-navy/15 bg-white px-3 text-than font-extrabold text-navy hover:border-navy"
            >
              <Shuffle size={13} strokeWidth={2.5} />
              {t('randomize', {n: conTrong.length})}
            </ConfirmButton>
          </form>
        );
      })()}

      {/* Lịch PDR 1-1 với giáo viên — mỗi em một ngày cố định hằng tháng */}
      <div className="mt-4 border-t border-navy/[0.08] pt-3">
        <h3 className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-extrabold text-navy">
          <CalendarClock size={14} strokeWidth={2.2} className="text-gold-deep" />
          {t('coachTitle')}
        </h3>
        {coachCua.size > 0 && (
          <p className="mb-2 flex flex-wrap gap-1.5">
            {[...coachCua.values()].map((l) => (
              <span key={l.id} className="rounded-full bg-navy/[0.06] px-2.5 py-1 text-[11.5px] font-bold text-navy">
                {ten.get(l.student_id ?? '') ?? '—'} · {t('dayOfMonth', {d: l.monthly_day ?? 0})}
              </span>
            ))}
          </p>
        )}
        <form action={luuLichCoach} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="class_id" value={classId} />
                <input type="hidden" name="ve" value={ve} />
          <select name="student_id" defaultValue="" required className={`${oNho} min-w-[150px] cursor-pointer`} aria-label={t('student')}>
            <option value="" disabled>
              {t('student')}
            </option>
            {hocSinh.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <select name="monthly_day" defaultValue="" required className={`${oNho} cursor-pointer`} aria-label={t('dayLabel')}>
            <option value="" disabled>
              {t('dayLabel')}
            </option>
            {Array.from({length: 28}, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {/* Lịch coach không có giờ nên KHÔNG bày "trước 1 tiếng": một lựa chọn mà máy chủ
              phải tự diễn giải lại thành thứ khác là một lời hứa hão với người bấm. */}
          <select name="nhac_khi" defaultValue="sang_hom_do" className={`${oNho} cursor-pointer`} aria-label={t('remindLabel')}>
            <option value="sang_hom_do">{t('remindMorning')}</option>
            <option value="toi_hom_truoc">{t('remindEveBefore')}</option>
            <option value="khong">{t('remindNone')}</option>
          </select>
          <SubmitButton className={`${oNho} cursor-pointer font-extrabold hover:border-navy`} wrapClass="contents">
            {t('saveSchedule')}
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
