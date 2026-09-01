'use client';

import {useOptimistic, useState, useTransition} from 'react';
import {useRouter} from '@/i18n/navigation';
import {Loader2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

// ════════════════════════════════════════════════════════════════════════════════════════════
// CÔ TICK VIỆC CHUNG CỦA LỚP
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án 16/08/2026: "có leadmeasure nhưng cô là người tick, các em ko cần thấy cái đó".
//
// Trước bản này, việc chung của lớp nằm trên màn của MỌI em và mỗi em tick phần của mình. Cùng
// ngày ấy chủ dự án nhìn màn một em — hai việc chung cộng hai việc riêng, bốn dòng không phân
// hạng — và hỏi "sao mà cân bằng được". Nay chia lại cho đúng chủ: việc chung là phần của cô,
// việc riêng là phần của em.
//
// ── MỘT LƯỢT CỦA LỚP LÀ MỘT DÒNG KHÔNG GẮN VỚI EM NÀO ────────────────────────────────────────
//
// Đây là lượt `ca_doi` (thước có `pham_vi='ca_doi'` — cả đội tính chung, cô là người điền). Trong
// bảng `luot`, một lượt cả đội để `student_id` RỖNG (`coalesce(student_id, 'doi')` gộp mọi dòng
// rỗng lại thành một chủ thể "doi"), còn lượt của TỪNG em thì mang `student_id` của em ấy. Mọi
// bảng đếm "em nào đã tham gia" đều lọc theo `student_id is not null` — nên một lượt của lớp không
// lẫn vào phần của bất kỳ em nào, và cũng không làm em nào bỗng dưng "đã đủ".
//
// Ghi thẳng qua supabase client, không qua server action: đây là một cú chạm trong lúc cô đang
// nhìn bảng, và một vòng revalidate cả trang chỉ để đổi màu một ô là bắt cô chờ đúng lúc không
// nên chờ. RLS trên `luot` đã cho GVCN toàn quyền với lớp mình, trigger `luot_truoc_ghi` tự điền
// `nguoi_ghi` là cô và vẫn chặn nếu ngày ấy không thuộc thứ mà việc này áp dụng.
export function TickCuaLop({
  leadId,
  days,
  daTick,
  today,
  moKhoa,
  dayShort,
}: {
  /** Id của thước (`thuoc.id`) mà lớp tick chung. */
  leadId: string;
  /** Những ngày trong tuần đang xem mà việc này áp dụng, dạng 'YYYY-MM-DD'. */
  days: string[];
  /** Ngày đã có lượt của LỚP (student_id rỗng). */
  daTick: string[];
  /** Hôm nay theo giờ VN — không tick trước ngày. */
  today: string;
  /** Tuần chưa chốt thì còn sửa được. */
  moKhoa: boolean;
  dayShort: string[];
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [, startTransition] = useTransition();
  const [dangGhi, setDangGhi] = useState<ReadonlySet<string>>(() => new Set());
  const [view, apply] = useOptimistic(daTick, (state: string[], a: {date: string; on: boolean}) =>
    a.on ? [...state, a.date] : state.filter((d) => d !== a.date),
  );

  async function chuyen(date: string) {
    if (!moKhoa || date > today || dangGhi.has(date)) return;
    const on = !view.includes(date);
    setDangGhi((p) => new Set(p).add(date));
    startTransition(() => apply({date, on}));

    const {error} = on
      ? await supabase.from('luot').insert({
          thuoc_id: leadId,
          // RỖNG — đây là lượt cả đội, không của em nào. Xem ghi chú đầu tệp.
          student_id: null,
          ngay: date,
          // Một chạm = một lượt. `gia_tri` đã theo đơn vị của thước; trigger tự điền `nguoi_ghi`.
          gia_tri: 1,
        })
      : await supabase
          .from('luot')
          .delete()
          .eq('thuoc_id', leadId)
          .is('student_id', null)
          .eq('ngay', date)
          // Chỉ xoá lượt cô điền tay; lượt hệ thống (từ điểm danh) luôn gắn student_id nên không lọt.
          .eq('nguon', 'tay');

    setDangGhi((p) => {
      const s = new Set(p);
      s.delete(date);
      return s;
    });
    // Hỏng thì tải lại để ô trả về đúng sự thật — im lặng nuốt lỗi ở đây là cô tưởng đã ghi.
    if (error) router.refresh();
    else startTransition(() => router.refresh());
  }

  if (days.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {days.map((d) => {
        const on = view.includes(d);
        const sau = d > today;
        const bay = dangGhi.has(d);
        const thu = dayShort[(new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7];
        return (
          <button
            key={d}
            type="button"
            onClick={() => chuyen(d)}
            disabled={!moKhoa || sau || bay}
            aria-pressed={on}
            aria-label={`${thu} ${d.slice(8, 10)}/${d.slice(5, 7)}`}
            className={`grid h-11 w-11 place-items-center rounded-[9px] border-[1.5px] text-[11.5px] font-extrabold transition-all disabled:cursor-not-allowed ${
              on
                // Ô ĐÃ TICK DÙNG ĐÚNG KIỂU CỦA MÀN EM: nền vàng, chữ navy. Bản đầu tôi chọn nền
                // xanh chữ trắng — nhìn thì hợp lý, nhưng đo ra 4.34:1, dưới ngưỡng 4.5 của chính
                // dự án. Bảng màu đã có sẵn một cặp đạt và quen mắt; thêm một cặp mới chỉ để đẹp
                // theo ý mình là vừa lệch kiểu vừa hỏng tương phản.
                ? 'border-transparent bg-gold text-navy shadow-[var(--shadow-gold)]'
                : sau || !moKhoa
                  ? 'border-navy/10 bg-white text-grey-soft'
                  : 'cursor-pointer border-navy/15 bg-white text-grey-mid hover:border-navy'
            }`}
          >
            {bay ? <Loader2 size={13} strokeWidth={2.5} className="animate-spin" /> : thu}
          </button>
        );
      })}
    </div>
  );
}
