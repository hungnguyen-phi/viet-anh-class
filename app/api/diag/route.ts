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
    network: await networkPhases(),
  });
}

// Tách ĐỘ TRỄ MẠNG tới Supabase thành từng chặng: DNS → bắt tay TCP → bắt tay TLS.
//
// Vì sao cần: các số đo trước cho thấy CPU rảnh 90%, steal 0%, container không bị giới hạn —
// tức app KHÔNG đói CPU. Nhưng một truy vấn Supabase vẫn dao động 48ms–2.3s. Nếu chặng chậm là
// DNS thì sửa bằng cách đổi resolver; nếu là TCP/TLS thì là mất gói trên đường truyền của VPS
// (phải đổi nhà mạng/vùng); nếu cả ba đều nhanh mà tổng vẫn chậm thì lỗi nằm ở phía Supabase xử lý.
async function networkPhases() {
  const {promises: dns} = await import('node:dns');
  const net = await import('node:net');
  const tls = await import('node:tls');
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://x').hostname;

  const time = async (fn: () => Promise<void>) => {
    const t0 = performance.now();
    try {
      await fn();
    } catch {
      return -1;
    }
    return Math.round(performance.now() - t0);
  };

  const dnsMs: number[] = [];
  const tcpMs: number[] = [];
  const tlsMs: number[] = [];
  for (let i = 0; i < 4; i++) {
    dnsMs.push(await time(async () => void (await dns.lookup(host))));
    tcpMs.push(
      await time(
        () =>
          new Promise<void>((res, rej) => {
            const s = net.connect({host, port: 443}, () => {
              s.destroy();
              res();
            });
            s.on('error', rej);
            s.setTimeout(10_000, () => {
              s.destroy();
              rej(new Error('timeout'));
            });
          }),
      ),
    );
    tlsMs.push(
      await time(
        () =>
          new Promise<void>((res, rej) => {
            const s = tls.connect({host, port: 443, servername: host}, () => {
              s.destroy();
              res();
            });
            s.on('error', rej);
            s.setTimeout(10_000, () => {
              s.destroy();
              rej(new Error('timeout'));
            });
          }),
      ),
    );
  }
  return {host, dns_ms: dnsMs, tcp_connect_ms: tcpMs, tls_handshake_ms: tlsMs, tcp: await tcpLoss()};
}

// TỈ LỆ TRUYỀN LẠI TCP + gói rơi ở card mạng — bằng chứng cuối cùng cho "mất gói".
//
// Vì sao là chỉ số quyết định: bắt tay TCP lúc 8ms lúc 627ms tới CÙNG một máy chủ chỉ có hai
// cách giải thích — hoặc gói tin bị rơi và phải truyền lại (mỗi lần chờ tính bằng trăm ms),
// hoặc máy đang nghẽn. retrans_pct nói thẳng cái nào:
//   < 0.5%  → đường truyền sạch, phải tìm nguyên nhân khác.
//   > 1%    → mất gói thật sự; tối ưu code không cứu được, phải xử lý ở tầng hạ tầng/nhà mạng.
// rx_drop/tx_drop là gói bị chính card mạng vứt bỏ (thường do hàng đợi đầy vì quá tải băng thông).
async function tcpLoss() {
  const read = async (p: string) => (await readFile(p, 'utf-8').catch(() => null)) ?? '';

  // /proc/net/snmp: hai dòng "Tcp:" — dòng đầu là TÊN cột, dòng sau là GIÁ TRỊ.
  const snmp = (await read('/proc/net/snmp')).split('\n').filter((l) => l.startsWith('Tcp:'));
  let outSegs: number | null = null;
  let retransSegs: number | null = null;
  if (snmp.length >= 2) {
    const keys = snmp[0].split(/\s+/);
    const vals = snmp[1].split(/\s+/);
    const get = (k: string) => {
      const i = keys.indexOf(k);
      return i > 0 ? Number(vals[i]) : null;
    };
    outSegs = get('OutSegs');
    retransSegs = get('RetransSegs');
  }

  // /proc/net/dev: gói rơi ở từng card mạng (bỏ lo — loopback).
  const ifaces: Record<string, {rx_drop: number; tx_drop: number; rx_err: number; tx_err: number}> = {};
  for (const line of (await read('/proc/net/dev')).split('\n').slice(2)) {
    const [rawName, rest] = line.split(':');
    const name = rawName?.trim();
    if (!name || name === 'lo' || !rest) continue;
    const f = rest.trim().split(/\s+/).map(Number);
    // cột: rx bytes packets errs drop ... (8 cột rx) rồi tx bytes packets errs drop
    ifaces[name] = {rx_err: f[2], rx_drop: f[3], tx_err: f[10], tx_drop: f[11]};
  }

  return {
    out_segs: outSegs,
    retrans_segs: retransSegs,
    // Tích luỹ từ lúc container khởi động — đọc là ra bức tranh tổng, không cần lấy hiệu.
    retrans_pct:
      outSegs && retransSegs != null ? Math.round((retransSegs / outSegs) * 10000) / 100 : null,
    interfaces: ifaces,
  };
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

  // STEAL TIME — chỉ số phân biệt hai nguyên nhân hoàn toàn khác nhau của "load cao":
  //   steal thấp  → CPU bị chính các workload TRÊN MÁY NÀY ăn hết (tắt bớt/tách ra là xong).
  //   steal cao   → hypervisor của NHÀ CUNG CẤP đang cắt CPU đưa cho máy ảo khác ("hàng xóm ồn
  //                 ào"). Lúc đó dọn container của mình không cứu được gì, phải đổi gói/nhà cung cấp.
  // Cách đo: đọc /proc/stat hai lần cách nhau 1 giây rồi lấy hiệu — giá trị trong file là tổng
  // tích luỹ từ lúc khởi động, đọc một lần thì vô nghĩa.
  const cpuLine = async () => {
    const s = await read('/proc/stat');
    const l = s?.split('\n')[0]?.split(/\s+/).slice(1).map(Number);
    return l ?? null;
  };
  const c1 = await cpuLine();
  await new Promise((r) => setTimeout(r, 1000));
  const c2 = await cpuLine();
  let cpuBreakdown: Record<string, number> | null = null;
  if (c1 && c2) {
    const d = c2.map((v, i) => v - (c1[i] ?? 0));
    const total = d.reduce((a, b) => a + b, 0) || 1;
    const pct = (i: number) => Math.round(((d[i] ?? 0) / total) * 1000) / 10;
    // Thứ tự cột: user nice system idle iowait irq softirq steal guest guest_nice
    cpuBreakdown = {
      user_pct: pct(0),
      system_pct: pct(2),
      idle_pct: pct(3),
      iowait_pct: pct(4),
      steal_pct: pct(7),
    };
  }

  return {
    host_cpus: os.cpus().length,
    cpu_quota_raw: cpuMax,
    effective_cpus: effectiveCpus,
    cpu_breakdown: cpuBreakdown,
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
