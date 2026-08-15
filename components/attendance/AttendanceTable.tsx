'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, CheckCheck, Loader2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import type {Database} from '@/lib/database.types';

type Status = Database['public']['Enums']['attendance_status'];
type Student = {id: string; name: string};

// Bốn màu này TRÙNG KHÍT token trạng thái trong globals.css (success/status-bad/warn/grey-mid),
// nhưng trước đây được gõ lại bằng hex. Đổi token một lần thì bảng điểm danh vẫn giữ màu cũ —
// đúng cái bẫy "sửa một nơi, sót một nơi". Nay trỏ thẳng vào token.
// `color-mix` để pha quầng sáng từ chính màu ấy thay vì gõ tay lại giá trị rgb tương ứng.
// HAI MÀU CHO MỖI TRẠNG THÁI, KHÔNG PHẢI MỘT.
//
// `color` là màu TÔ (nút đã chọn, quầng sáng) — chỉ cần 3:1 vì đó là mảng màu, không phải chữ.
// `chu`   là màu CHỮ cho nhãn cột 10.5px — cần 4.5:1 (WCAG 1.4.3).
//
// Trước đây dùng chung một giá trị, nên nhãn "Có mặt" đo được 4.34:1 và "Trễ" 3.16:1 — cả hai
// dưới ngưỡng. Nhìn thì vẫn ra chữ, nhưng đây là bảng giáo viên quét mắt mỗi sáng, và hai nhãn
// ấy là thứ phân biệt bốn cột với nhau.
const STATUSES: {key: Status; color: string; chu: string; glow: string}[] = [
  {key: 'present', color: 'var(--color-success)', chu: 'var(--color-success-dark)', glow: glowOf('var(--color-success)')},
  {key: 'absent', color: 'var(--color-status-bad)', chu: 'var(--color-status-bad-dark)', glow: glowOf('var(--color-status-bad)')},
  {key: 'late', color: 'var(--color-warn)', chu: 'var(--color-warn-text)', glow: glowOf('var(--color-warn)')},
  // CỐ Ý giữ hex: #5d6180 không trùng token nào (grey-mid là #575c7d). Đổi sang token là ĐỔI MÀU,
  // không phải gom token — nằm ngoài phạm vi việc này. Đo được 5.86:1, đủ cho chữ nhỏ.
  {key: 'excused', color: '#5d6180', chu: '#5d6180', glow: glowOf('#5d6180')},
];
function glowOf(c: string): string {
  return `0 4px 12px color-mix(in srgb, ${c} 40%, transparent)`;
}

export function AttendanceTable({
  classId,
  today,
  students,
  initial,
  canEdit,
}: {
  classId: string;
  today: string;
  students: Student[];
  initial: Record<string, Status>;
  canEdit: boolean;
}) {
  const t = useTranslations('attendance');
  // saved = trạng thái đã lưu (server + realtime); pending = thay đổi chưa lưu.
  const [saved, setSaved] = useState<Record<string, Status>>(initial);
  const [pending, setPending] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState(0); // số em lưu thất bại (0 = không lỗi)
  const [supabase] = useState(() => createClient());

  // Realtime: nhận thay đổi từ thiết bị khác (chỉ áp cho HS không có thay đổi chưa lưu).
  useEffect(() => {
    const channel = supabase
      .channel(`attendance-${classId}-${today}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `class_id=eq.${classId}`,
        },
        (payload) => {
          const row = payload.new as {student_id?: string; status?: Status; date?: string};
          if (row?.student_id && row.status && row.date === today) {
            const sid = row.student_id;
            const st = row.status;
            setSaved((prev) => ({...prev, [sid]: st}));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, today, supabase]);

  const setStatus = useCallback(
    (studentId: string, status: Status) => {
      if (!canEdit) return;
      setSavedFlash(false);
      setSaveError(0);
      setPending((prev) => ({...prev, [studentId]: status}));
    },
    [canEdit],
  );

  // Tick cả lớp 1 trạng thái (rồi chỉnh từng em sau).
  const setAllStatus = useCallback(
    (status: Status) => {
      if (!canEdit) return;
      setSavedFlash(false);
      setSaveError(0);
      setPending((prev) => {
        const next = {...prev};
        for (const st of students) next[st.id] = status;
        return next;
      });
    },
    [canEdit, students],
  );

  const dirtyCount = Object.keys(pending).length;

  const save = useCallback(async () => {
    if (!canEdit || dirtyCount === 0) return;
    setSaving(true);
    setSaveError(0);
    const entries = Object.entries(pending);
    // Đọc lỗi từng bản ghi: chỉ chuyển sang "đã lưu" những em thành công,
    // GIỮ NGUYÊN pending cho em thất bại (không mất dữ liệu điểm danh âm thầm).
    const results = await Promise.all(
      entries.map(([studentId, status]) =>
        supabase
          .rpc('mark_attendance_on', {p_class: classId, p_student: studentId, p_status: status, p_date: today})
          .then(({error}) => ({studentId, status, ok: !error})),
      ),
    );
    const okIds = new Set(results.filter((r) => r.ok).map((r) => r.studentId));
    const failed = results.length - okIds.size;
    setSaved((prev) => {
      const next = {...prev};
      for (const r of results) if (r.ok) next[r.studentId] = r.status;
      return next;
    });
    setPending((prev) => {
      const next: Record<string, Status> = {};
      for (const [id, st] of Object.entries(prev)) if (!okIds.has(id)) next[id] = st;
      return next;
    });
    setSaving(false);
    if (failed > 0) setSaveError(failed);
    else setSavedFlash(true);
  }, [canEdit, classId, dirtyCount, pending, supabase]);

  // ── CÒN TICK CHƯA LƯU THÌ ĐỪNG ĐỂ NGƯỜI TA ĐI MẤT ─────────────────────────────────────────
  //
  // Bảng này KHÔNG tự lưu (xem `save` ở trên: nó chỉ chạy khi bấm nút), mà dòng chữ dưới chân
  // bảng lại ghi "Tự lưu realtime". Cô giáo tick cả lớp, đọc câu đó, yên tâm bấm sang tab khác —
  // và hai mươi tư lượt tick biến mất vì chúng mới chỉ nằm trong `pending` của trình duyệt.
  // Câu chữ đã sửa lại cho đúng việc; đây là rào chắn thứ hai, cho lúc người ta không đọc.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const chan = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', chan);
    return () => window.removeEventListener('beforeunload', chan);
  }, [dirtyCount]);

  const display = (id: string): Status | undefined => pending[id] ?? saved[id];
  const presentCount = useMemo(
    () => students.filter((s) => display(s.id) === 'present').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, pending, saved],
  );

  if (students.length === 0) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{t('noStudents')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header row: HỌC SINH + 4 nhãn trạng thái tô màu theo trạng thái */}
        <div className="flex min-w-[540px] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5">
          <span className="flex-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
            {/* Không có key i18n riêng cho tiêu đề cột này — hardcode tiếng Việt */}
            Học sinh
          </span>
          {STATUSES.map((s) => (
            <span
              key={s.key}
              className="w-[60px] flex-none text-center text-[10.5px] font-extrabold"
              style={{color: s.chu}}
            >
              {t(s.key)}
            </span>
          ))}
        </div>

        {/* Chọn cả lớp → hàng nút tick-all */}
        {canEdit && (
          <div className="flex min-w-[540px] items-center gap-2 border-t border-navy/[0.08] bg-navy/[0.03] px-[18px] py-2">
            <span className="flex-1 text-right text-[11px] font-extrabold text-grey-mid">
              {t('tickAll')} →
            </span>
            {STATUSES.map((s) => (
              <span key={s.key} className="grid w-[60px] flex-none place-items-center">
                <button
                  type="button"
                  onClick={() => setAllStatus(s.key)}
                  title={`${t('tickAll')}: ${t(s.key)}`}
                  aria-label={`${t('tickAll')}: ${t(s.key)}`}
                  className="grid h-7 w-10 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-navy/20 bg-white/60 text-navy transition-all hover:border-navy hover:bg-white"
                >
                  <CheckCheck size={14} strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Hàng học sinh */}
        {students.map((st, i) => {
          const cur = display(st.id);
          const isDirty = st.id in pending;
          return (
            <div
              key={st.id}
              className="flex min-w-[540px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
            >
              <span className="w-5 flex-none text-[12px] font-bold text-grey-mid">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px] font-bold text-navy">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{st.name}</span>
                {isDirty && (
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 flex-none rounded-full"
                    style={{backgroundColor: '#b98900'}}
                  />
                )}
              </span>
              {STATUSES.map((s) => {
                const active = cur === s.key;
                return (
                  <span key={s.key} className="grid w-[60px] flex-none place-items-center">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setStatus(st.id, s.key)}
                      aria-pressed={active}
                      aria-label={t(s.key)}
                      className={`grid h-11 w-11 place-items-center rounded-full border-[1.5px] transition-all sm:h-[34px] sm:w-[34px] ${
                        active
                          ? 'text-white'
                          : 'border-navy/20 bg-white text-transparent hover:border-navy'
                      } ${!canEdit ? 'cursor-default' : 'cursor-pointer'}`}
                      style={
                        active
                          ? {backgroundColor: s.color, borderColor: s.color, boxShadow: s.glow}
                          : undefined
                      }
                    >
                      <Check size={15} strokeWidth={3} />
                    </button>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="text-[12.5px] font-bold text-txt">
          {t('present')}: <b className="text-success-dark">{presentCount}</b> / {students.length}
        </div>
        <span className="flex-1" />
        {canEdit && savedFlash && dirtyCount === 0 && saveError === 0 && (
          <span className="inline-flex flex-none items-center gap-1 text-[13px] font-extrabold text-success-dark">
            <Check size={15} strokeWidth={3} />
            {t('savedAt')}
          </span>
        )}
        {canEdit && saveError > 0 && (
          <span className="inline-flex flex-none items-center gap-1 rounded-lg bg-status-bad/10 px-2.5 py-1 text-[12.5px] font-extrabold text-status-bad">
            {t('saveFailed', {count: saveError})}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={saving || dirtyCount === 0}
            className="btn-gold h-[42px] flex-none cursor-pointer rounded-[14px] px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* KHOÁ + ĐỔI CHỮ + XOAY. Hai cái đầu đã có; vòng xoay là thứ nói "máy đang chạy"
                chứ không phải "màn hình đứng hình" — cùng lối với SubmitButton. */}
            <span className="inline-flex items-center gap-1.5">
              {saving && <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />}
              {saving
                ? t('saving')
                : dirtyCount > 0
                  ? `${t('save')} (${dirtyCount})`
                  : t('save')}
            </span>
          </button>
        )}
      </div>
      {/* Câu này dạy cách LƯU, nên chỉ nói với người lưu được. Sau 0127, GVCN và tổ trưởng chỉ
          đọc — bày cho họ một hướng dẫn bấm nút mà chính họ không có nút là dạy một việc không
          làm được. Nửa sau (thay đổi từ máy khác tự hiện) thì ai cũng cần, nên tách làm hai câu. */}
      <p className="text-[11px] italic text-grey-mid">
        {canEdit ? t('realtimeNote') : t('realtimeNoteReadOnly')}
      </p>

      {/* Nút Lưu nằm cuối một bảng ba mươi dòng, nên tick xong ở giữa bảng là nó đã trôi khỏi màn.
          Dải này bám đáy để "còn N em chưa lưu" luôn nằm trong tầm mắt, và bấm được ngay tại chỗ. */}
      {canEdit && dirtyCount > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-[560px] flex-wrap items-center gap-3 rounded-[16px] border-[1.5px] border-gold-deep/40 bg-white px-4 py-3 shadow-pop">
          <span className="min-w-0 flex-1 text-[12.5px] font-extrabold text-navy">
            {t('unsaved', {count: dirtyCount})}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-gold h-[42px] flex-none cursor-pointer rounded-[12px] px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-1.5">
              {saving && <Loader2 size={15} strokeWidth={2.5} className="animate-spin" />}
              {saving ? t('saving') : t('save')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
