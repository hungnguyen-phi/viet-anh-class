import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import type {Profile} from '@/lib/auth';
import {safeNextPath} from '@/lib/hub/safe-next';

// BIẾN DANH TÍNH HUB ĐÃ XÁC MINH THÀNH PHIÊN THẬT CỦA APP NÀY — KHÔNG DỰNG HỆ PHIÊN RIÊNG.
//
// scripts/chup-trang.mjs đã làm đúng việc này để chụp ảnh màn hình bằng phiên thật (generateLink
// magiclink → verifyOtp) — tái dùng nguyên functions/route đã có thay vì phát minh thêm một cách
// đặt cookie phiên thứ hai cho app. Khác biệt DUY NHẤT với chup-trang.mjs: ở đó verifyOtp() chạy
// ngay trong script (Node độc lập); ở đây phải trả về một URL để TRÌNH DUYỆT của người dùng tự
// điều hướng tới, vì phiên phải nằm trong cookie của ĐÚNG trình duyệt đang mở khung Hub.
export async function mintCallbackUrl(
  profile: Profile,
  locale: string,
  next?: string | null,
): Promise<string> {
  const admin = createAdminClient();
  const {data, error} = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`generateLink: ${error?.message ?? 'thiếu hashed_token'}`);
  }

  const prefix = locale === 'vi' ? '' : `/${locale}`;
  const safeNext = safeNextPath(next);
  const qs = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: 'email',
  });
  if (safeNext) qs.set('next', safeNext);
  return `${prefix}/auth/callback?${qs.toString()}`;
}
