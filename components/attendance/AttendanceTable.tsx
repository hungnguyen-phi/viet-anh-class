'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {createClient} from '@/lib/supabase/client';

// ════════════════════════════════════════════════════════════════════════════════════════════
// BẢNG ĐIỂM DANH — CẢM XÚC VÀ GIỜ CHECK-IN, KHÔNG CÓ LỜI PHÁN XÉT
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án 16/08/2026: "phải là cảm xúc học sinh (icon) + thời gian checkin, không cần đánh giá
// là muộn hay trễ hay gì cả, ai không có thì để trống, mọi người tự hiểu là vắng" — và "bây giờ
// ko cấm giáo viên thấy được nữa".
//
// ── VÌ SAO BỎ BỐN CỘT TRẠNG THÁI ─────────────────────────────────────────────────────────────
//
// Bảng cũ là một lưới bốn nút — có mặt · vắng · muộn · có phép — cô bấm từng em. Từ 0127 điểm
// danh không còn là việc của cô: CHÍNH EM check-in, và bản ghi điểm danh sinh ra từ cú check-in
// ấy. Nên bốn cột kia là một bàn phím đã tháo dây: bấm vào không đổi được gì, mà vẫn nằm đó dạy
// sai người dùng về ai là chủ của việc này.
//
// Và nhãn "muộn" thì tệ hơn một cột thừa. Nó là lời phán xét gắn vào tên một đứa trẻ, sinh ra từ
// một cái mốc giờ máy tự đặt — trong khi thứ người lớn thật sự cần biết chỉ là: em đã tới chưa,
// và hôm nay em thấy thế nào.
//
// Ô TRỐNG LÀ ĐỦ. Không cần chữ "vắng" tô đỏ: một hàng trống giữa những hàng có mặt thì ai nhìn
// cũng hiểu, và nó không kết tội ai.
//
// ── VÌ SAO CÔ THẤY ĐƯỢC CẢM XÚC ──────────────────────────────────────────────────────────────
//
// Màn này từng cố ý giấu cảm xúc khỏi cô (quyết định cũ). Nay đảo lại. RLS vốn đã cho phép từ lâu
// — `staff_can_read_class` nằm sẵn trong `rls_select_mood_checkins` — chỉ có giao diện là chưa
// bày ra. Nghĩa là bản này KHÔNG nới một quyền nào; nó thôi giấu một thứ mà người có quyền vẫn
// luôn được xem.
// 6 CẢM XÚC v3 (18/08/2026) + 5 mức thang cũ để đọc lịch sử. Từ 0148 bộ chọn của em chỉ gửi 6
// khoá mới; thiếu chúng ở đây (audit) thì mọi check-in mới hiện giờ bấm mà KHÔNG có emoji/nhãn —
// đúng thứ màn này vừa mở ra để cô thấy. Nhãn lấy qua i18n roster.mood.* (đủ 11 khoá vi+en).
const MOOD_EMOJI: Record<string, string> = {
  happy: '😄', okay: '😐', sad: '😢', tired: '😪', worried: '😟', angry: '😠',
  great: '😄', good: '🙂', ok: '😐', low: '😟', bad: '😢',
};

export type DongDiemDanh = {
  id: string;
  name: string;
  /** Cảm xúc và giờ bấm của mỗi buổi. Rỗng = em chưa check-in buổi ấy. */
  moodSang?: string | null;
  gioSang?: string | null;
  moodChieu?: string | null;
  gioChieu?: string | null;
};

// 'HH:MM' theo giờ VN. Cắt ở trình duyệt của cô chứ không ở máy chủ: máy chủ chạy UTC, và cắt
// chuỗi ở đó là đúng cái bẫy lệch múi giờ đã dính vài lần trong dự án này.
const gio = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : null;

function O({m, t, nhan}: {m?: string | null; t?: string | null; nhan?: string}) {
  const emoji = m ? MOOD_EMOJI[m] : null;
  if (!emoji && !t) return <span className="text-grey-soft">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {emoji && (
        <span title={nhan} aria-label={nhan} className="text-[17px] leading-none">
          {emoji}
        </span>
      )}
      {t && <span className="text-[12px] font-bold tabular-nums text-grey-mid">{t}</span>}
    </span>
  );
}

export function AttendanceTable({
  classId,
  today,
  students,
}: {
  classId: string;
  today: string;
  students: DongDiemDanh[];
}) {
  const t = useTranslations('attendance');
  const tMood = useTranslations('roster');
  const nhanMood = (m?: string | null) => (m ? tMood(`mood.${m}`) : undefined);
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState(students);

  useEffect(() => setRows(students), [students]);

  // Em bấm check-in thì bảng của cô đổi ngay, không phải tải lại. Cùng đường postgres_changes đã
  // dùng ở phòng họp — nó áp đúng RLS, khác với kênh broadcast.
  useEffect(() => {
    const kenh = supabase
      .channel(`diem-danh-${classId}-${today}`)
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'mood_checkins', filter: `class_id=eq.${classId}`},
        async () => {
          const {data} = await supabase
            .from('mood_checkins')
            .select('student_id, mood, buoi, created_at')
            .eq('class_id', classId)
            .eq('date', today);
          setRows((truoc) =>
            truoc.map((r) => {
              const sang = (data ?? []).find((x) => x.student_id === r.id && x.buoi !== 'chieu');
              const chieu = (data ?? []).find((x) => x.student_id === r.id && x.buoi === 'chieu');
              return {
                ...r,
                moodSang: sang?.mood ?? null,
                gioSang: sang?.created_at ?? null,
                moodChieu: chieu?.mood ?? null,
                gioChieu: chieu?.created_at ?? null,
              };
            }),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kenh);
    };
  }, [supabase, classId, today]);

  if (rows.length === 0) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{t('noStudents')}</p>
      </div>
    );
  }

  const coMat = rows.filter((r) => r.moodSang || r.moodChieu).length;

  return (
    <div className="space-y-3">
      <div className="glass overflow-x-auto rounded-[20px]">
        <div className="flex items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
          <span className="flex-1">{t('student')}</span>
          <span className="w-[78px] flex-none">{t('morning')}</span>
          <span className="w-[78px] flex-none">{t('afternoon')}</span>
        </div>

        {rows.map((st, i) => (
          <div
            key={st.id}
            className={`flex items-center gap-2 px-[18px] py-2.5 ${
              i > 0 ? 'border-t border-navy/[0.06]' : ''
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-navy">
              {st.name}
            </span>
            <span className="w-[78px] flex-none">
              <O m={st.moodSang} t={gio(st.gioSang)} nhan={nhanMood(st.moodSang)} />
            </span>
            <span className="w-[78px] flex-none">
              <O m={st.moodChieu} t={gio(st.gioChieu)} nhan={nhanMood(st.moodChieu)} />
            </span>
          </div>
        ))}
      </div>

      <p className="text-[12px] font-bold text-grey-mid">
        {t('checkedInCount', {n: coMat, total: rows.length})}
      </p>
    </div>
  );
}
