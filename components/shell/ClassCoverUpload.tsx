'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ImageUp, Loader2} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/client';

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
    const path = `${classId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const {error: upErr} = await supabase.storage.from('class-covers').upload(path, file, {upsert: true});
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
