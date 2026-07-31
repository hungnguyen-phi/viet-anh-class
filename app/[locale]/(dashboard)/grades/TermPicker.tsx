'use client';

import {ChevronDown} from 'lucide-react';
import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';
import {labelCls, selectInline} from '@/components/ui/Field';
import {useTranslations} from 'next-intl';
import {type TermKind} from '@/components/grades/labels';

export type TermOption = {id: string; name: string; kind: TermKind; is_locked: boolean};

/**
 * Chọn ĐỢT ĐÁNH GIÁ đang xem (?term=).
 *
 * Giữ nguyên mọi tham số khác trên địa chỉ (nhất là ?class= và cột điểm đang nhập dở) — đổi đợt
 * mà bị ném về lớp khác thì giáo viên phải chọn lại lớp mỗi lần, đúng phàn nàn cũ.
 * Riêng ?flash= thì bỏ: thông báo của việc vừa xong không được đi theo sang màn hình khác.
 */
export function TermPicker({terms, current}: {terms: TermOption[]; current: string}) {
  const tr = useTranslations('grades');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (terms.length === 0) return null;

  const go = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('term', id);
    q.delete('flash');
    router.push(`${pathname}?${q.toString()}`);
  };

  return (
    <div className="min-w-0">
      <label className={labelCls} htmlFor="grades-term">
        {tr('termPickerLabel')}
      </label>
      <div className="relative inline-flex w-full items-center sm:w-[260px]">
        <select
          id="grades-term"
          value={current}
          onChange={(e) => go(e.target.value)}
          className={`${selectInline} w-full pr-9`}
        >
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {tr(`termKinds.${t.kind}`)}
              {t.is_locked ? tr('termLocked') : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className="pointer-events-none absolute right-3 text-navy/70"
        />
      </div>
    </div>
  );
}
