import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {sendHubEvent, buildLeadTickEvent} from '@/lib/hub/webhook';

// BỘ GỬI NỀN CHO hub_event_outbox (tick lead measure — xem migration 0157 để biết vì sao loại sự
// kiện này không gọi webhook thẳng như điểm danh).
//
// MỘT TIẾN TRÌNH, MỘT VÒNG LẶP TẠI MỘT THỜI ĐIỂM: `dangChay` chặn hai lượt setInterval chồng lên
// nhau nếu một lượt xử lý lâu hơn chu kỳ. App hiện chạy ĐÚNG MỘT container (Coolify) nên đây là
// đủ; nếu sau này chạy nhiều container, mỗi container có một Set `dangGui` riêng và CÓ THỂ gửi
// trùng một dòng hai lần trong cửa sổ hẹp giữa lúc đọc và lúc ghi status — Hub vẫn không đếm trùng
// nhờ external_id ổn định (lib/hub/webhook.ts), nên hậu quả tối đa là một lượt gọi HTTP thừa, không
// phải một bản ghi trùng ở phía Hub. Ghi rõ ở đây để người tăng số container sau này biết chỗ cần
// nhìn lại (RPC `for update skip locked`) thay vì tưởng đây là lỗi.
let daDat = false;
let dangChay = false;

const CHU_KY_MS = 7_000;
const MOI_LUOT = 20;

async function motLuot(): Promise<void> {
  if (dangChay) return;
  dangChay = true;
  try {
    const admin = createAdminClient();
    const {data: rows} = await admin
      .from('hub_event_outbox')
      .select('id, source_id, payload, attempts')
      .eq('status', 'pending')
      .order('created_at', {ascending: true})
      .limit(MOI_LUOT);
    if (!rows || rows.length === 0) return;

    for (const row of rows) {
      const p = row.payload as {
        student_id: string;
        class_id: string;
        area: string;
        lead_title: string;
        logged_date: string;
        value: number;
      };
      const event = buildLeadTickEvent({source_id: row.source_id, ...p});
      const res = await sendHubEvent(event);

      if (res.ok) {
        await admin
          .from('hub_event_outbox')
          .update({status: 'sent', sent_at: new Date().toISOString()})
          .eq('id', row.id);
        continue;
      }
      if (res.retry && row.attempts < 5) {
        // Vẫn 'pending' — lượt poll sau tự thử lại. attempts tăng để cuối cùng cũng dừng lại nếu
        // Hub hỏng dài ngày, thay vì thử vô hạn mãi mãi.
        await admin
          .from('hub_event_outbox')
          .update({attempts: row.attempts + 1, last_error: res.detail})
          .eq('id', row.id);
      } else {
        await admin
          .from('hub_event_outbox')
          .update({status: 'failed', attempts: row.attempts + 1, last_error: res.detail})
          .eq('id', row.id);
      }
    }
  } catch (e) {
    console.error('[hub] dispatcher', e instanceof Error ? e.message : e);
  } finally {
    dangChay = false;
  }
}

// Gọi từ lib/supabase/server.ts (cửa duy nhất mọi truy vấn phía máy chủ đi qua) — giống hệt cách
// giuKetNoiSupabase() được bật đúng một lần cho cả tiến trình.
export function batDauHubDispatcher(): void {
  if (daDat) return;
  daDat = true;
  if (!process.env.HUB_WEBHOOK_URL) return; // Hub chưa cấu hình ở môi trường này — im lặng bỏ qua.
  setInterval(() => void motLuot(), CHU_KY_MS);
}
