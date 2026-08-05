import {getTranslations} from 'next-intl/server';
import {Eye} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';

// "LỚP NÀY KHÔNG PHẢI CỦA BẠN."
//
// Quản trị viên và ban giám hiệu mở /wig, /attendance, /roster… thì hệ thống tự chọn lớp đầu tiên
// theo tên rồi thả họ vào đó — không nói một lời rằng đây là lớp của người khác. Màn hình chỉ ghi
// "WIG & Lead measure · Lớp 10A1", trông y hệt như thể đó là lớp của chính họ.
//
// Hệ quả thật, chủ dự án vừa gặp: gõ mục tiêu tuần vào lớp của giáo viên khác mà không biết, rồi
// người ta mở lên thấy WIG mình không đặt.
//
// Không hiện gì khi người xem CHÍNH LÀ chủ nhiệm — lúc ấy câu này chỉ là tiếng ồn.
export async function ClassOwnerNote({
  classId,
  viewerId,
  viewerRole,
}: {
  classId: string;
  viewerId: string;
  viewerRole: string;
}) {
  if (viewerRole !== 'admin' && viewerRole !== 'principal') return null;

  const t = await getTranslations('common');
  const supabase = await createClient();
  const {data} = await supabase
    .from('classes')
    .select('homeroom_teacher_id, gvcn:profiles!classes_homeroom_teacher_id_fkey(full_name, email)')
    .eq('id', classId)
    .maybeSingle();

  const row = data as unknown as {
    homeroom_teacher_id: string | null;
    gvcn: {full_name: string | null; email: string} | null;
  } | null;
  if (!row || row.homeroom_teacher_id === viewerId) return null;

  const ten = row.gvcn?.full_name ?? row.gvcn?.email ?? null;

  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-navy/[0.06] px-3 py-1 text-[11.5px] font-bold text-grey-mid">
      <Eye size={12} strokeWidth={2.4} />
      {ten ? t('viewingOthersClass', {name: ten}) : t('viewingClassNoOwner')}
    </p>
  );
}
