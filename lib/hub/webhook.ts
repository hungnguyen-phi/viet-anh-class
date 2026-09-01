import 'server-only';
import {createHmac} from 'node:crypto';

// GỬI DỮ LIỆU VỀ HUB — MỘT CỬA, MỘT KỶ LUẬT: mỗi loại sự kiện có ĐÚNG một hàm dựng payload, nhận
// đúng những trường nó cần (không nhận nguyên một hàng CSDL) — không thể lỡ tay gửi kèm một cột
// thừa (docs/DATA_GOVERNANCE.md §7).
//
// TUYỆT ĐỐI KHÔNG GỬI (rổ Đỏ — xem bản đấu nối mục 2): không mood_checkins, không pdr_meetings,
// không parent_teacher_messages, không student_details. Nếu một ngày nào đó ai đó định thêm một
// hàm buildXxxEvent() đọc từ một trong các bảng trên — ĐỪNG. Hỏi lại nhà trường trước.

export type HubEventType = 'diem_danh.danh_dau' | 'viec_dan_dat.tick';

export type HubEventInput = {
  event_type: HubEventType;
  /** id của DÒNG NGUỒN (attendance_records.id, lead_progress.id…) — external_id tính từ đây. */
  sourceId: string;
  /** user_id = auth.uid() của CHÍNH EM trong app này — Hub chỉ nhận id của người ĐÃ đăng nhập
   *  vào app qua Hub (mục 4.2 bản đấu nối); không phải mọi payload đều gắn được ngay từ đầu. */
  userId?: string | null;
  payload: Record<string, unknown>;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu ${name} trong môi trường server.`);
  return v;
}

// Ổn định theo NỘI DUNG (loại sự kiện + id dòng nguồn) — KHÔNG PHẢI uuid ngẫu nhiên mỗi lần gửi
// (mục 4.3: "Cấm dùng UUID sinh mới mỗi lần gửi"). Gửi lại cùng một dòng nguồn luôn ra cùng một
// external_id → Hub tự nhận ra đã có, trả "already_promoted", không đếm hai lần.
function externalId(eventType: string, sourceId: string): string {
  return createHmac('sha256', requiredEnv('HUB_CLIENT_SECRET'))
    .update(`${eventType}:${sourceId}`)
    .digest('hex');
}

export type HubSendResult =
  | {ok: true; alreadyPromoted: boolean}
  | {ok: false; retry: boolean; status: number | null; detail: string};

// KHÔNG TỰ RETRY TRONG HÀM NÀY — gọi 503 thì báo retry:true và để NGƯỜI GỌI quyết định (gọi
// inline như điểm danh thì bỏ qua, không chặn phản hồi của em; gọi từ dispatcher thì để lần
// poll sau thử lại). Giữ hàm này thuần: một lượt gọi, một kết quả.
export async function sendHubEvent(input: HubEventInput): Promise<HubSendResult> {
  const url = requiredEnv('HUB_WEBHOOK_URL');
  const appId = requiredEnv('HUB_APP_ID');
  const secret = requiredEnv('HUB_CLIENT_SECRET');

  const body = {
    external_id: externalId(input.event_type, input.sourceId),
    event_type: input.event_type,
    ...(input.userId ? {payload: {...input.payload, user_id: input.userId}} : {payload: input.payload}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-embed-app': appId,
        'x-embed-secret': secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
  } catch (e) {
    return {ok: false, retry: true, status: null, detail: e instanceof Error ? e.message : 'fetch failed'};
  }

  if (res.status === 200 || res.status === 202) {
    const parsed = await res.json().catch(() => null);
    return {ok: true, alreadyPromoted: parsed?.status === 'already_promoted'};
  }
  if (res.status === 503) {
    return {ok: false, retry: true, status: 503, detail: 'hub_ban'};
  }
  const detail = await res.text().catch(() => '');
  // 400/401/403: sai mã/hỏng thân/chưa khai event_type — gửi lại không sửa được gì.
  return {ok: false, retry: false, status: res.status, detail: detail.slice(0, 300)};
}

// ============================================================
// Người dựng payload theo TỪNG loại sự kiện — allow-list tường minh.
// ============================================================

export function buildAttendanceEvent(row: {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: string;
}): HubEventInput {
  return {
    event_type: 'diem_danh.danh_dau',
    sourceId: row.id,
    userId: row.student_id,
    payload: {class_id: row.class_id, date: row.date, status: row.status},
  };
}

export function buildLeadTickEvent(row: {
  source_id: string;
  student_id: string;
  class_id: string;
  area: string;
  lead_title: string;
  logged_date: string;
  value: number;
}): HubEventInput {
  return {
    event_type: 'viec_dan_dat.tick',
    sourceId: row.source_id,
    userId: row.student_id,
    payload: {
      class_id: row.class_id,
      area: row.area,
      lead_title: row.lead_title,
      logged_date: row.logged_date,
      value: row.value,
    },
  };
}
