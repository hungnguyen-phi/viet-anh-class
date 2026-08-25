import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';

// "GẦN TỨC THÌ" THẬT — không phải trễ đợt 60 giây/hết hạn token.
//
// Vấn đề gốc: lib/auth.ts xác thực JWT CỤC BỘ (không hỏi DB mỗi request) để mọi trang nhanh. Khi
// Hub báo một người vừa đăng xuất bên đó (app/api/hub/backchannel-logout), app không có JWT của
// người đó để thu hồi trực tiếp — chỉ có thể ghi lại "người này vừa bị đăng xuất" rồi lan tin ấy
// tới MỌI request kế tiếp càng nhanh càng tốt, mà KHÔNG bắt mọi request (kể cả của người chưa bao
// giờ đụng tới Hub) phải hỏi DB.
//
// CÁCH LÀM: một kênh Supabase Realtime (postgres_changes trên hub_revoked_sessions, migration
// 0158) giữ mở SUỐT VÒNG ĐỜI tiến trình, đẩy tin về trong khoảng dưới 1 giây; nhận được là cập
// nhật một Map trong RAM. requireProfile()/getCurrentProfile() chỉ hỏi Map đó — so sánh trong bộ
// nhớ, không I/O, không chậm thêm cho ai.
//
// VÌ SAO REALTIME MÀ KHÔNG PHẢI MỘT KẾT NỐI Postgres LISTEN/NOTIFY RIÊNG: LISTEN/NOTIFY cần một
// kết nối Postgres trực tiếp giữ mở cả đời tiến trình — nghĩa là cần DATABASE_URL ở production,
// mà CLAUDE.md cấm biến đó ở đó (chỉ dùng ở máy cá nhân cho npm run sql). Realtime dùng lại đúng
// hạ tầng Supabase đã có sẵn (cùng URL/khoá server đã dùng khắp app), không mở thêm một con đường
// kết nối DB mới phải xin phép riêng.
//
// GIỚI HẠN THẬT (ghi rõ, không giấu): nếu kênh Realtime rớt đúng lúc Hub gọi vào, tin đó bị lỡ cho
// tới khi kênh nối lại (đã tự động thử lại — xem subscribe() bên dưới) hoặc cho tới khi hạn access
// token tự nhiên hết (tối đa vài chục phút, tuỳ cấu hình Supabase Auth của project). Đây KHÔNG
// phải khoá tài khoản vĩnh viễn: mỗi mục tự hết hạn sau REVOKE_WINDOW_MS, để người đó đăng nhập
// lại bình thường sau đó — không phải cách xoá dòng bằng tay.
const REVOKE_WINDOW_MS = 20 * 60_000; // 20 phút — dài hơn hẳn hạn access token mặc định (thường 1h/15').

const revokedUntil = new Map<string, number>();

export function isRevoked(profileId: string): boolean {
  const het = revokedUntil.get(profileId);
  if (het === undefined) return false;
  if (het < Date.now()) {
    revokedUntil.delete(profileId);
    return false;
  }
  return true;
}

function ghiNhanThuHoi(profileId: string): void {
  revokedUntil.set(profileId, Date.now() + REVOKE_WINDOW_MS);
  // Đừng để Map phình vô hạn nếu vì lý do gì đó mục cũ không được đọc/xoá qua isRevoked().
  if (revokedUntil.size > 5000) {
    const bay = Date.now();
    for (const [k, v] of revokedUntil) if (v < bay) revokedUntil.delete(k);
  }
}

let daDat = false;

// Gọi từ lib/supabase/server.ts, cùng chỗ giuKetNoiSupabase()/batDauHubDispatcher() được bật.
export function batDauHubRevocationWatcher(): void {
  if (daDat) return;
  daDat = true;
  if (!process.env.HUB_ISSUER_URL) return; // Hub chưa cấu hình ở môi trường này.

  const admin = createAdminClient();

  const moKenh = () => {
    const kenh = admin
      .channel('hub-revoked-sessions')
      .on(
        'postgres_changes',
        {event: 'INSERT', schema: 'public', table: 'hub_revoked_sessions'},
        (payload) => {
          const profileId = (payload.new as {profile_id?: string} | null)?.profile_id;
          if (profileId) ghiNhanThuHoi(profileId);
        },
      )
      .subscribe((status) => {
        // Realtime tự thử lại khi mất kết nối tạm thời; CHANNEL_ERROR/TIMED_OUT là lúc nó ĐÃ bỏ
        // cuộc hẳn — dọn kênh cũ rồi mở kênh mới, thay vì để tiến trình mất khả năng thu hồi lặng lẽ.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          admin.removeChannel(kenh);
          setTimeout(moKenh, 5_000);
        }
      });
  };
  moKenh();
}
