'use client';

import {useTranslations} from 'next-intl';
import {Check} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {toggleNhapHo} from './actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// NHẬP HỘ — bật cho lớp nhỏ (khối 1–3) để thầy cô nhập nội dung giúp em (40-C · C5)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Mỗi lớp một hàng, một công tắc. Bật thì thầy cô nhập mục tiêu / việc / cam kết / biên bản giúp
// em; chữ ký buổi họp vẫn là của em hoặc bạn em. RLS protect_class_privileged_cols mới là thứ
// chặn thật (BGH cùng cơ sở + admin) — đây chỉ là cái nút.

export function CongTacNhapHo({
  classes,
}: {
  classes: {id: string; name: string; nhap_ho: boolean}[];
}) {
  const t = useTranslations('coSoMucTieu');

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-1 font-display text-doc font-bold text-navy">{t('khuNhapHo')}</div>
      <p className="mb-3 text-xs leading-relaxed text-grey-mid">{t('nhapHoHint')}</p>

      {classes.length === 0 ? (
        <p className="text-than font-semibold italic text-grey-mid">{t('lopChamTrong')}</p>
      ) : (
        <div className="flex flex-col divide-y divide-navy/[0.08]">
          {classes.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-than font-bold text-navy">{c.name}</span>
              <span
                className={`shrink-0 text-chu-thich font-extrabold ${
                  c.nhap_ho ? 'text-success-dark' : 'text-grey-mid'
                }`}
              >
                {c.nhap_ho ? t('nhapHoBat') : t('nhapHoTat')}
              </span>
              <form action={toggleNhapHo} className="contents">
                <input type="hidden" name="class_id" value={c.id} />
                <input type="hidden" name="bat" value={String(!c.nhap_ho)} />
                <SubmitButton
                  label={`${t('nhapHoDoi')} — ${c.name}`}
                  wrapClass="contents"
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border-[1.5px] px-2.5 py-0.5 text-chu-thich font-extrabold transition-all ${
                    c.nhap_ho
                      ? 'border-success/40 bg-success/[0.12] text-success-dark hover:bg-success/20'
                      : 'border-navy/20 bg-white text-navy hover:border-navy'
                  }`}
                >
                  {c.nhap_ho && <Check size={12} strokeWidth={2.5} />}
                  {t('nhapHoDoi')}
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
