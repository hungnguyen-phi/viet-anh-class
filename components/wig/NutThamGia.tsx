'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, Loader2, Users} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

// ════════════════════════════════════════════════════════════════════════════════════════════
// "LỚP ĐANG HỌP — VÀO PHÒNG" (0130)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án: "khi giáo viên ấn họp, tất cả màn hình của các em đều hiện phòng họp, xong rồi các
// em ấn tham gia, gv sẽ biết ai đang tham gia".
//
// BẤM THAM GIA CHỈ LÀ DẤU CÓ MẶT, KHÔNG PHẢI CỬA. Mấy ô biên bản bên dưới luôn mở, bất kể em đã
// bấm hay chưa — chủ dự án chốt rõ: "ko phải ai tham gia mới được điền, điền sau cũng được".
// Nếu nút này khoá phần điền thì một em mất mạng giữa buổi họp sẽ mất luôn cả buổi.
//
// Ghi thẳng qua RPC thay vì server action: đây là một cú chạm giữa buổi họp, và một vòng
// revalidate cả trang chỉ để đổi một dòng chữ là bắt em chờ đúng lúc không nên chờ.
export function NutThamGia({
  classId,
  weekLabel,
  weekStart,
  daThamGia,
}: {
  classId: string;
  weekLabel: string;
  weekStart: string;
  daThamGia: boolean;
}) {
  const t = useTranslations('meeting');
  const [supabase] = useState(() => createClient());
  const [vao, setVao] = useState(daThamGia);
  const [dangGui, setDangGui] = useState(false);

  async function thamGia() {
    if (vao || dangGui) return;
    setDangGui(true);
    // Đổi mặt ngay rồi mới đi mạng: cú chạm phải có phản hồi tức thì. Hỏng thì trả lại nguyên
    // trạng để em bấm lần nữa — im lặng nuốt lỗi ở đây là cô ngồi đợi một cái tên không tới.
    const {error} = await supabase.rpc('hs_tham_gia', {
      p_class: classId,
      p_week_label: weekLabel,
      p_week_start: weekStart,
    });
    setDangGui(false);
    if (!error) setVao(true);
  }

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] border-[1.5px] border-gold-deep/30 bg-gold/[0.14] p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-gold/40 text-gold-text">
        <Users size={17} strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-bold text-navy">{t('roomInvite')}</p>
        <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-grey-mid">
          {t('roomInviteHint', {week: weekLabel})}
        </p>
      </div>
      {vao ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-[12px] font-extrabold text-success-dark">
          <Check size={13} strokeWidth={3} />
          {t('roomJoined1')}
        </span>
      ) : (
        <button
          type="button"
          onClick={thamGia}
          disabled={dangGui}
          className="btn-gold inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-[12px] px-4 font-display text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {dangGui && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
          {t('roomJoin')}
        </button>
      )}
    </section>
  );
}
