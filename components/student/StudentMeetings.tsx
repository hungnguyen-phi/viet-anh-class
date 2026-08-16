import {getTranslations} from 'next-intl/server';
import {MessagesSquare, Sparkles, Target, Lock, Unlock} from 'lucide-react';
import {SuTu} from '@/components/ui/SuTu';
import {toggleBuddyChat} from '@/app/[locale]/(dashboard)/student/actions';
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
  studentId,
  meetings,
  canManage,
  canChat,
}: {
  studentId: string;
  meetings: StudentMeeting[];
  canManage: boolean;
  // true = chính em học sinh đó đang xem → được chat khi GVCN mở.
  canChat: boolean;
}) {
  const t = await getTranslations('student');

  return (
    <div className="flex flex-col gap-3">
      {/* Buddy của em là con sư tử AI — nói bằng HÌNH, không bằng chữ giải thích (yêu cầu
          12/08/2026): icon đầu sư tử đứng cạnh chữ đã đủ, thêm "là chú sư tử AI" thành ra giảng
          giải. Khung ghi chú Buddy bên dưới mỗi biên bản mới là chỗ nó nói. */}
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1.5 text-[12px] font-bold text-navy">
        <SuTu size={15} />
        {t('buddyIsLion')}
      </div>

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
            <div key={m.id} className="glass rounded-[20px] p-[18px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 font-display text-xs font-bold text-white">
                  <MessagesSquare size={12} strokeWidth={2.5} />
                  {m.week_label}
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
                    <Sparkles size={12} strokeWidth={2.5} />
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

              {/* GVCN: công tắc mở Buddy cho buổi họp. Học sinh chỉ chat được khi đang mở → lúc
                  đó GVCN đang ngồi cạnh, đây là lớp bảo vệ chính cho chat với trẻ em. */}
              {canManage && (
                <form action={toggleBuddyChat} className="mt-3">
                  <input type="hidden" name="student_id" value={studentId} />
                  <input type="hidden" name="meeting_id" value={m.id} />
                  <input type="hidden" name="open" value={m.buddy_chat_open ? '0' : '1'} />
                  <button
                    type="submit"
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 text-[11.5px] font-extrabold text-navy transition-colors hover:border-navy"
                  >
                    {m.buddy_chat_open ? (
                      <Lock size={12} strokeWidth={2.5} />
                    ) : (
                      <Unlock size={12} strokeWidth={2.5} />
                    )}
                    {m.buddy_chat_open ? t('buddyChatClose') : t('buddyChatOpen')}
                  </button>
                </form>
              )}

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
                        <b className="text-grey-mid">{x.role === 'user' ? t('buddyChatStudent') : 'Buddy'}: </b>
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
