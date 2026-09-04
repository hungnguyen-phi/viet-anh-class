'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {Star, Search, Loader2, X, Check} from 'lucide-react';
import {assignAttendanceLeader} from '@/app/[locale]/(dashboard)/roster/actions';
import {boDau} from '@/lib/don-vi';

export type LeaderCandidate = {id: string; name: string; email: string | null};

// Chọn tổ trưởng điểm danh: hiện ĐÚNG một người đang giữ + ô tìm để đổi.
// Trước đây mỗi dòng trong bảng lớp có một nút "Đặt làm tổ trưởng" — với lớp 30 em là 30 nút,
// và bấm xong im ~5 giây không phản hồi. Nay gom lại một chỗ, có spinner, và đổi người là
// người cũ tự được gỡ (server ép độc quyền, không tin client).
export function AttendanceLeaderPicker({
  classId,
  students,
  currentLeaderId,
}: {
  classId: string;
  students: LeaderCandidate[];
  currentLeaderId: string | null;
}) {
  const t = useTranslations('roster');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // id đang lưu, hoặc '__clear__'
  const [err, setErr] = useState<string | null>(null);

  const current = students.find((s) => s.id === currentLeaderId) ?? null;

  const matches = useMemo(() => {
    // Bỏ dấu cả hai phía: gõ "hung" phải ra "Hùng" — trên điện thoại gõ dấu chậm gấp đôi.
    const needle = boDau(q);
    const list = needle
      ? students.filter(
          (s) => boDau(s.name).includes(needle) || boDau(s.email ?? '').includes(needle),
        )
      : students;
    // Cắt 8 dòng cho danh sách khỏi dài; gõ thêm để lọc tiếp.
    return list.slice(0, 8);
  }, [q, students]);

  async function save(studentId: string | null) {
    if (busy) return;
    setBusy(studentId ?? '__clear__');
    setErr(null);
    const res = await assignAttendanceLeader(classId, studentId);
    setBusy(null);
    if (!res.ok) {
      setErr(res.error ?? t('leaderError'));
      return;
    }
    setOpen(false);
    setQ('');
    router.refresh();
  }

  return (
    <div className="glass rounded-[16px] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-nhan font-extrabold uppercase tracking-[0.04em] text-grey-mid">
          <Star size={12} strokeWidth={2.5} className="text-gold-deep" />
          {t('attendanceLeader')}
        </span>
        <span className="text-noi-dung font-extrabold text-navy">
          {current ? current.name : <span className="font-bold text-grey-mid">{t('leaderNone')}</span>}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {current && (
            <button
              type="button"
              onClick={() => save(null)}
              disabled={busy !== null}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-2.5 text-chu-thich font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.16] disabled:opacity-50"
            >
              {busy === '__clear__' ? <Loader2 size={12} className="animate-spin" /> : <X size={12} strokeWidth={2.5} />}
              {t('leaderClear')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border-[1.5px] border-navy/20 bg-white/60 px-2.5 text-chu-thich font-extrabold text-navy transition-colors hover:border-navy"
          >
            <Search size={12} strokeWidth={2.5} />
            {current ? t('leaderChange') : t('leaderPick')}
          </button>
        </span>
      </div>


      {open && (
        <div className="mt-2.5 rounded-[12px] border-[1.5px] border-navy/12 bg-white/70 p-2">
          <label className="flex items-center gap-2 rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 focus-within:border-navy">
            <Search size={14} strokeWidth={2.5} className="shrink-0 text-grey-mid" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder={t('leaderSearch')}
              className="h-9 min-w-0 flex-1 bg-transparent text-than font-semibold text-navy outline-none"
            />
          </label>

          {matches.length === 0 ? (
            <p className="px-1 py-2.5 text-center text-than font-semibold italic text-grey-mid">
              {t('leaderNoMatch')}
            </p>
          ) : (
            <div className="mt-1.5 flex flex-col">
              {matches.map((s) => {
                const isCurrent = s.id === currentLeaderId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => save(s.id)}
                    disabled={busy !== null || isCurrent}
                    className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-navy/[0.06] disabled:cursor-default disabled:opacity-60"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center">
                      {busy === s.id ? (
                        <Loader2 size={12} className="animate-spin text-navy" />
                      ) : isCurrent ? (
                        <Check size={12} strokeWidth={2.5} className="text-success" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-than font-extrabold text-navy">{s.name}</span>
                      {s.email && (
                        <span className="block truncate text-chu-thich font-semibold text-grey-mid">
                          {s.email}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {err && (
        <p className="mt-2 rounded-[12px] bg-status-bad/10 px-3 py-1.5 text-xs font-bold text-status-bad">{err}</p>
      )}
    </div>
  );
}
