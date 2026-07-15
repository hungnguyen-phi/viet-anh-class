'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {createClient} from '@/lib/supabase/client';
import type {Database} from '@/lib/database.types';

type Status = Database['public']['Enums']['attendance_status'];
type Student = {id: string; name: string};

const STATUSES: {key: Status; activeClass: string}[] = [
  {key: 'present', activeClass: 'bg-success text-white border-success'},
  {key: 'absent', activeClass: 'bg-status-bad text-white border-status-bad'},
  {key: 'late', activeClass: 'bg-warn text-navy border-warn'},
  {key: 'excused', activeClass: 'bg-grey-mid text-white border-grey-mid'},
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
    return <p className="text-sm text-grey-mid">{t('noStudents')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-grey-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-grey-light text-navy">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left" />
              {STATUSES.map((s) => (
                <th key={s.key} className="px-2 py-2 text-center font-bold">
                  {t(s.key)}
                </th>
              ))}
            </tr>
            {canEdit && (
              <tr className="border-t border-grey-line bg-grey-light/60">
                <td />
                <td className="px-3 py-1 text-right text-[11px] font-bold text-grey-mid">
                  {t('tickAll')} →
                </td>
                {STATUSES.map((s) => (
                  <td key={s.key} className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setAllStatus(s.key)}
                      title={`${t('tickAll')}: ${t(s.key)}`}
                      className="rounded border border-grey-line bg-white px-2 py-0.5 text-[11px] font-bold text-navy hover:border-navy"
                    >
                      ✓✓
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {students.map((st, i) => {
              const cur = display(st.id);
              const isDirty = st.id in pending;
              return (
                <tr key={st.id} className="border-t border-grey-line">
                  <td className="px-3 py-2 text-grey-mid">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-ink">
                    {st.name}
                    {isDirty && <span className="ml-1 text-warn">•</span>}
                  </td>
                  {STATUSES.map((s) => {
                    const active = cur === s.key;
                    return (
                      <td key={s.key} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setStatus(st.id, s.key)}
                          aria-pressed={active}
                          className={`h-7 w-7 rounded-full border text-xs font-black transition-colors ${
                            active
                              ? s.activeClass
                              : 'border-grey-line bg-white text-grey-line hover:border-navy'
                          } ${!canEdit ? 'cursor-default opacity-90' : ''}`}
                        >
                          {active ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-grey-mid">
          {t('present')}: <b className="text-success">{presentCount}</b> / {students.length}
          <span className="ml-2 italic">{t('realtimeNote')}</span>
        </span>
        {canEdit && (
          <div className="flex items-center gap-2">
            {savedFlash && dirtyCount === 0 && (
              <span className="text-sm font-bold text-success">✓ {t('savedAt')}</span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || dirtyCount === 0}
              className="rounded-lg bg-navy px-5 py-2 font-heading font-bold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
            >
              {saving
                ? t('saving')
                : dirtyCount > 0
                  ? `${t('save')} (${dirtyCount})`
                  : t('save')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
