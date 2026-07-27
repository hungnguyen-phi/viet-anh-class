'use client';

// 'use client' KHÔNG phải vì cần tương tác — component này thuần trang trí. Lý do: là server
// component thì toàn bộ markup bị serialize HAI lần (một lần vào HTML, một lần vào RSC flight
// payload) → trang login phình 151 KB, trong đó 92 KB là payload. Là client component thì payload
// chỉ chứa tham chiếu module, HTML vẫn có sẵn nhờ SSR. An toàn vì RNG có seed → server/client
// render giống hệt, không lệch hydrate.

// Mây trôi + chim bay cho nền login. Thuần SVG/CSS, keyframes nhúng inline
// (Tailwind v4 purge keyframes chỉ tham chiếu qua inline style). Deterministic
// (RNG seed) → server & client render giống hệt. Nằm ở lớp trời phía trên, sau
// đám đông học sinh (z thấp hơn). Ẩn hoạt ảnh khi prefers-reduced-motion.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYFRAMES = `
@keyframes va-cloud{from{transform:translateX(-26vw)}to{transform:translateX(126vw)}}
@keyframes va-cloud-bob{from{transform:translateY(0)}to{transform:translateY(7px)}}
@keyframes va-bird-fly{0%{transform:translate(-14vw,0)}100%{transform:translate(120vw,-6vh)}}
@keyframes va-bird-bob{0%{transform:translateY(0)}50%{transform:translateY(10px)}100%{transform:translateY(0)}}
@keyframes va-flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.45)}}
@media (prefers-reduced-motion: reduce){.va-sky *{animation:none!important}}
/* Mobile: ít mây/chim hơn (ẩn extra), nhỏ hơn (--cs), trôi chậm hơn (--m). */
@media (max-width:640px){.va-sky{--m:1.8;--cs:0.6}.va-hide-sm{display:none}}
`;

// Mây: cụm ellipse trắng mềm.
function Cloud({o}: {o: number}) {
  return (
    <svg viewBox="0 0 120 60" width="100%" height="100%" aria-hidden>
      <g fill="#dbe4f7" opacity={o}>
        <ellipse cx="34" cy="40" rx="24" ry="17" />
        <ellipse cx="58" cy="30" rx="28" ry="21" />
        <ellipse cx="85" cy="41" rx="22" ry="15" />
        <rect x="30" y="40" width="62" height="17" rx="8.5" />
      </g>
      {/* Vệt sáng trên đỉnh mây cho khối */}
      <g fill="#ffffff" opacity={o * 0.9}>
        <ellipse cx="56" cy="26" rx="22" ry="15" />
        <ellipse cx="34" cy="36" rx="18" ry="12" />
      </g>
    </svg>
  );
}

// Chim: hình cánh "⌒⌒" mảnh, vỗ bằng scaleY.
function Bird({size}: {size: number}) {
  return (
    <svg viewBox="0 0 40 20" width={size} height={size / 2} aria-hidden style={{display: 'block'}}>
      <path
        d="M3 13 Q11 3 20 11 Q29 3 37 13"
        fill="none"
        stroke="#26275d"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type CloudItem = {key: string; top: number; w: number; op: number; dur: number; delay: number; bob: number; bobDelay: number};
type BirdItem = {key: string; top: number; size: number; op: number; dur: number; delay: number; flap: number; bob: number};

const SEED = 47;

function build(): {clouds: CloudItem[]; flocks: BirdItem[][]} {
  const rand = rng(SEED);

  // 6 đám mây rải trên vùng trời phía trên.
  const clouds: CloudItem[] = Array.from({length: 6}, (_, i) => {
    const w = 120 + rand() * 130; // px
    return {
      key: `c${i}`,
      top: 4 + ((i + rand() * 0.6) / 6) * 32, // % — 4..40% chiều cao
      w,
      op: 0.5 + rand() * 0.4,
      dur: +(90 + rand() * 80).toFixed(1), // trôi rất chậm
      delay: +(-rand() * 160).toFixed(1),
      bob: +(5 + rand() * 4).toFixed(2),
      bobDelay: +(-rand() * 4).toFixed(2),
    };
  });

  // 3 đàn chim, mỗi đàn 3–5 con so le hình chữ V.
  const flocks: BirdItem[][] = Array.from({length: 3}, (_, f) => {
    const n = 3 + Math.floor(rand() * 3);
    const baseTop = 8 + rand() * 26; // % nơi đàn xuất phát
    const dur = +(26 + rand() * 22).toFixed(1);
    const delay = +(-rand() * dur - f * 9).toFixed(1);
    const size = 24 + rand() * 16;
    return Array.from({length: n}, (_, i) => {
      const off = i - (n - 1) / 2; // vị trí so với tâm đàn
      return {
        key: `f${f}b${i}`,
        top: baseTop + Math.abs(off) * 2.4, // chữ V: rìa thấp hơn
        size: size * (1 - Math.abs(off) * 0.06),
        op: 0.72,
        dur,
        delay: +(delay - Math.abs(off) * 0.5).toFixed(1),
        flap: +(0.4 + rand() * 0.25).toFixed(2), // nhịp vỗ cánh
        bob: +(2.6 + rand() * 1.4).toFixed(2),
      };
    });
  });

  return {clouds, flocks};
}

export function SkyDecor() {
  const {clouds, flocks} = build();
  return (
    <div aria-hidden className="va-sky pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: KEYFRAMES}} />

      {/* Mây — mobile ẩn HẾT (va-hide-sm cho mọi đám); desktop nhỏ hơn (--cs), chậm hơn (--m). */}
      {clouds.map((c) => (
        <div
          key={c.key}
          className="absolute left-0 va-hide-sm"
          style={{
            top: `${c.top}%`,
            width: `calc(${c.w}px * var(--cs, 1))`,
            height: `calc(${c.w / 2}px * var(--cs, 1))`,
            marginLeft: `calc(${-c.w / 2}px * var(--cs, 1))`,
            filter: 'drop-shadow(0 10px 18px rgba(38,39,93,0.10))',
            animationName: 'va-cloud',
            animationDuration: `calc(${c.dur}s * var(--m, 1))`,
            animationTimingFunction: 'linear',
            animationIterationCount: 'infinite',
            animationDelay: `${c.delay}s`,
          }}
        >
          <div
            style={{
              animation: `va-cloud-bob ${c.bob}s ease-in-out infinite alternate`,
              animationDelay: `${c.bobDelay}s`,
            }}
          >
            <Cloud o={c.op} />
          </div>
        </div>
      ))}

      {/* Chim theo đàn — mobile chỉ giữ đàn đầu (fi ≥ 1 ẩn), bay chậm hơn (--m). */}
      {flocks.flatMap((flock, fi) =>
        flock.map((b) => (
          <div
            key={b.key}
            className={`absolute left-0${fi >= 1 ? ' va-hide-sm' : ''}`}
            style={{
              top: `${b.top}%`,
              opacity: b.op,
              animationName: 'va-bird-fly',
              animationDuration: `calc(${b.dur}s * var(--m, 1))`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationDelay: `${b.delay}s`,
            }}
          >
            <div style={{animation: `va-bird-bob ${b.bob}s ease-in-out infinite`, animationDelay: `${b.delay}s`}}>
              <div style={{animation: `va-flap ${b.flap}s ease-in-out infinite`}}>
                <Bird size={b.size} />
              </div>
            </div>
          </div>
        )),
      )}
    </div>
  );
}
