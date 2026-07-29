import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import {monitorEventLoopDelay} from 'node:perf_hooks';
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
    container: await containerHealth(),
  });
}

// Sức khoẻ của chính container — phần quyết định để phân biệt "Supabase chậm" với "container
// bị bóp CPU".
//
// Vì sao cần: mọi số đo thời gian ở trên đều đo bằng đồng hồ JS, nên nếu vòng lặp sự kiện của
// Node bị nghẽn (hết hạn ngạch CPU, hoặc đang bận render React), thời gian chờ trong hàng đợi
// cũng bị tính thành "độ trễ mạng". Hai chỉ số dưới đây tách bạch chuyện đó:
//   - event_loop_lag_ms: vòng lặp sự kiện trễ bao lâu so với lịch. Nhàn thì ~0-2ms; >50ms là
//     đang thiếu CPU thật sự.
//   - cpu_quota: hạn ngạch cgroup mà Coolify/Docker áp cho container. 'max' = không giới hạn.
//     Con số nhỏ hơn số nhân của máy nghĩa là container chỉ được dùng một phần CPU.
async function containerHealth() {
  // Đo độ trễ vòng lặp sự kiện trong 1 giây.
  const h = monitorEventLoopDelay({resolution: 10});
  h.enable();
  await new Promise((r) => setTimeout(r, 1000));
  h.disable();

  // cgroup v2 (Docker/Coolify hiện đại). Đọc lỗi → không phải Linux hoặc không bị giới hạn.
  const read = async (p: string) => (await readFile(p, 'utf-8').catch(() => null))?.trim() ?? null;
  const cpuMax = await read('/sys/fs/cgroup/cpu.max'); // "<quota> <period>" hoặc "max <period>"
  const memMax = await read('/sys/fs/cgroup/memory.max');
  const memCur = await read('/sys/fs/cgroup/memory.current');
  // Số nhân container THẬT SỰ được dùng, suy từ hạn ngạch.
  let effectiveCpus: number | 'max' | null = null;
  if (cpuMax) {
    const [q, p] = cpuMax.split(/\s+/);
    effectiveCpus = q === 'max' ? 'max' : Math.round((Number(q) / Number(p)) * 100) / 100;
  }

  return {
    host_cpus: os.cpus().length,
    cpu_quota_raw: cpuMax,
    effective_cpus: effectiveCpus,
    memory_limit_mb: memMax && memMax !== 'max' ? Math.round(Number(memMax) / 1048576) : memMax,
    memory_used_mb: memCur ? Math.round(Number(memCur) / 1048576) : null,
    load_avg_1m: os.loadavg()[0],
    event_loop_lag_ms: {
      mean: Math.round(h.mean / 1e6),
      p50: Math.round(h.percentile(50) / 1e6),
      p99: Math.round(h.percentile(99) / 1e6),
      max: Math.round(h.max / 1e6),
    },
    rss_mb: Math.round(process.memoryUsage().rss / 1048576),
  };
}
