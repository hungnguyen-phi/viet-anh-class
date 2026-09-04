import {getTranslations} from 'next-intl/server';
import {MessagesSquare, ShieldCheck} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';

type Dich = (key: string, values?: Record<string, string | number>) => string;


// ============================================================
// SỨC KHOẺ KÊNH LIÊN LẠC — thẻ dành cho BAN GIÁM HIỆU / QUẢN TRỊ VIÊN.
//
// Đây là toàn bộ những gì hai vai đó được biết về kênh phụ huynh ↔ GVCN: MỖI LỚP MỘT DÒNG SỐ.
// Không tên học sinh, không tên phụ huynh, không một câu nội dung nào. Đúng thiết kế của 0065:
// họ cần đôn đốc giáo viên trả lời phụ huynh, mà việc đó không đòi hỏi đọc chuyện riêng của một
// gia đình nào.
//
// Component TỰ đi hỏi dữ liệu (async server component) để nơi gắn chỉ việc viết
// <MessageHealthCard /> — không phải truyền props, không phải nhớ gọi RPC nào.
//
// pt_class_message_health() là SECURITY DEFINER nhưng TỰ KIỂM QUYỀN bên trong bằng
// auth_role()/auth_campus(): giáo viên hay phụ huynh gọi cũng chỉ nhận 0 dòng. Nghĩa là đặt nhầm
// thẻ này vào một trang mà giáo viên xem được cũng KHÔNG rò gì — nhưng đừng làm vậy, vì một thẻ
// trống rỗng chỉ khiến người ta tưởng hỏng.
// ============================================================

type HealthRow = {
  class_id: string;
  class_name: string;
  thread_count: number;
  waiting_count: number;
  oldest_waiting_hours: number | null;
};

// Chờ bao lâu — làm tròn cho dễ đọc. Quá 48 tiếng thì tính bằng NGÀY: "62 giờ" không nói lên
// điều gì với người đang lướt bảng, "3 ngày" thì có.
function choLau(h: number | null, t: Dich): string {
  if (h == null) return '—';
  if (h < 1) return t('underAnHour');
  if (h < 48) return t('agoHours', {n: Math.round(h)});
  return t('agoDays', {n: Math.round(h / 24)});
}

// Ngưỡng màu: một ngày chưa trả lời là bắt đầu đáng nhắc, hai ngày là đã trễ.
function mauCho(h: number | null): string {
  if (h == null) return 'text-grey-mid';
  if (h >= 48) return 'text-status-bad';
  if (h >= 24) return 'text-warn-text';
  return 'text-grey-mid';
}

export async function MessageHealthCard() {
  const t = await getTranslations('inbox');
  const supabase = await createClient();
  const {data} = await supabase.rpc('pt_class_message_health');
  const tatCa = (data ?? []) as unknown as HealthRow[];

  // Không có lớp nào trong tầm quản lý → không vẽ gì, để trang khỏi thêm một thẻ rỗng vô nghĩa.
  if (tatCa.length === 0) return null;

  const rows = tatCa.filter((r) => Number(r.thread_count) > 0);
  const tongCho = rows.reduce((s, r) => s + Number(r.waiting_count ?? 0), 0);

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-noi-dung font-bold text-navy">
          <MessagesSquare size={16} strokeWidth={2} />
          {t('healthTitle')}
        </h2>
        {tongCho > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-bad/[0.08] px-2.5 py-1 text-chu-thich font-extrabold text-status-bad">
            {t('cuocChuaTraLoi', {n: tongCho})}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-than italic text-grey-mid">
          {t('healthEmpty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[520px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
            <span className="flex-[1.4] text-nhan font-extrabold uppercase text-grey-mid">
              {t('thClass')}
            </span>
            <span className="w-[110px] flex-none text-center text-nhan font-extrabold uppercase text-grey-mid">
              {t('thThreads')}
            </span>
            <span className="w-[110px] flex-none text-center text-nhan font-extrabold uppercase text-grey-mid">
              {t('thWaiting')}
            </span>
            <span className="w-[130px] flex-none text-center text-nhan font-extrabold uppercase text-grey-mid">
              {t('thLongest')}
            </span>
          </div>
          {rows.map((r) => (
            <div
              key={r.class_id}
              className="flex min-w-[520px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2 transition-colors hover:bg-navy/[0.03]"
            >
              <span className="min-w-0 flex-[1.4] truncate text-noi-dung font-bold text-navy">
                {r.class_name}
              </span>
              <span className="w-[110px] flex-none text-center text-than font-semibold text-grey-mid">
                {r.thread_count}
              </span>
              <span
                className={`w-[110px] flex-none text-center text-than font-bold ${
                  Number(r.waiting_count) > 0 ? 'text-status-bad' : 'text-grey-mid'
                }`}
              >
                {r.waiting_count}
              </span>
              <span
                className={`w-[130px] flex-none text-center text-than font-bold ${mauCho(
                  r.oldest_waiting_hours,
                )}`}
              >
                {choLau(r.oldest_waiting_hours, t)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 inline-flex items-start gap-1.5 text-chu-thich italic text-grey-mid">
        <ShieldCheck size={12} strokeWidth={2.5} className="mt-px shrink-0" />
        {t('healthFoot')}
      </p>
    </section>
  );
}
