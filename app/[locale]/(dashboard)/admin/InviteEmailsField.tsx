'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

// Ô nhập NHIỀU email (mỗi dòng / ngăn cách bởi phẩy, chấm phẩy) có kiểm định dạng NGAY TẠI Ô.
//
// Vì sao cần: <textarea> không có kiểm tra sẵn của trình duyệt như <input type="email">, nên
// trước đây gõ "abcxyz" vẫn bấm gửi được; server từ chối rồi redirect kèm một dòng thông báo —
// người thử không kịp thấy và kết luận "vẫn mời được email không tồn tại". Server VẪN kiểm lại
// (đây chỉ là lớp phản hồi nhanh, không phải lớp an toàn).
//
// setCustomValidity: mượn đúng cơ chế của trình duyệt — nút gửi bị chặn và bong bóng lỗi hiện
// ngay cạnh ô, không phải tự vẽ lại UI báo lỗi.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteEmailsField({
  name,
  placeholder,
  ariaLabel,
  className,
}: {
  name: string;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const t = useTranslations('admin');
  const [bad, setBad] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-1">
      <textarea
        name={name}
        placeholder={placeholder}
        aria-label={ariaLabel}
        required
        rows={2}
        className={className}
        onChange={(e) => {
          const list = e.target.value
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          const invalid = list.filter((s) => !EMAIL_RE.test(s));
          setBad(invalid);
          e.target.setCustomValidity(
            invalid.length === 0
              ? ''
              : t('emailKhongHopLe', {ds: invalid.join(', ')}),
          );
        }}
      />
      {bad.length > 0 && (
        <p className="text-chu-thich font-semibold text-status-bad">
          {t('emailSaiDinhDang', {ds: bad.join(', ')})}
        </p>
      )}
    </div>
  );
}
