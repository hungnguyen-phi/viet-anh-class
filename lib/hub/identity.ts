import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import type {Profile} from '@/lib/auth';

// KHỚP DANH TÍNH HUB VỚI PROFILE ĐÃ CÓ.
//
// Lượt sau (đã có trong hub_identities): tra thẳng (issuer, sub) — không cần email nữa, O(1).
// Lượt ĐẦU (chưa có): khớp theo email — CHÍNH LÀ khoá app này vẫn luôn dùng để biết "đây là ai"
// (signup_email_domains, xem docs/DATA_GOVERNANCE.md). Khớp được thì chép lại vào hub_identities
// để lượt sau khỏi hỏi lại. Khớp KHÔNG được thì trả về null — KHÔNG tự tạo hồ sơ mới ở đây: một
// `sub` lạ với một email lạ nghĩa là người này chưa có tài khoản Việt Anh Class, và việc đó
// không phải chuyện route xử lý mã Hub được quyền tự quyết.
export async function findOrLinkProfile(
  issuer: string,
  sub: string,
  email: string,
): Promise<Profile | null> {
  const admin = createAdminClient();

  const {data: linked} = await admin
    .from('hub_identities')
    .select('profile_id')
    .eq('issuer', issuer)
    .eq('sub', sub)
    .maybeSingle();

  if (linked) {
    const {data: profile} = await admin
      .from('profiles')
      .select('*')
      .eq('id', linked.profile_id)
      .maybeSingle();
    return profile ?? null;
  }

  // So khớp email KHÔNG phân biệt hoa/thường — địa chỉ mail không phân biệt hoa thường ở phần
  // domain, và người dùng gõ "Test1.hs@..." hay "test1.hs@..." vào ô đăng nhập của HỌ (không phải
  // app này) là chuyện app không kiểm soát được.
  const {data: profile} = await admin
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle();
  if (!profile) return null;

  // Ghi lần đầu. Đụng độ (23505) nghĩa là một lượt đăng nhập song song khác đã ghi trước —
  // không phải lỗi, đọc lại dòng vừa có là xong.
  const {error} = await admin
    .from('hub_identities')
    .insert({issuer, sub, profile_id: profile.id, email_at_link: email});
  if (error && error.code !== '23505') {
    throw new Error(`hub_identities insert: ${error.message}`);
  }

  return profile;
}
