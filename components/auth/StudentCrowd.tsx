// Đám đông học sinh đồng phục (màu) làm nền login — theo prototype (1).
// Người ĐỨNG: mỗi người một vị trí "nhà" riêng (dàn đều khắp bề ngang), thỉnh
// thoảng nhích tại chỗ vào thời điểm ngẫu nhiên → không ai dừng trùng chỗ/trùng lúc.
// Người ĐI: đi ngang qua màn (đôi lúc dừng ngắn), quay mặt trái nên làn đi-phải lật.
// Deterministic (RNG seed) → server & client render giống hệt. Thuần CSS; ẩn khi
// prefers-reduced-motion (.va-crowd). Keyframes nhúng inline (Tailwind v4 purge
// các keyframes chỉ tham chiếu qua inline style).

const STAND: [string, number][] = [
  ['/students/a01.png', 0.417], ['/students/a02.png', 0.352], ['/students/a03.png', 0.409],
  ['/students/a04.png', 0.339], ['/students/a05.png', 0.413], ['/students/a06.png', 0.379],
  ['/students/a07.png', 0.469], ['/students/a08.png', 0.415], ['/students/a09.png', 0.342],
  ['/students/a10.png', 0.361], ['/students/a11.png', 0.332], ['/students/a12.png', 0.479],
  ['/students/a13.png', 0.362], ['/students/a14.png', 0.339], ['/students/a15.png', 0.414],
  ['/students/a16.png', 0.359], ['/students/a17.png', 0.331], ['/students/a18.png', 0.409],
  ['/students/a19.png', 0.386], ['/students/a20.png', 0.322], ['/students/a21.png', 0.425],
  ['/students/a22.png', 0.332], ['/students/b01.png', 0.359], ['/students/b02.png', 0.322],
  ['/students/b03.png', 0.4], ['/students/b04.png', 0.456], ['/students/b05.png', 0.359],
  ['/students/b06.png', 0.324], ['/students/b07.png', 0.373], ['/students/b08.png', 0.375],
  ['/students/b09.png', 0.327], ['/students/b10.png', 0.392], ['/students/b11.png', 0.398],
  ['/students/b12.png', 0.325], ['/students/b13.png', 0.382], ['/students/b14.png', 0.396],
  ['/students/b15.png', 0.4], ['/students/b16.png', 0.37], ['/students/b17.png', 0.349],
  ['/students/b18.png', 0.358], ['/students/b19.png', 0.481], ['/students/b20.png', 0.327],
  ['/students/b21.png', 0.335],
];
const WALK: [string, number][] = [
  ['/students/w01.png', 0.476], ['/students/w02.png', 0.493], ['/students/w03.png', 0.514],
  ['/students/w04.png', 0.635], ['/students/w05.png', 0.474], ['/students/w06.png', 0.471],
  ['/students/w07.png', 0.514], ['/students/w08.png', 0.807], ['/students/w09.png', 0.716],
  ['/students/w10.png', 0.427], ['/students/w11.png', 0.493], ['/students/w12.png', 0.507],
  ['/students/w13.png', 0.477], ['/students/w14.png', 0.778], ['/students/w15.png', 0.6],
  ['/students/w16.png', 0.512], ['/students/w17.png', 0.507], ['/students/w18.png', 0.596],
  ['/students/w19.png', 0.459], ['/students/w20.png', 0.769], ['/students/w21.png', 0.424],
];

// Keyframe đi ngang (dùng chung cho người ĐI) + nhún nhẹ. vw → responsive.
const WALK_KEYFRAMES = `
@keyframes va-wk-r{from{transform:translateX(-16vw)}to{transform:translateX(116vw)}}
@keyframes va-wk-l{from{transform:translateX(116vw)}to{transform:translateX(-16vw)}}
@keyframes va-wk-r1{0%{transform:translateX(-16vw)}44%{transform:translateX(44vw)}55%{transform:translateX(44vw)}100%{transform:translateX(116vw)}}
@keyframes va-wk-r2{0%{transform:translateX(-16vw)}20%{transform:translateX(14vw)}29%{transform:translateX(14vw)}100%{transform:translateX(116vw)}}
@keyframes va-wk-l1{0%{transform:translateX(116vw)}44%{transform:translateX(48vw)}55%{transform:translateX(48vw)}100%{transform:translateX(-16vw)}}
@keyframes va-wk-l2{0%{transform:translateX(116vw)}20%{transform:translateX(78vw)}29%{transform:translateX(78vw)}100%{transform:translateX(-16vw)}}
@keyframes va-bob2{from{transform:translateY(0)}to{transform:translateY(-4px)}}
`;
const WK_R = ['va-wk-r', 'va-wk-r1', 'va-wk-r2'];
const WK_L = ['va-wk-l', 'va-wk-l1', 'va-wk-l2'];

type Row = {s: number; w: number; h: number; bottom: number; op: number; dur: [number, number]};
const ROWS: Row[] = [
  {s: 13, w: 6, h: 190, bottom: 72, op: 0.42, dur: [55, 75]},
  {s: 13, w: 6, h: 200, bottom: 34, op: 0.72, dur: [40, 55]},
  {s: 12, w: 5, h: 210, bottom: -12, op: 1, dur: [26, 40]},
];
const SEED = 71;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Walker = {
  key: string;
  src: string;
  w: number;
  h: number;
  bottom: number;
  op: number;
  kf: string;
  dur: number;
  delay: number;
  bob: number;
  bobDelay: number;
  flip: boolean;
};

// Keyframe riêng cho 1 người đứng: đứng ở "home", thỉnh thoảng nhích ±vài vw rồi về.
function standKeyframe(name: string, home: number, rand: () => number): string {
  const dx = (rand() < 0.5 ? -1 : 1) * (3 + rand() * 6);
  const a = 18 + rand() * 22; // thời điểm nhích lần 1 (%)
  const b = 58 + rand() * 22; // thời điểm nhích lần 2 (%)
  const x0 = home.toFixed(1);
  const x1 = (home + dx).toFixed(1);
  return (
    `@keyframes ${name}{0%{transform:translateX(${x0}vw)}` +
    `${a.toFixed(0)}%{transform:translateX(${x0}vw)}${(a + 4).toFixed(0)}%{transform:translateX(${x1}vw)}` +
    `${b.toFixed(0)}%{transform:translateX(${x1}vw)}${(b + 4).toFixed(0)}%{transform:translateX(${x0}vw)}` +
    `100%{transform:translateX(${x0}vw)}}`
  );
}

function buildCrowd(): {walkers: Walker[]; css: string} {
  const rand = rng(SEED);
  let sp = 0;
  let wp = 0;
  const out: Walker[] = [];
  const kfs: string[] = [];

  ROWS.forEach((L, li) => {
    // Người ĐỨNG — dàn đều "home" khắp 2..98vw + jitter, mỗi người 1 keyframe riêng.
    for (let i = 0; i < L.s; i++) {
      const k = STAND[sp++ % STAND.length];
      const home = 2 + ((i + 0.5) / L.s) * 96 + (rand() - 0.5) * 7;
      const name = `va-cs-${li}-${i}`;
      kfs.push(standKeyframe(name, home, rand));
      const h = Math.round(L.h * (0.95 + rand() * 0.08));
      const w = Math.round(h * k[1]);
      out.push({
        key: `s${li}-${i}`,
        src: k[0],
        w,
        h,
        bottom: L.bottom + Math.round((rand() - 0.5) * 10),
        op: L.op,
        kf: name,
        dur: +(90 + rand() * 70).toFixed(0), // chậm, chu kỳ dài → nhích thưa
        delay: +(-rand() * 90).toFixed(1), // pha ngẫu nhiên → không nhích cùng lúc
        bob: +(2.4 + rand() * 1.8).toFixed(2),
        bobDelay: +(-rand() * 3).toFixed(2),
        flip: rand() < 0.5,
      });
    }
    // Người ĐI — đi ngang qua, 2 chiều xen kẽ, pha rải đều.
    for (let i = 0; i < L.w; i++) {
      const k = WALK[wp++ % WALK.length];
      const d = i % 2; // 0 = đi phải, 1 = đi trái
      const base = ((L.dur[0] + L.dur[1]) / 2) * (d ? 1.06 : 0.94);
      const dur = +(base * (1 + (rand() - 0.5) * 0.12)).toFixed(1);
      const ph = (i + 0.5 + (rand() - 0.5) * 0.4) / L.w;
      const arr = d ? WK_L : WK_R;
      out.push({
        key: `w${li}-${i}`,
        src: k[0],
        w: Math.round(L.h * (0.95 + rand() * 0.08) * k[1]),
        h: Math.round(L.h * (0.95 + rand() * 0.08)),
        bottom: L.bottom + 4,
        op: L.op,
        kf: arr[Math.floor(rand() * arr.length)],
        dur,
        delay: +(-ph * dur).toFixed(1),
        bob: +(2.4 + rand() * 1.8).toFixed(2),
        bobDelay: +(-rand() * 3).toFixed(2),
        flip: d === 0, // sprite đi quay mặt trái → làn đi phải phải lật
      });
    }
  });

  return {walkers: out, css: WALK_KEYFRAMES + kfs.join('')};
}

export function StudentCrowd() {
  const {walkers, css} = buildCrowd();
  return (
    <div aria-hidden className="va-crowd pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: css}} />
      {walkers.map((wk) => (
        <div
          key={wk.key}
          className="absolute left-0"
          style={{
            bottom: wk.bottom,
            marginLeft: -wk.w / 2,
            opacity: wk.op,
            animation: `${wk.kf} ${wk.dur}s linear infinite`,
            animationDelay: `${wk.delay}s`,
          }}
        >
          <div
            style={{
              animation: `va-bob2 ${wk.bob}s ease-in-out infinite alternate`,
              animationDelay: `${wk.bobDelay}s`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wk.src}
              alt=""
              width={wk.w}
              height={wk.h}
              style={{display: 'block', transform: wk.flip ? 'scaleX(-1)' : undefined}}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
