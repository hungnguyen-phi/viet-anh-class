'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, CheckCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import type {Database} from '@/lib/database.types';

type Status = Database['public']['Enums']['attendance_status'];
type Student = {id: string; name: string};

const STATUSES: {key: Status; color: string; glow: string}[] = [
  {key: 'present', color: '#1e8a5a', glow: '0 4px 12px rgba(30,138,90,0.4)'},
  {key: 'absent', color: '#c0392b', glow: '0 4px 12px rgba(192,57,43,0.4)'},
  {key: 'late', color: '#b98900', glow: '0 4px 12px rgba(185,137,0,0.4)'},
  {key: 'excused', color: '#5d6180', glow: '0 4px 12px rgba(93,97,128,0.4)'},
];

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
      setPending((prev) => ({...prev, [studentId]: status}));
    },
    [canEdit],
  );

  // Tick cả lớp 1 trạng thái (rồi chỉnh từng em sau).
  const setAllStatus = useCallback(
    (status: Status) => {
      if (!canEdit) return;
      setSavedFlash(false);
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
    const entries = Object.entries(pending);
    await Promise.all(
      entries.map(([studentId, status]) =>
        supabase.rpc('mark_attendance', {
          p_class: classId,
          p_student: studentId,
          p_status: status,
        }),
      ),
    );
    setSaved((prev) => ({...prev, ...pending}));
    setPending({});
    setSaving(false);
    setSavedFlash(true);
  }, [canEdit, classId, dirtyCount, pending, supabase]);

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
        <div className="flex min-w-[540px] items-center gap-2 bg-white/40 px-[18px] py-2.5">
          <span className="flex-1 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
            {/* Không có key i18n riêng cho tiêu đề cột này — hardcode tiếng Việt */}
            Học sinh
          </span>
          {STATUSES.map((s) => (
            <span
              key={s.key}
              className="w-[60px] flex-none text-center text-[10.5px] font-extrabold"
              style={{color: s.color}}
            >
              {t(s.key)}
            </span>
          ))}
        </div>

        {/* Chọn cả lớp → hàng nút tick-all */}
        {canEdit && (
          <div className="flex min-w-[540px] items-center gap-2 border-t border-navy/[0.08] bg-white/25 px-[18px] py-2">
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
              className="flex min-w-[540px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-white/35"
            >
              <span className="w-5 flex-none text-[12px] font-bold" style={{color: '#a6abc4'}}>
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
                      className={`grid h-[34px] w-[34px] place-items-center rounded-full border-[1.5px] transition-all ${
                        active
                          ? 'text-white'
                          : 'border-navy/20 bg-white/55 text-transparent hover:border-navy'
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
          {t('present')}: <b className="text-success">{presentCount}</b> / {students.length}
        </div>
        <span className="flex-1" />
        {canEdit && savedFlash && dirtyCount === 0 && (
          <span className="inline-flex flex-none items-center gap-1 text-[13px] font-extrabold text-success">
            <Check size={15} strokeWidth={3} />
            {t('savedAt')}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={save}
            disabled={saving || dirtyCount === 0}
            className="btn-gold h-[42px] flex-none cursor-pointer rounded-[14px] px-5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? t('saving')
              : dirtyCount > 0
                ? `${t('save')} (${dirtyCount})`
                : t('save')}
          </button>
        )}
      </div>
      <p className="text-[11px] italic text-grey-mid">{t('realtimeNote')}</p>
    </div>
  );
}
