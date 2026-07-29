import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {clientIp} from '@/lib/ip';

// Chẩn đoán hạ tầng — CHỈ quản trị viên gọi được.
//
// Sinh ra để trả lời hai câu hỏi mà đứng ngoài không đo được:
//  1. Đứng sau Cloudflare + Coolify, server thật sự NHÌN THẤY IP nào? (cổng IP check-in của
//     học sinh phụ thuộc hoàn toàn vào con số này — đọc nhầm là chặn nhầm cả trường.)
//  2. Một vòng truy vấn từ container tới Supabase mất bao lâu? (quyết định trần tốc độ của app;
//     đo từ máy ngoài thì lẫn cả độ trễ đường truyền của người đo.)
//
// Không trả về dữ liệu người dùng nào — chỉ header hạ tầng + số đo thời gian.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();

  // Chặn ở đây chứ không dựa vào middleware: /api nằm NGOÀI matcher của middleware.
  const {data: claims} = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NextResponse.json({error: 'unauthorized'}, {status: 401});
  const {data: profile} = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({error: 'forbidden'}, {status: 403});

  const h = await headers();
  const ipHeaders = Object.fromEntries(
    ['cf-connecting-ip', 'true-client-ip', 'x-forwarded-for', 'x-real-ip', 'x-forwarded-host', 'host']
      .map((k) => [k, h.get(k)])
      .filter(([, v]) => v !== null),
  );

  // Đo NỐI TIẾP để ra chi phí MỘT vòng đi-về (chạy song song thì chỉ đo được vòng chậm nhất).
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await supabase.from('profiles').select('id', {count: 'exact', head: true}).limit(1);
    samples.push(Math.round(performance.now() - t0));
  }

  // Đối chứng: một vòng HTTPS tới chính Supabase nhưng KHÔNG qua PostgREST/Postgres.
  // Chênh lệch giữa hai con số cho biết phần nào là mạng, phần nào là xử lý query.
  const authPing: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: {apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''},
      cache: 'no-store',
    }).catch(() => null);
    authPing.push(Math.round(performance.now() - t0));
  }

  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

  return NextResponse.json({
    ip: {headers: ipHeaders, resolved: clientIp(h)},
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      postgrest_ms: {samples, median: med(samples)},
      auth_health_ms: {samples: authPing, median: med(authPing)},
    },
  });
}
