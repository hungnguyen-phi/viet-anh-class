import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {khiNao, daCho, soGioCho} from './format';

// Một dòng của hộp thư — đúng bằng cột mà RPC pt_my_threads() trả về (0065).
// Khai lại kiểu ở đây thay vì lôi Database['public']['Functions'] vào: bộ sinh kiểu để
// student_name/class_name không-null, nhưng chúng đến từ profiles.full_name và classes.name
// nên NULL là chuyện thật; khai đúng ở đây thì chỗ dùng buộc phải có phương án dự phòng.
export type ThreadItem = {
  thread_id: string;
  student_id: string;
  student_name: string | null;
  class_id: string;
  class_name: string | null;
  last_message_at: string | null;
  last_sender_side: string | null;
  unread_count: number;
  waiting_for_school: boolean;
};

const chipBase =
  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold';

/**
 * Xếp thứ tự hộp thư.
 *
 * PHÍA NHÀ TRƯỜNG: cuộc nào phụ huynh đã nhắn mà chưa ai trả lời thì lên đầu, và trong nhóm đó
 * người CHỜ LÂU NHẤT đứng trước. Đây là thứ tự theo việc-cần-làm chứ không theo thời gian: gia
 * đình chờ ba ngày quan trọng hơn gia đình vừa nhắn năm phút trước, dù tin của họ cũ hơn.
 * Đúng cái ban giám hiệu đo bằng pt_class_message_health().oldest_waiting_hours.
 *
 * PHÍA PHỤ HUYNH: giữ nguyên thứ tự mới-nhất-trước của RPC. Họ có một, hai cuộc, không cần
 * sắp theo việc.
 */
export function xepHopThu(items: ThreadItem[], nhinTuNhaTruong: boolean): ThreadItem[] {
  if (!nhinTuNhaTruong) return items;
  const moc = (x: ThreadItem) => (x.last_message_at ? new Date(x.last_message_at).getTime() : 0);
  return [...items].sort((a, b) => {
    if (a.waiting_for_school !== b.waiting_for_school) return a.waiting_for_school ? -1 : 1;
    // Nhóm đang chờ: cũ → mới (chờ lâu nhất lên đầu). Nhóm còn lại: mới → cũ.
    return a.waiting_for_school ? moc(a) - moc(b) : moc(b) - moc(a);
  });
}

export async function ThreadList({
  items,
  nhinTuNhaTruong,
}: {
  items: ThreadItem[];
  // true = GVCN đang xem hộp thư lớp mình; false = phụ huynh xem cuộc về con mình.
  nhinTuNhaTruong: boolean;
}) {
  const t = await getTranslations('inbox');
  const rows = xepHopThu(items, nhinTuNhaTruong);

  return (
    <div className="glass overflow-hidden rounded-[20px]">
      {rows.map((it, i) => {
        const chuaDoc = Number(it.unread_count) > 0;
        const gioCho = it.waiting_for_school ? soGioCho(it.last_message_at) : 0;
        return (
          <Link
            key={it.thread_id}
            // #moi-nhat: mở cuộc dài thì nhảy thẳng xuống tin mới nhất + ô soạn tin, không bắt
            // người đọc cuộn qua cả lịch sử mỗi lần vào.
            href={`/inbox?t=${it.thread_id}#moi-nhat`}
            className={`block px-4 py-3 transition-colors hover:bg-navy/[0.03] ${
              i > 0 ? 'border-t border-navy/[0.08]' : ''
            } ${chuaDoc ? 'bg-gold/[0.06]' : ''}`}
          >
            <div className="flex items-center gap-2">
              {chuaDoc && (
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-gold-deep" />
              )}
              <span className="truncate text-[14px] font-bold text-navy">
                {it.student_name ?? t('aStudentCap')}
              </span>
              {it.class_name && (
                <span className={`${chipBase} bg-navy/[0.08] text-navy/70`}>{it.class_name}</span>
              )}
              <span className="ml-auto shrink-0 text-[11px] font-semibold text-grey-mid">
                {it.last_message_at ? khiNao(it.last_message_at, t) : t('noMessagesYet')}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {chuaDoc && (
                <span className={`${chipBase} bg-gold/20 text-navy`}>
                  {it.unread_count} tin chưa đọc
                </span>
              )}
              {it.waiting_for_school &&
                (nhinTuNhaTruong ? (
                  <span
                    className={`${chipBase} ${
                      gioCho >= 24
                        ? 'bg-status-bad/[0.08] text-status-bad'
                        : 'bg-gold/20 text-gold-text'
                    }`}
                  >
                    {t('waitingFor')} · {daCho(it.last_message_at, t)}
                  </span>
                ) : (
                  <span className={`${chipBase} bg-navy/[0.08] text-grey-mid`}>
                    {t('waitingTeacher')}
                  </span>
                ))}
              {!it.waiting_for_school && it.last_sender_side === 'school' && !chuaDoc && (
                <span className={`${chipBase} bg-navy/[0.08] text-grey-mid`}>
                  {nhinTuNhaTruong ? t('repliedYou') : t('repliedTeacher')}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
