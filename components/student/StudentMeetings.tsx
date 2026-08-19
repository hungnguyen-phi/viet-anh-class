import {getTranslations} from 'next-intl/server';
import {MessagesSquare, Target} from 'lucide-react';
import {SuTu} from '@/components/ui/SuTu';
import {khoangTuan, cachTuan} from '@/lib/dates';
import {BuddyChat, type BuddyMessage} from './BuddyChat';

// Số lượt học sinh được nói mỗi buổi họp — phải khớp BUDDY_CHAT_MAX_USER_TURNS ở server action.
const CHAT_MAX_TURNS = 10;

export type StudentMeeting = {
  id: string;
  week_label: string;
  results: string | null;
  commitments: string | null;
  next_actions: string | null;
  // Ghi chú Buddy do LLM sinh (0042). Ghi ở server bằng service_role — học sinh chỉ đọc.
  buddy_note: string | null;
  // "Việc hôm nay" Buddy chọn — đã được server kiểm là lead measure thật của em (0043).
  buddy_focus_title: string | null;
  buddy_action: string | null;
  buddy_chat_open: boolean;
  buddy_messages: BuddyMessage[];
  created_at: string;
};

// MỘT CHỮ BUDDY, MỘT NGHĨA — con sư tử AI, không phải bạn ngồi cùng lớp.
//
// Trước 12/08/2026 app mang HAI khái niệm cùng tên "Buddy" trên cùng một trang: (a) Buddy LLM
// (lib/buddy.ts — sinh ghi chú mỗi ngày, chat trong buổi họp) và (b) một bạn cùng lớp được ghép
// cặp hằng tuần (bảng buddy_pairs, huy hiệu "Bạn đồng hành tuần này", ô chọn bạn trong biên bản).
// Người dùng đọc "Bạn đồng hành: Mạnh Hùng Lê Quý" rồi hỏi lại vì sao Buddy không phải con sư tử
// — đúng chỗ hai nghĩa đá nhau. Chủ dự án chốt: bỏ nghĩa (b), giữ nghĩa (a).
//
// Bảng buddy_pairs và cột wig_meetings.buddy_id KHÔNG xoá — dữ liệu cũ vẫn còn nguyên, chỉ thôi
// đọc và thôi ghi. Xoá cột là mất biên bản cũ mà không đổi lại được gì.
export async function StudentMeetings({
  meetings,
  canManage,
  canChat,
  tuanNay,
}: {
  meetings: StudentMeeting[];
  canManage: boolean;
  // true = chính em học sinh đó đang xem → được chat khi GVCN mở.
  canChat: boolean;
  /** Nhãn tuần hiện tại ('W34-2026') — mốc để gọi tên từng thẻ là "Tuần này/Tuần trước/N tuần trước". */
  tuanNay: string;
}) {
  const t = await getTranslations('student');

  // XẾP THEO TUẦN, KHÔNG THEO created_at (19/08/2026). Bản cũ xếp theo lúc TẠO DÒNG, mà dòng
  // W31 có thể sinh sau dòng W33 (tick bù, Sư Tử nhắn muộn) — màn hình ra "W32, W33, W31" và
  // chủ dự án gọi đúng tên: "lộn xộn giữa các tuần, không có 1 cái gì rõ ràng cả". Trục thời
  // gian của khu này là TUẦN; created_at chỉ còn phân thắng bại khi hai dòng cùng tuần.
  const soTuan = (lb: string) => {
    const m = /^W(\d{2})-(\d{4})$/.exec(lb);
    return m ? Number(m[2]) * 100 + Number(m[1]) : 0;
  };
  meetings = [...meetings].sort(
    (a, b) => soTuan(b.week_label) - soTuan(a.week_label) || b.created_at.localeCompare(a.created_at),
  );

  // "W32-2026" trần là mã máy. Mỗi thẻ mang thêm: tên quan hệ (Tuần này / Tuần trước / N tuần
  // trước) + khoảng ngày — em đọc phát biết ngay thẻ nói về quãng nào.
  const tenQuanHe = (lb: string) => {
    const n = cachTuan(lb, tuanNay);
    if (n === null || n < 0) return null;
    if (n === 0) return t('weekThis');
    if (n === 1) return t('weekLast');
    return t('weeksAgo', {n});
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Huy hiệu "Buddy của em" (sư tử) ĐÃ GỠ 17/08/2026 — một cái pill đứng một mình, không
          bấm được, chỉ thêm một dòng cho khu họp. Sư tử vẫn nói trong khung ghi chú dưới biên bản. */}

      {/* Form "Cô ghi lại buổi họp WIG tuần của riêng bạn" ĐÃ GỠ 16/08/2026: lời của em là em viết ở
          /student/hop; cô đọc, không ghi thay. */}

      {meetings.length === 0 ? (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/15 bg-navy/[0.02] p-5 text-center text-[12.5px] font-semibold italic text-grey-mid">
          {t('noMeetings')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* TUẦN MỚI NHẤT MỞ, TUẦN CŨ GẤP (16/08/2026). Chủ dự án: "càng ngày càng nhiều tuần thì
              không thể cứ đặt xuống dài bên dưới". Mỗi tuần một thẻ đầy đủ là sau một học kỳ trang
              dài thêm hai chục thẻ; ai cần đọc lại thì mở. */}
          {meetings.slice(0, 1).map(theBienBan)}
          {meetings.length > 1 && (
            <details className="rounded-[16px] border-[1.5px] border-navy/10">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-[12.5px] font-extrabold text-navy">
                {t('olderWeeks', {n: meetings.length - 1})}
              </summary>
              <div className="flex flex-col gap-2.5 px-3 pb-3">{meetings.slice(1).map(theBienBan)}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );

  function theBienBan(m: StudentMeeting) {
    return (
            <div key={m.id} className="glass rounded-[16px] p-4">
              <div className="flex flex-wrap items-center gap-2 text-navy">
                <MessagesSquare size={14} strokeWidth={2.5} className="text-gold-deep" />
                {tenQuanHe(m.week_label) && (
                  <span className="font-display text-[14px] font-bold">{tenQuanHe(m.week_label)}</span>
                )}
                <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums text-grey-mid">
                  {m.week_label}
                  {khoangTuan(m.week_label) && ` · ${khoangTuan(m.week_label)}`}
                </span>
              </div>
              {m.results && (
                <div className="mt-3 text-[13px] font-semibold text-navy">
                  <b className="text-grey-mid">{t('reflection')}: </b>
                  <span className="whitespace-pre-line">{m.results}</span>
                </div>
              )}
              {m.commitments && (
                <div className="mt-1.5 text-[13px] font-semibold text-navy">
                  <b className="text-grey-mid">{t('commitments')}: </b>
                  <span className="whitespace-pre-line">{m.commitments}</span>
                </div>
              )}
              {m.next_actions && (
                <div className="mt-1.5 text-[13px] font-semibold text-navy">
                  <b className="text-grey-mid">{t('nextActions')}: </b>
                  <span className="whitespace-pre-line">{m.next_actions}</span>
                </div>
              )}
              {m.buddy_note && (
                <div className="mt-3 rounded-[14px] border-[1.5px] border-gold/40 bg-gold/[0.07] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-gold-text">
                    <SuTu size={15} />
                    {t('buddyNote')}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[13px] font-semibold text-navy">
                    {m.buddy_note}
                  </p>
                  {/* "Việc hôm nay" — trỏ đúng một lead measure thật, không phải chữ model tự bịa */}
                  {m.buddy_action === 'tick_lead' && m.buddy_focus_title && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-extrabold text-navy">
                      <Target size={12} strokeWidth={2.5} className="text-gold-deep" />
                      {t('buddyToday')}: {m.buddy_focus_title}
                    </p>
                  )}
                  {m.buddy_action === 'checkin_mood' && (
                    <p className="mt-2 text-[12px] font-bold text-navy">{t('buddyTodayMood')}</p>
                  )}
                  {m.buddy_action === 'ask_teacher' && (
                    <p className="mt-2 text-[12px] font-bold text-navy">{t('buddyTodayAsk')}</p>
                  )}
                </div>
              )}

              {/* Công tắc "Mở Buddy cho buổi họp" của cô ĐÃ GỠ 16/08/2026 (cô chỉ duyệt, mọi thứ khác
                  chỉ xem). Chat Buddy vì thế chưa có đường mở — bật lại khi có quyết định mới. */}
              {/* Học sinh: khung chat, chỉ hiện khi GVCN đã mở */}
              {canChat && m.buddy_chat_open && (
                <BuddyChat
                  meetingId={m.id}
                  messages={m.buddy_messages}
                  turnsLeft={Math.max(
                    0,
                    CHAT_MAX_TURNS - m.buddy_messages.filter((x) => x.role === 'user').length,
                  )}
                />
              )}
              {/* Người lớn xem lại được toàn bộ hội thoại — bắt buộc với app cho trẻ em */}
              {canManage && m.buddy_messages.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px] font-extrabold text-navy">
                    {t('buddyChatTranscript')} ({m.buddy_messages.length})
                  </summary>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {m.buddy_messages.map((x) => (
                      <div key={x.id} className="text-[12px] font-semibold text-navy">
                        <b className="text-grey-mid">{x.role === 'user' ? t('buddyChatStudent') : t('buddyChatBuddy')}: </b>
                        <span className="whitespace-pre-line">{x.content}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
    );
  }
}
