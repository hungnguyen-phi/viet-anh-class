// Buddy 4DX = LLM (DeepSeek qua OpenRouter). CHỈ CHẠY Ở SERVER — OPENROUTER_API_KEY là biến
// server-only, tuyệt đối không NEXT_PUBLIC (nếu không, key nằm trong bundle client).
//
// QUYỀN RIÊNG TƯ (docs/DATA_GOVERNANCE.md §1-§2): tiến độ học sinh là PII nhạy cảm cao và
// "RLS là cổng duy nhất". Gọi OpenRouter là dữ liệu ra khỏi hẳn vành đai đó, sang bên thứ ba.
// Nên hợp đồng của module này: CHỈ nhận số liệu đã bóc danh tính (BuddyFact) — không tên,
// không email, không UUID, không lớp, không trường. Người gọi chịu trách nhiệm không nhồi PII
// vào `area`/`unit`; hai trường đó lấy từ area_config + đơn vị của WIG nên an toàn.

export type BuddyFact = {
  area: string; // nhãn lĩnh vực, vd "Kiến thức"
  target: number;
  unit: string | null;
  actual: number;
  daysLeft: number;
};

export type BuddyResult =
  | {ok: true; note: string; model: string}
  | {ok: false; error: 'no_key' | 'no_data' | 'api' | 'empty'; detail?: string};

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// Model rẻ, đổi được bằng biến môi trường mà không phải build lại.
const DEFAULT_MODEL = 'deepseek/deepseek-chat';

const SYSTEM_PROMPT = [
  'Bạn là "Buddy" — bạn đồng hành theo phương pháp 4DX (4 Disciplines of Execution) của một học sinh phổ thông Việt Nam.',
  'Nhiệm vụ: đọc số liệu tiến độ tuần này và viết một ghi chú ngắn cho bạn học sinh đó.',
  'Yêu cầu bắt buộc:',
  '- Viết bằng tiếng Việt, giọng thân thiện, gọi "bạn", không xưng "tôi là AI".',
  '- TỐI ĐA 4 câu. Không markdown, không gạch đầu dòng, không emoji.',
  '- Nêu cụ thể lĩnh vực đang tốt và lĩnh vực đang chậm, dựa ĐÚNG vào số liệu được cho.',
  '- Kết bằng MỘT hành động cụ thể làm được trong hôm nay.',
  '- Không hứa hẹn điểm số, không so sánh với bạn khác, không nhắc tới dữ liệu nào ngoài số liệu đã cho.',
].join('\n');

function factsToPrompt(facts: BuddyFact[]): string {
  const lines = facts.map((f) => {
    const unit = f.unit ? ` ${f.unit}` : '';
    return `- ${f.area}: đã đạt ${f.actual}/${f.target}${unit}, còn ${f.daysLeft} ngày.`;
  });
  return `Số liệu tuần này:\n${lines.join('\n')}`;
}

export async function askBuddy(facts: BuddyFact[]): Promise<BuddyResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return {ok: false, error: 'no_key'};
  if (facts.length === 0) return {ok: false, error: 'no_data'};

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        // OpenRouter dùng 2 header này để gán usage cho app — không bắt buộc, không chứa PII.
        'HTTP-Referer': 'https://class.vietanh.org',
        'X-Title': 'Viet Anh Class',
      },
      body: JSON.stringify({
        model,
        messages: [
          {role: 'system', content: SYSTEM_PROMPT},
          {role: 'user', content: factsToPrompt(facts)},
        ],
        // Chặn chi phí: ghi chú 4 câu không cần nhiều hơn.
        max_tokens: 320,
        temperature: 0.6,
      }),
      // Đừng để provider treo làm treo luôn server action.
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    });
  } catch (e) {
    return {ok: false, error: 'api', detail: e instanceof Error ? e.message : 'fetch failed'};
  }

  if (!res.ok) {
    // Đọc body để log được nguyên nhân thật (hết tiền, model sai, key sai...) — KHÔNG trả ra UI.
    const body = await res.text().catch(() => '');
    return {ok: false, error: 'api', detail: `${res.status} ${body.slice(0, 300)}`};
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {ok: false, error: 'api', detail: 'invalid json'};
  }

  const note = (json as {choices?: {message?: {content?: string}}[]})?.choices?.[0]?.message?.content?.trim();
  if (!note) return {ok: false, error: 'empty'};

  // Cắt cứng để một phản hồi dài bất thường không phá layout / phình DB.
  return {ok: true, note: note.slice(0, 1200), model};
}
