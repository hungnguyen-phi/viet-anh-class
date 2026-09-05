'use client';

import {useActionState, useEffect, useMemo, useState} from 'react';
import {AlertCircle, ClipboardPaste} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold, btnGhost} from '@/components/ui/Field';
import {boDau} from '@/lib/don-vi';
import {nhapHangLoat, type LuuOState} from '@/app/[locale]/(dashboard)/timetable/actions';
import type {MonChon} from './OTiet';

// NHẬP THỜI KHOÁ BIỂU HÀNG LOẠT — dán bảng từ Excel/Sheets, xem trước, lưu một lần.
//
// Vì sao có: 28 lớp × 40 ô, mà bản cũ chỉ có cách bấm từng ô — nên các lớp thật trống trơn
// (audit 04/09/2026). Phòng đào tạo vốn xếp lịch trên bảng tính; dán nguyên bảng ấy vào đây là
// đúng thao tác họ đã quen.
//
// Nhận DẠNG TỰ DO: ô cách nhau bằng tab (dán từ bảng tính), hoặc dấu phẩy / chấm phẩy / 2+ khoảng
// trắng. Hàng = tiết, cột = thứ (T2…CN); có dòng tiêu đề "T2 T3…" hay cột "Tiết 1…" thì bỏ qua;
// nếu bảng xoay (hàng = thứ) thì máy tự lật. Tên môn được đối chiếu KHÔNG DẤU với danh mục môn của
// lớp (tên đủ, tên ngắn); ô nào không khớp thì người dùng chọn tay trong bảng xem trước hoặc bỏ.
//
// Nhãn truyền qua props (không useTranslations) — cùng lối với OTiet.tsx: namespace `timetable`
// không nằm trong bundle trình duyệt.

export type NhanNhap = {
  nut: string;
  tieuDe: string;
  huongDan: string;
  oDan: string;
  xemTruoc: string;
  ghiDe: string;
  ghiDeHint: string;
  khongKhop: string;
  chonMon: string;
  boQua: string;
  tomTat: string; // "{n} ô sẽ lưu · {m} ô chưa rõ môn"
  luu: string;
  huy: string;
  tiet: string;
  khongCoMon: string;
};

type Cell = {d: number; p: number; goc: string; monId: string | null};

const NGAY_RE = /^(t(hứ)?\s*[2-7]|cn|chủ\s*nhật|sun(day)?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?)$/i;
const TIET_RE = /^(tiết|tiet|period|p)?\s*(\d{1,2})$/i;

// Ngày → số thứ của repo (2..8, 8 = CN).
function thuCua(s: string): number | null {
  const x = boDau(s).replace(/\s+/g, '');
  if (/^(cn|chunhat|sun|sunday)$/.test(x)) return 8;
  const m = x.match(/^(t|thu)([2-7])$/);
  if (m) return Number(m[2]);
  const en: Record<string, number> = {mon: 2, monday: 2, tue: 3, tuesday: 3, wed: 4, wednesday: 4, thu: 5, thursday: 5, fri: 6, friday: 6, sat: 7, saturday: 7};
  return en[x] ?? null;
}

function tachDong(raw: string): string[][] {
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '')
    .map((l) => (l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : l.includes(',') ? l.split(',') : l.split(/ {2,}/)))
    .map((cells) => cells.map((c) => c.trim()));
}

/** Đọc bảng dán thành lưới ô {thứ, tiết, chữ}. Trả thêm cờ đã lật hay chưa để nói cho người dùng. */
export function docBangDan(raw: string, soTiet: number): {o: {d: number; p: number; goc: string}[]; lat: boolean} {
  let hang = tachDong(raw);
  if (hang.length === 0) return {o: [], lat: false};

  // Dòng đầu là tiêu đề thứ? → cột theo thứ ấy. Cột đầu là "Tiết n"? → hàng theo tiết ấy.
  const dongDau = hang[0];
  const laTieuDeThu = dongDau.filter((c) => NGAY_RE.test(c)).length >= 3;
  // Bảng xoay: cột đầu là các thứ, dòng đầu là các tiết.
  const cotDau = hang.map((r) => r[0] ?? '');
  const laCotThu = cotDau.filter((c) => NGAY_RE.test(c)).length >= 3;
  const laDongTiet = dongDau.filter((c) => TIET_RE.test(c)).length >= 3;
  let lat = false;
  if (laCotThu && !laTieuDeThu) {
    // Lật: hàng ↔ cột.
    const rong = Math.max(...hang.map((r) => r.length));
    const moi: string[][] = [];
    for (let j = 0; j < rong; j++) moi.push(hang.map((r) => r[j] ?? ''));
    hang = moi;
    lat = true;
    void laDongTiet;
  }

  // Sau khi (có thể) lật: dòng đầu có thể là tiêu đề thứ; cột đầu có thể là nhãn tiết.
  let thuTheoCot: (number | null)[] | null = null;
  if (hang[0].filter((c) => NGAY_RE.test(c)).length >= 3) {
    thuTheoCot = hang[0].map((c) => thuCua(c));
    hang = hang.slice(1);
  }
  const coNhanTiet = hang.filter((r) => TIET_RE.test(r[0] ?? '')).length >= Math.min(3, hang.length);
  const o: {d: number; p: number; goc: string}[] = [];
  hang.forEach((r, i) => {
    let cells = r;
    let p = i + 1;
    if (coNhanTiet) {
      const m = (cells[0] ?? '').match(TIET_RE);
      if (m) p = Number(m[2]);
      cells = cells.slice(1);
      if (thuTheoCot && thuTheoCot.length === r.length) thuTheoCot = thuTheoCot.slice(1);
    }
    if (p < 1 || p > 12) return;
    cells.forEach((goc, j) => {
      if (!goc) return;
      const d = thuTheoCot ? thuTheoCot[j] : j + 2;
      if (!d || d < 2 || d > 8) return;
      o.push({d, p, goc});
    });
  });
  void soTiet;
  return {o, lat};
}

export function NhapHangLoat({
  classId,
  monHoc,
  nhan,
  cacThu,
  soTiet,
}: {
  classId: string;
  monHoc: (MonChon & {ngan?: string})[];
  nhan: NhanNhap;
  cacThu: {value: number; label: string}[];
  soTiet: number;
}) {
  const [mo, setMo] = useState(false);
  const [raw, setRaw] = useState('');
  const [ghiDe, setGhiDe] = useState(false);
  const [chonTay, setChonTay] = useState<Record<string, string>>({});
  const [state, formAction] = useActionState<LuuOState, FormData>(nhapHangLoat, {ok: false});

  useEffect(() => {
    if (state.ok) {
      setMo(false);
      setRaw('');
      setChonTay({});
    }
  }, [state.ok]);

  // Bảng tra tên môn KHÔNG DẤU: tên đủ, tên ngắn (GDCD, KHTN…). Khớp đủ trước, khớp "bắt đầu
  // bằng" sau — và chỉ nhận khi đúng MỘT môn khớp, mơ hồ thì để người dùng chọn.
  const traMon = useMemo(() => {
    const du = new Map<string, string>();
    for (const m of monHoc) {
      du.set(boDau(m.name), m.id);
      if (m.ngan) du.set(boDau(m.ngan), m.id);
    }
    return (goc: string): string | null => {
      const k = boDau(goc);
      if (!k) return null;
      if (du.has(k)) return du.get(k)!;
      const gan = monHoc.filter((m) => boDau(m.name).startsWith(k) || k.startsWith(boDau(m.name)));
      return gan.length === 1 ? gan[0].id : null;
    };
  }, [monHoc]);

  const {o: cacO, lat} = useMemo(() => docBangDan(raw, soTiet), [raw, soTiet]);
  const cells: Cell[] = useMemo(
    () => cacO.map((c) => ({...c, monId: chonTay[`${c.d}-${c.p}`] ?? traMon(c.goc)})),
    [cacO, chonTay, traMon],
  );
  const seLuu = cells.filter((c) => c.monId);
  const chuaRo = cells.filter((c) => !c.monId);
  const nhanThu = (d: number) => cacThu.find((x) => x.value === d)?.label ?? `T${d}`;
  const tenMon = (id: string) => monHoc.find((m) => m.id === id)?.name ?? '';
  const oInput =
    'w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-1 text-doc font-semibold text-navy focus-visible:border-navy focus-visible:outline-none sm:text-than';

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        data-hd="tkb-nhap-loat"
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[8px] border-[1.5px] border-navy/15 bg-white/60 px-2.5 text-chu-thich font-extrabold text-navy transition-colors hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:min-h-0 sm:h-8"
      >
        <ClipboardPaste size={12} strokeWidth={2.5} />
        {nhan.nut}
      </button>

      {mo && (
        <Popup title={nhan.tieuDe} onClose={() => setMo(false)} width="max-w-[720px]">
          {monHoc.length === 0 ? (
            <p className="rounded-[8px] bg-warn/[0.12] px-3 py-2 text-than font-semibold text-navy">{nhan.khongCoMon}</p>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="ghi_de" value={ghiDe ? '1' : ''} />
              <input
                type="hidden"
                name="cac_o"
                value={JSON.stringify(seLuu.map((c) => ({d: c.d, p: c.p, s: c.monId})))}
              />
              <p className="text-than font-semibold leading-relaxed text-grey-mid">{nhan.huongDan}</p>
              <label className="flex flex-col gap-1">
                <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{nhan.oDan}</span>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={6}
                  autoFocus
                  spellCheck={false}
                  className="w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 font-mono text-doc text-navy focus-visible:border-navy focus-visible:outline-none sm:text-than"
                />
              </label>

              {cells.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-chu-thich font-bold text-navy">
                    <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{nhan.xemTruoc}</span>
                    <span>{nhan.tomTat.replace('{n}', String(seLuu.length)).replace('{m}', String(chuaRo.length))}</span>
                    {lat && <span className="text-grey-mid">↻</span>}
                  </div>
                  {/* Lưới xem trước: hàng = tiết, cột = thứ có dữ liệu. Cuộn ngang trong hộp ở máy hẹp. */}
                  <div className="overflow-x-auto rounded-[12px] border-[1.5px] border-navy/10">
                    <table className="w-full min-w-[520px] border-collapse text-chu-thich">
                      <thead>
                        <tr className="bg-navy/[0.04] text-nhan font-extrabold uppercase text-grey-mid">
                          <th className="px-2 py-1.5 text-left">{nhan.tiet}</th>
                          {cacThu
                            .filter((t) => cells.some((c) => c.d === t.value))
                            .map((t) => (
                              <th key={t.value} className="px-2 py-1.5 text-left">
                                {t.label}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...new Set(cells.map((c) => c.p))]
                          .sort((a, b) => a - b)
                          .map((p) => (
                            <tr key={p} className="border-t border-navy/[0.08] align-top">
                              <td className="px-2 py-1.5 font-extrabold text-grey-mid">{p}</td>
                              {cacThu
                                .filter((t) => cells.some((c) => c.d === t.value))
                                .map((t) => {
                                  const c = cells.find((x) => x.d === t.value && x.p === p);
                                  if (!c) return <td key={t.value} className="px-2 py-1.5 text-navy/20">·</td>;
                                  return (
                                    <td key={t.value} className="px-2 py-1.5">
                                      {c.monId ? (
                                        <span className="font-bold text-navy" title={c.goc}>
                                          {tenMon(c.monId)}
                                        </span>
                                      ) : (
                                        <span className="flex flex-col gap-1">
                                          <span className="text-chu-thich font-bold text-status-bad" title={nhan.khongKhop}>
                                            “{c.goc}”
                                          </span>
                                          <select
                                            aria-label={`${nhan.chonMon} · ${nhanThu(c.d)} · ${nhan.tiet} ${p}`}
                                            value={chonTay[`${c.d}-${c.p}`] ?? ''}
                                            onChange={(e) =>
                                              setChonTay((s) => ({...s, [`${c.d}-${c.p}`]: e.target.value}))
                                            }
                                            className={oInput}
                                          >
                                            <option value="">{nhan.boQua}</option>
                                            {monHoc.map((m) => (
                                              <option key={m.id} value={m.id}>
                                                {m.name}
                                              </option>
                                            ))}
                                          </select>
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <label className="flex cursor-pointer items-start gap-2 text-than font-semibold text-navy">
                <input type="checkbox" checked={ghiDe} onChange={(e) => setGhiDe(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-navy)]" />
                <span>
                  {nhan.ghiDe}
                  <span className="block text-chu-thich font-semibold text-grey-mid">{nhan.ghiDeHint}</span>
                </span>
              </label>

              {state.error && (
                <p className="inline-flex items-start gap-1.5 rounded-[8px] bg-status-bad/[0.08] px-2.5 py-2 text-than font-bold text-status-bad">
                  <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                  {state.error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMo(false)} className={btnGhost}>
                  {nhan.huy}
                </button>
                {seLuu.length > 0 ? (
                  <SubmitButton className={btnGold} wrapClass="contents">
                    {nhan.luu}
                  </SubmitButton>
                ) : (
                  <span className={`${btnGold} pointer-events-none opacity-40`} aria-disabled>
                    {nhan.luu}
                  </span>
                )}
              </div>
            </form>
          )}
        </Popup>
      )}
    </>
  );
}
