'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ImageUp, Loader2} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/client';
import {thuNhoAnh, tenTepSauNen, CO_ANH_BIA} from '@/lib/anh';

// Tải ảnh bìa lớp lên Storage (bucket class-covers) rồi cập nhật classes.cover_image_url.
// RLS: class_covers_auth_insert cho upload; class_teacher_update cho GVCN đổi cover.
export function ClassCoverUpload({classId}: {classId: string}) {
  const t = useTranslations('roster');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    // Ảnh điện thoại thường 3-5MB. Tải nguyên cỡ lên là bắt mọi phụ huynh mở trang phải tải
    // ngần ấy, qua đúng đường truyền vốn đã chậm. Thu nhỏ ngay trên máy người gửi: rẻ hơn hẳn
    // so với xử lý ở máy chủ, và người gửi chỉ chờ thêm vài trăm mili giây.
    const nho = await thuNhoAnh(file, CO_ANH_BIA);

    // Đuôi tệp phải khớp thứ THẬT SỰ tải lên: thuNhoAnh trả về bản gốc khi trình duyệt không giải
    // mã được (vài kiểu .HEIC của iPhone). Ghi cứng ".webp" lúc đó là đặt tên dối, và Storage sẽ
    // phục vụ ảnh với content-type sai.
    const path = `${classId}/${Date.now()}-${tenTepSauNen(file.name, nho !== file)}`;
    // KHÔNG dùng {upsert: true}: đường upsert của storage-api chạy INSERT ... RETURNING, mà
    // RETURNING thì cần policy SELECT trên storage.objects — bucket này không có (0006 tạo, 0013
    // xoá). Đó chính là lý do tính năng chưa lần nào chạy được, xem migration 0071.
    // Đường dẫn đã có Date.now() nên không bao giờ trùng; upsert vốn cũng chẳng để làm gì.
    const {error: upErr} = await supabase.storage
      .from('class-covers')
      .upload(path, nho, {contentType: nho.type || file.type});
    if (upErr) {
      setErr(t('coverError'));
      setBusy(false);
      return;
    }
    const {data} = supabase.storage.from('class-covers').getPublicUrl(path);
    const {error: dbErr} = await supabase.from('classes').update({cover_image_url: data.publicUrl}).eq('id', classId);
    setBusy(false);
    if (dbErr) {
      setErr(t('coverError'));
      return;
    }
    router.refresh();
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-navy/[0.02] px-3 py-1.5 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy hover:bg-white focus-within:border-navy focus-within:ring-1 focus-within:ring-navy/20">
      <input type="file"
                aria-label={t('coverLabel')} accept="image/*" className="hidden" onChange={onChange} disabled={busy} />
      {busy ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} strokeWidth={2.2} />}
      {busy ? t('coverUploading') : t('coverUpload')}
      {err && <span className="text-status-bad">· {err}</span>}
    </label>
  );
}
