(() => {
  const de = document.documentElement;

  // ── Tương phản: vẽ lên canvas để trình duyệt tự quy đổi oklab và tự trộn alpha ──
  const cv = document.createElement('canvas');
  cv.width = cv.height = 4;
  const cx = cv.getContext('2d', {willReadFrequently: true});
  const rgbOf = (fg, bg) => {
    cx.clearRect(0, 0, 4, 4);
    cx.fillStyle = bg; cx.fillRect(0, 0, 4, 4);
    cx.fillStyle = fg; cx.fillRect(0, 0, 4, 4);
    const d = cx.getImageData(1, 1, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = (a) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(a[0]) + 0.7152 * f(a[1]) + 0.0722 * f(a[2]);
  };
  const tiLe = (fg, bg) => {
    const F = lum(rgbOf(fg, bg)), B = lum(rgbOf(bg, 'rgb(255,255,255)'));
    const [x, y] = F > B ? [F, B] : [B, F];
    return (x + 0.05) / (y + 0.05);
  };
  const nenCua = (el) => {
    let p = el;
    while (p && p !== de) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const m = cs.backgroundImage.match(/rgba?\([^)]+\)/g);
        if (m) return m.slice().sort((a, b) => lum(rgbOf(a, '#fff')) - lum(rgbOf(b, '#fff')))[0];
      }
      const c = cs.backgroundColor;
      if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) {
        const mm = c.match(/[\d.]+/g).map(Number);
        if (mm.length < 4 || mm[3] > 0.85) return c;
      }
      p = p.parentElement;
    }
    return 'rgb(255,255,255)';
  };

  const kq = {
    vw: innerWidth,
    tranNgang: de.scrollWidth - de.clientWidth,
    cao: de.scrollHeight,
    contrast: [],
    tranPhai: [],
    thoatThe: [],
    chamNho: [],
    cuonNgangTrongKhung: 0,
  };

  // ── 1. Trang có bị kéo ngang không ──
  // Đây là luật cứng của dự án. Bảng rộng được phép cuộn TRONG khung của nó.
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= innerWidth + 1) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    let p = el.parentElement, trongKhung = false;
    while (p && p !== document.body) {
      const pc = getComputedStyle(p);
      if (pc.overflowX === 'auto' || pc.overflowX === 'scroll') { trongKhung = true; break; }
      p = p.parentElement;
    }
    if (trongKhung) continue;
    kq.tranPhai.push({
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 60),
      phai: Math.round(r.right),
      chu: (el.textContent || '').trim().slice(0, 34),
    });
  }

  // ── 1b. Nội dung THOÁT KHỎI THẺ CHA ──
  //
  // Luật này thiếu ở bản đầu, và nó bỏ lọt đúng cái lỗi nặng nhất tìm được ở màn 360: dòng
  // "N1 · Học sinh 7B1 (tổ trưởng)" đẩy con số "0/7" ra NGOÀI thẻ trắng, nằm chình ình trên nền
  // trang. Nó không vượt quá 360px nên luật (1) không thấy; con số vẫn rộng 58px nên luật (3)
  // cũng không thấy. Tôi chỉ tìm ra vì NHÌN vào ảnh chụp — và một lỗi chỉ tìm được bằng mắt là
  // một lỗi sẽ quay lại.
  //
  // Bỏ qua cha có overflow auto/scroll/hidden: ở đó thò ra là đúng thiết kế (bảng cuộn ngang).
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const p = el.parentElement;
    if (!p) continue;
    const pr = p.getBoundingClientRect();
    if (pr.width === 0) continue;
    // Phải soi CẢ TỔ TIÊN, không chỉ cha ruột — giống hệt luật (1) ngay trên.
    //
    // Bảng trong app dựng ba tầng: <div overflow-x-auto> › <div role="table"> › các dòng
    // min-w-[760px]. Cha ruột của dòng là cái role="table" KHÔNG có overflow, nên chỉ nhìn cha
    // ruột là báo cả ba mươi tư dòng "thò ra 442px" — trong khi chúng nằm gọn trong một khung
    // cuộn ngang đúng thiết kế. Ba mươi tư báo động giả trong một bản báo cáo là cách nhanh nhất
    // khiến người đọc bỏ qua luôn cả những dòng thật.
    let a = p, trongKhungCuon = false;
    while (a && a !== document.body) {
      const ac = getComputedStyle(a);
      if (['auto', 'scroll', 'hidden'].includes(ac.overflowX)) { trongKhungCuon = true; break; }
      a = a.parentElement;
    }
    if (trongKhungCuon) continue;
    if (getComputedStyle(el).position === 'absolute' || getComputedStyle(el).position === 'fixed') continue;
    // Dung sai 2px: bố cục flex/grid tính bằng số thực, một hàng justify-between ở 320px lệch
    // 1,44px là làm tròn chứ không phải lỗi ai nhìn ra. Lỗi thật nhỏ nhất đo được là 30px, nên
    // ngưỡng này không bỏ lọt gì.
    if (r.right > pr.right + 2 || r.left < pr.left - 2)
      kq.thoatThe.push({
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 50),
        thoaRa: +Math.max(r.right - pr.right, pr.left - r.left).toFixed(2),
        chu: (el.textContent || '').trim().slice(0, 30),
      });
  }

  // ── 2. Tương phản ở CHÍNH cỡ chữ mà điện thoại vẽ ra ──
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const s = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight) || 400;
    const can = s >= 24 || (s >= 18.66 && w >= 700) ? 3 : 4.5;
    const t = tiLe(cs.color, nenCua(el));
    if (t < can)
      kq.contrast.push({chu: el.textContent.trim().slice(0, 34), cỡ: +s.toFixed(1), tl: +t.toFixed(2), can});
  }

  // ── 3. Vùng chạm — trên điện thoại luật dự án là 44px cho màn học sinh, sàn WCAG là 24 ──
  for (const el of document.querySelectorAll('a,button,input:not([type=hidden]),select,textarea,[role=button]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    // Bỏ qua ô ẩn kiểu `sr-only`: hộp của chính nó là 1×1, nhưng vùng bấm thật là cái <label>
    // bọc ngoài (32×32). Đếm nó là báo động giả — và báo động giả làm người ta thôi đọc kết quả.
    if (el.classList.contains('sr-only') || (r.width <= 2 && r.height <= 2)) continue;
    if (r.width < 24 || r.height < 24)
      kq.chamNho.push({
        tag: el.tagName,
        w: Math.round(r.width),
        h: Math.round(r.height),
        ten: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 26),
      });
  }

  // ── 4. Bao nhiêu khung phải cuộn ngang (đúng thiết kế, nhưng nhiều quá là khó dùng) ──
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4)
      kq.cuonNgangTrongKhung++;
  }

  kq.soContrast = kq.contrast.length;
  kq.soTranPhai = kq.tranPhai.length;
  kq.soThoatThe = kq.thoatThe.length;
  kq.soChamNho = kq.chamNho.length;
  kq.contrast = kq.contrast.slice(0, 6);
  kq.tranPhai = kq.tranPhai.slice(0, 6);
  kq.thoatThe = kq.thoatThe.slice(0, 6);
  kq.chamNho = kq.chamNho.slice(0, 6);
  return kq;
})()
