// CHỮ NHỎ CÓ ĐỌC ĐƯỢC KHÔNG — WCAG 1.4.3, kiểm bằng số chứ không bằng mắt.
//
// VÌ SAO CẦN. Bảng màu của dự án có những màu ĐỦ tương phản cho chữ TO nhưng KHÔNG đủ cho chữ
// nhỏ. Đó là chuyện bình thường và đã được ghi rõ trong app/globals.css. Cái không bình thường
// là chúng cứ trôi dần sang chữ nhỏ: đợt rà soát 2026-08-04 đếm được 38 chỗ như vậy — nhãn 10.5px
// màu vàng trên chip vàng (2.88:1, cần 4.5), chữ 13px màu xanh báo thành công (4.34:1)...
//
// Không ai làm sai cố ý. Người viết chỉ chọn "màu xanh của trạng thái tốt" mà không có cách nào
// biết màu ấy chỉ đạt 4.34. Nên phải để máy đếm.
//
// LUẬT (WCAG 1.4.3 mức AA):
//   chữ TO  = ≥24px, hoặc ≥18.66px in đậm  → cần 3:1
//   chữ NHỎ = mọi thứ còn lại              → cần 4.5:1
//   icon / viền / thanh (không phải chữ)   → cần 3:1 (1.4.11)
//
//   node scripts/test-tuong-phan.mjs
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';

let dat = 0;
let hong = 0;
const check = (ten, ok, ghi = '') => {
  ok ? dat++ : hong++;
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ghi ? ' — ' + ghi : ''}`);
};

// ── Tính tương phản (sRGB, WCAG 2.x) ──────────────────────────────────────────────────────
const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = (rgb) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
};
// Trộn màu có alpha lên nền — chip nền của app đều là màu thương hiệu ở độ mờ thấp.
const tron = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const tiLe = (a, b) => {
  const [x, y] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (x + 0.05) / (y + 0.05);
};

const TRANG = hex('#ffffff');
// Đọc thẳng token từ globals.css — không chép tay, để đổi màu là phép kiểm tự theo.
const css = readFileSync('app/globals.css', 'utf8');
const token = (ten) => {
  const m = css.match(new RegExp('--color-' + ten + ':\\s*(#[0-9a-fA-F]{6})'));
  if (!m) throw new Error('Không thấy token --color-' + ten);
  return hex(m[1]);
};

// ── 1. Mỗi màu trạng thái phải có một nấc ĐỦ CHO CHỮ NHỎ ─────────────────────────────────
// Kiểm trên nền trắng VÀ trên chính chip nền của nó (chip mới là chỗ khó nhất).
const CAP = [
  {ten: 'thành công', nhat: 'success', dam: 'success-dark'},
  {ten: 'cảnh báo', nhat: 'warn', dam: 'warn-text'},
  {ten: 'hỏng', nhat: 'status-bad', dam: 'status-bad-dark'},
  {ten: 'vàng', nhat: 'gold', dam: 'gold-text'},
];
// Độ mờ chip lấy từ CHÍNH MÃ NGUỒN, không đoán: dò `bg-<màu>/<n>` và lấy đậm nhất đang dùng.
// Đóng cứng một con số ở đây là tự dựng ra một trường hợp không tồn tại rồi báo đỏ vì nó.
const nguonJsx = () => {
  const out = [];
  const w = (d) => {
    for (const f of readdirSync(d)) {
      const p2 = path.join(d, f);
      if (statSync(p2).isDirectory()) w(p2);
      else if (f.endsWith('.tsx')) out.push(readFileSync(p2, 'utf8'));
    }
  };
  w('app');
  w('components');
  return out.join('\n');
};
const JSX = nguonJsx();
// CHỈ tính những chip THẬT SỰ CÓ CHỮ ĐẶT LÊN — dòng vừa có `bg-<màu>/x` vừa có `text-…`.
// Bản đầu lấy chip đậm nhất ở bất kỳ đâu, và nó tóm nhầm `bg-gold/50` của một CHẤM tiến độ
// trong hướng dẫn — nơi không có chữ nào — rồi bắt cả bảng màu phải đọc được trên nền ấy.
// Một phép kiểm tự dựng ra trường hợp không tồn tại là một phép kiểm người ta sẽ tắt đi.
const chipDamNhat = (mau) => {
  let max = 0;
  for (const l of JSX.split('\n')) {
    if (!/\btext-[a-z-]+\b/.test(l)) continue;
    for (const m of l.matchAll(new RegExp('bg-' + mau + '/(?:\\[)?(0?\\.\\d+|\\d+)', 'g'))) {
      const v = parseFloat(m[1]);
      max = Math.max(max, v > 1 ? v / 100 : v);
    }
  }
  return max || 0.12;
};

for (const c of CAP) {
  const dam = token(c.dam);
  const nenChip = tron(token(c.nhat), chipDamNhat(c.nhat), TRANG);
  const trenTrang = tiLe(dam, TRANG);
  const trenChip = tiLe(dam, nenChip);
  check(
    `Nấc tối của màu ${c.ten} đọc được ở cỡ chữ nhỏ`,
    trenTrang >= 4.5 && trenChip >= 4.5,
    `--color-${c.dam}: ${trenTrang.toFixed(2)}:1 trên trắng · ${trenChip.toFixed(2)}:1 trên chip bg-${c.nhat}/${chipDamNhat(c.nhat)}`,
  );
}

// ── 2. Chữ phụ trên nền trắng ────────────────────────────────────────────────────────────
for (const t of ['txt', 'grey-mid', 'grey-soft']) {
  const r = tiLe(token(t), TRANG);
  check(`Chữ --color-${t} đạt 4.5:1 trên trắng`, r >= 4.5, `${r.toFixed(2)}:1`);
}

// ── 3. KHÔNG chỗ nào dùng nấc SÁNG cho chữ nhỏ ───────────────────────────────────────────
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.tsx')) files.push(p);
  }
};
walk('app');
walk('components');

const CO_TW = {'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24};
const NHAT = ['text-gold-deep', 'text-warn', 'text-success'];
// Những dòng CỐ Ý dùng nấc sáng vì đó KHÔNG phải chữ (icon trong ô tròn, viền nút chưa chọn).
// Ghi tường minh ở đây thay vì để phép kiểm tự đoán — đoán là chỗ báo động giả sinh ra.
const CHO_PHEP = [
  // Icon nằm trong ô tròn có nền — là hình, không phải chữ (WCAG 1.4.11: 3:1, đã đạt).
  'place-items-center rounded-full bg-gold/20 text-gold-deep',
  'place-items-center rounded-lg bg-gold/20 text-gold-deep',
  // Nút thắng/thua CHƯA ĐƯỢC CHỌN — trạng thái không hoạt động, WCAG miễn trừ tương phản.
  'border-success/30 text-success/40',
];

const pham = [];
for (const p of files) {
  const nice = p.split(path.sep).join('/');
  readFileSync(p, 'utf8')
    .split('\n')
    .forEach((l, i) => {
      const key = nice + ':' + (i + 1);
      if (CHO_PHEP.some((c) => l.includes(c))) return;
      const mau = NHAT.find((m) => new RegExp(m + '(?![-\\w])').test(l));
      if (!mau) return;
      let px = null;
      const m1 = l.match(/text-\[(\d+(?:\.\d+)?)px\]/);
      if (m1) px = parseFloat(m1[1]);
      else for (const [k, v] of Object.entries(CO_TW)) if (new RegExp('(?<![-\\w])' + k + '(?![-\\w])').test(l)) px = v;
      const damChu = /font-(bold|extrabold|black|semibold)/.test(l);
      if (px === null && /size=\{/.test(l)) return; // icon
      if (px !== null && (px >= 24 || (px >= 18.66 && damChu))) return; // chữ to
      pham.push(key + '  ' + mau + (px === null ? ' (kế thừa cỡ)' : ' ' + px + 'px'));
    });
}
check(
  'Không chỗ nào dùng màu nấc sáng cho chữ nhỏ',
  pham.length === 0,
  pham.length ? pham.slice(0, 10).join(' · ') + (pham.length > 10 ? ` … +${pham.length - 10}` : '') : `${files.length} file`,
);

// ── 4. Bảng rộng phải nằm trong khung cuộn riêng ─────────────────────────────────────────
// Luật của dự án: TRANG không được cuộn ngang trên điện thoại; bảng rộng thì cuộn trong khung
// của chính nó. Một `min-w-[900px]` không có khung bọc là cả trang bị kéo ngang ở màn 360px.
const tran = [];
for (const p of files) {
  const s = readFileSync(p, 'utf8');
  const rong = [...s.matchAll(/min-w-\[(\d+)px\]/g)].map((m) => +m[1]).filter((x) => x > 360);
  if (rong.length && !/overflow-x-auto|overflow-auto|overflow-x-scroll/.test(s))
    tran.push(p.split(path.sep).join('/') + ' (' + rong.join(',') + 'px)');
}
check('Mọi bảng rộng đều nằm trong khung cuộn riêng', tran.length === 0, tran.join(' · '));

// ── 5. Hộp nổi (modal/popover) phải co được về màn 360px ─────────────────────────────────
const cung = [];
for (const p of files) {
  readFileSync(p, 'utf8')
    .split('\n')
    .forEach((l, i) => {
      for (const m of l.matchAll(/(?<![a-z-])(sm:|md:|lg:|xl:)?w-\[(\d+)px\]/g)) {
        if (+m[2] <= 360 || m[1]) continue; // nhỏ hơn màn, hoặc đã có breakpoint che
        if (/max-w-full|inset-x-/.test(l)) continue; // đã có đường co
        cung.push(p.split(path.sep).join('/') + ':' + (i + 1) + ' w-[' + m[2] + 'px]');
      }
    });
}
check('Hộp nổi nào cũng co được về màn 360px', cung.length === 0, cung.join(' · '));

// ── 6. Liên kết chữ nhỏ phải có vùng chạm ≥24px ─────────────────────────────────────────
// WCAG 2.5.8 (AA) đòi vùng chạm tối thiểu 24×24. Một thẻ <a> chữ 12px KHÔNG có padding dọc thì
// hộp của chính nó chỉ cao 18–20px, dù ô bảng quanh nó rộng rãi — ngón tay bấm trượt.
// Đo trên trình duyệt bắt được 7 chỗ như vậy: tên học sinh ở /roster và /wig/chi-tiet, tên môn
// ở /timetable, ba liên kết trong phòng họp, và "Xem thực đơn cả tuần" trên thẻ của phụ huynh.
const chamNho = [];
for (const p of files) {
  const nice = p.split(path.sep).join('/');
  readFileSync(p, 'utf8')
    .split('\n')
    .forEach((l, i) => {
      if (!/className=/.test(l)) return;
      const m = l.match(/text-\[(\d+(?:\.\d+)?)px\]/);
      if (!m || parseFloat(m[1]) >= 14) return;
      if (!/underline/.test(l)) return; // dấu hiệu của liên kết chữ
      // Đã bảo đảm chiều cao bằng một trong các cách sau thì thôi.
      //
      // CHỈ nhận tiện ích THEO THANG (py-1, h-8, p-2) và `min-h-[…]` tường minh. Giá trị tuỳ ý
      // như `py-[3px]` KHÔNG được nhận: từ chuỗi class không tính ra được nó có đủ 24px hay
      // không, mà đoán theo hướng "chắc là đủ" thì phép kiểm thành vô dụng. Cần giá trị lẻ thì
      // kèm thêm `min-h-[24px]` cho rõ ý. (Đúng luật này vừa bắt được một lần khi tôi thử
      // `py-[3px]` — nó đủ 26px thật, nhưng máy không có cách nào biết.)
      if (/min-h-\[|\bh-\d|\bpy-\d|ctl-h|\bp-\d/.test(l)) return;
      chamNho.push(nice + ':' + (i + 1) + '  ' + m[1] + 'px');
    });
}
check(
  'Liên kết chữ nhỏ nào cũng có vùng chạm ≥24px',
  chamNho.length === 0,
  chamNho.length ? chamNho.join(' · ') : 'đã kiểm ' + files.length + ' file',
);

console.log(`\n${dat}/${dat + hong} đạt.`);
process.exit(hong === 0 ? 0 : 1);
