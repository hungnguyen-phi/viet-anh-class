// Buddy 4DX = LLM (DeepSeek qua OpenRouter). CHỈ CHẠY Ở SERVER — OPENROUTER_API_KEY là biến
// server-only, tuyệt đối không NEXT_PUBLIC (nếu không, key nằm trong bundle client).
//
// NGUYÊN TẮC: Buddy chỉ được nói về những thứ CÓ THẬT trong app và chỉ được đề xuất hành động mà
// app có nút để bấm. Không dựa vào việc dặn model trong prompt (dặn thì nó vẫn trôi), mà bó ở
// hai đầu:
//   - Đầu vào: chỉ là LEAD MEASURE — đúng bề mặt hành động của app (4DX: học sinh không tác động
//     được vào WIG, em chỉ tick được lead measure).
//   - Đầu ra: JSON có ràng buộc. `action` phải thuộc 4 giá trị; `focus` là SỐ THỨ TỰ trong danh
//     sách đã gửi. Server kiểm lại và bỏ mọi thứ sai — model không có đường bịa ra việc app không có.
//
// QUYỀN RIÊNG TƯ (docs/DATA_GOVERNANCE.md §7): ghi chú hằng ngày chỉ gửi số liệu đã bóc danh tính
// (tên lead measure do GVCN đặt, mục tiêu, đã đạt, số ngày còn lại) — không tên/email/UUID học sinh.
// Riêng chat lúc họp thì CÓ chữ do học sinh gõ đi ra ngoài — xem ghi chú ở chatBuddy().

export type BuddyLead = {
  title: string; // tên lead measure do GVCN đặt
  target: number;
  actual: number;
  unit: string | null;
  tickedToday: boolean;
};

export type BuddyContext = {
  leads: BuddyLead[];
  daysLeft: number; // số ngày còn lại của tuần
  moodMissing: boolean; // hôm nay chưa check-in cảm xúc
};

export type BuddyAction = 'tick_lead' | 'ask_teacher' | 'checkin_mood' | 'none';

export type BuddyNote = {
  note: string;
  action: BuddyAction;
  focusIndex: number | null; // 0-based, đã kiểm nằm trong ctx.leads
  model: string;
  tokens: number | null;
};

export type BuddyError = {error: 'no_key' | 'no_data' | 'api' | 'empty'; detail?: string};

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// Model rẻ; đổi được bằng biến môi trường mà không phải build lại.
const DEFAULT_MODEL = 'deepseek/deepseek-chat';

function model(): string {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

// Gọi OpenRouter. Trả nguyên văn content + số token, không hiểu gì về nghiệp vụ.
async function call(
  messages: {role: 'system' | 'user' | 'assistant'; content: string}[],
  maxTokens: number,
  jsonMode: boolean,
): Promise<{content: string; tokens: number | null; model: string} | BuddyError> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return {error: 'no_key'};
  const m = model();

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // OpenRouter dùng 2 header này để gán usage cho app — không chứa PII.
        'HTTP-Referer': 'https://class.vietanh.org',
        'X-Title': 'Viet Anh Class',
      },
      body: JSON.stringify({
        model: m,
        messages,
        max_tokens: maxTokens,
        temperature: 0.6,
        ...(jsonMode ? {response_format: {type: 'json_object'}} : {}),
      }),
      // Đừng để provider treo làm treo luôn server action.
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
  } catch (e) {
    return {error: 'api', detail: e instanceof Error ? e.message : 'fetch failed'};
  }

  if (!res.ok) {
    // Đọc body để log nguyên nhân thật (hết hạn mức, model sai, key sai) — KHÔNG trả ra UI.
    const body = await res.text().catch(() => '');
    return {error: 'api', detail: `${res.status} ${body.slice(0, 300)}`};
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {error: 'api', detail: 'invalid json'};
  }
  const parsed = json as {
    choices?: {message?: {content?: string}}[];
    usage?: {total_tokens?: number};
  };
  const content = parsed?.choices?.[0]?.message?.content?.trim();
  if (!content) return {error: 'empty'};
  return {content, tokens: parsed.usage?.total_tokens ?? null, model: m};
}

// ============================================================
// Ghi chú hằng ngày — KHÔNG có chữ nào của học sinh đi ra ngoài.
// ============================================================
const NOTE_SYSTEM = [
  'Bạn là "Buddy" — bạn đồng hành theo phương pháp 4DX của một học sinh phổ thông Việt Nam.',
  'Bạn CHỈ được nói về các "việc cần làm" (lead measure) trong danh sách được cho. Ngoài danh sách đó, bạn không biết gì khác về bạn học sinh này và không được suy đoán.',
  '',
  'Trả về ĐÚNG một object JSON, không có chữ nào ngoài JSON:',
  '{"note": "...", "action": "tick_lead|ask_teacher|checkin_mood|none", "focus": <số thứ tự hoặc null>}',
  '',
  '- "note": 2-3 câu tiếng Việt, gọi "bạn", giọng thân thiện. TUYỆT ĐỐI KHÔNG viết con số nào (app đã hiện số liệu riêng). Không markdown, không emoji, không xưng là AI.',
  '- "action": chọn "tick_lead" nếu nên làm một việc trong danh sách hôm nay; "checkin_mood" nếu hôm nay bạn ấy chưa check-in cảm xúc; "ask_teacher" nếu mục tiêu có vẻ quá sức và nên xin giáo viên xem lại; "none" nếu mọi việc đã xong.',
  '- "focus": số thứ tự của việc cần tập trung TRONG DANH SÁCH được cho. Bắt buộc có khi action="tick_lead", còn lại để null.',
  '- Không hứa hẹn điểm số, không so sánh với bạn khác, không nhắc bất cứ dữ liệu nào ngoài danh sách.',
].join('\n');

function contextToPrompt(ctx: BuddyContext): string {
  const lines = ctx.leads.map((l, i) => {
    const unit = l.unit ? ` ${l.unit}` : '';
    const done = l.actual >= l.target ? ' (đã đạt mục tiêu tuần)' : '';
    const today = l.tickedToday ? ', hôm nay đã làm' : ', hôm nay chưa làm';
    return `${i + 1}. ${l.title} — tuần này ${l.actual}/${l.target}${unit}${today}${done}`;
  });
  return [
    `Danh sách việc cần làm tuần này (còn ${ctx.daysLeft} ngày):`,
    ...lines,
    ctx.moodMissing ? 'Hôm nay bạn ấy chưa check-in cảm xúc.' : 'Hôm nay bạn ấy đã check-in cảm xúc.',
  ].join('\n');
}

const ACTIONS: BuddyAction[] = ['tick_lead', 'ask_teacher', 'checkin_mood', 'none'];

export async function buddyNote(ctx: BuddyContext): Promise<BuddyNote | BuddyError> {
  if (ctx.leads.length === 0) return {error: 'no_data'};

  const r = await call(
    [
      {role: 'system', content: NOTE_SYSTEM},
      {role: 'user', content: contextToPrompt(ctx)},
    ],
    260,
    true,
  );
  if ('error' in r) return r;

  let obj: {note?: unknown; action?: unknown; focus?: unknown};
  try {
    obj = JSON.parse(r.content);
  } catch {
    return {error: 'api', detail: `not json: ${r.content.slice(0, 200)}`};
  }

  const note = typeof obj.note === 'string' ? obj.note.trim() : '';
  if (!note) return {error: 'empty'};

  // KIỂM LẠI đầu ra — đây là chỗ chặn model bịa việc app không có.
  const action: BuddyAction =
    typeof obj.action === 'string' && (ACTIONS as string[]).includes(obj.action)
      ? (obj.action as BuddyAction)
      : 'none';

  // focus model trả về là 1-based; đổi sang 0-based và bỏ nếu trỏ ra ngoài danh sách.
  const raw = typeof obj.focus === 'number' ? obj.focus : Number(obj.focus);
  const idx = Number.isInteger(raw) ? raw - 1 : NaN;
  const focusIndex = Number.isInteger(idx) && idx >= 0 && idx < ctx.leads.length ? idx : null;

  return {
    note: note.slice(0, 800),
    // action nói "tick_lead" mà không trỏ được vào việc nào thật → hạ về 'none' cho khỏi hứa suông.
    action: action === 'tick_lead' && focusIndex === null ? 'none' : action,
    focusIndex,
    model: r.model,
    tokens: r.tokens,
  };
}

// ============================================================
// Chat trong buổi họp — CÓ chữ do học sinh gõ đi ra ngoài.
//
// Đây là ngoại lệ duy nhất so với cam kết "không gửi gì do người dùng gõ" (DATA_GOVERNANCE §7).
// Bù lại: chỉ mở được bởi GVCN, chỉ trong buổi họp (nên có người lớn ngồi cạnh), toàn bộ hội
// thoại GVCN đọc lại được, và số lượt bị giới hạn ở tầng server action.
// ============================================================
const CHAT_SYSTEM = [
  'Bạn là "Buddy" — bạn đồng hành 4DX của một học sinh phổ thông Việt Nam, đang trò chuyện trong buổi họp WIG tuần có giáo viên chủ nhiệm ngồi cạnh.',
  'Bạn CHỈ trao đổi về các "việc cần làm" (lead measure) trong danh sách được cho và kế hoạch tuần tới của bạn học sinh.',
  'Nếu bạn ấy hỏi chuyện ngoài phạm vi đó (bài tập môn học, chuyện cá nhân, chuyện ngoài trường, hỏi kiến thức chung), hãy từ chối ngắn gọn và thân thiện rồi kéo về mục tiêu tuần.',
  'Nếu bạn ấy nói điều đáng lo về sức khoẻ hoặc tinh thần, hãy khuyên nói ngay với giáo viên hoặc người lớn đang ở cạnh. Không tự tư vấn tâm lý.',
  'Trả lời tiếng Việt, tối đa 3 câu, gọi "bạn", không markdown, không emoji. Không hứa hẹn điểm số, không so sánh với bạn khác.',
  'Không yêu cầu và không nhắc lại thông tin cá nhân (tên, trường, lớp, địa chỉ, số điện thoại).',
].join('\n');

export async function buddyChat(
  ctx: BuddyContext,
  history: {role: 'user' | 'assistant'; content: string}[],
): Promise<{reply: string; model: string; tokens: number | null} | BuddyError> {
  const r = await call(
    [
      {role: 'system', content: CHAT_SYSTEM},
      {role: 'user', content: contextToPrompt(ctx)},
      // Chỉ lấy 10 lượt gần nhất: đủ mạch hội thoại mà không phình chi phí.
      ...history.slice(-10),
    ],
    260,
    false,
  );
  if ('error' in r) return r;
  return {reply: r.content.slice(0, 900), model: r.model, tokens: r.tokens};
}
