'use client';

import {useActionState, useEffect, useState} from 'react';
import {AlertCircle, Clock3, Wand2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGold, btnGhost} from '@/components/ui/Field';
import {luuGioTiet, type LuuOState} from '@/app/[locale]/(dashboard)/timetable/actions';

// KHUNG GIỜ TIẾT HỌC (0149) — hộp thoại của GVCN, 12 hàng "tiết · từ · đến".
//
// Có nút "Tự điền": khai giờ bắt đầu tiết 1 + độ dài tiết + nghỉ giữa tiết là máy rải cả dãy —
// xếp 8 tiết bằng ba con số thay vì 16 ô giờ. Sau tiết 5 (hết buổi sáng ở đa số trường VN) máy
// KHÔNG tự đoán giờ chiều: các tiết đã rải ra vẫn sửa tay từng ô được, đó mới là nguồn sự thật.
//
// Nhãn truyền bằng props, không useTranslations — cùng lý do với OTiet.tsx ngay cạnh.

export type GioTiet = Record<number, {tu: string; den: string}>;

export type NhanGio = {
  moNut: string;
  tieuDe: string;
  tiet: string;
  tu: string;
  den: string;
  tuDien: string;
  batDau1: string;
  doDai: string;
  nghi: string;
  luu: string;
  huy: string;
};

const themPhut = (hhmm: string, phut: number): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const tong = h * 60 + m + phut;
  return `${String(Math.floor(tong / 60) % 24).padStart(2, '0')}:${String(tong % 60).padStart(2, '0')}`;
};

export function GioTietForm({
  classId,
  gio,
  nhan,
  soTiet,
}: {
  classId: string;
  gio: GioTiet;
  nhan: NhanGio;
  /** Số tiết đang hiện trên lưới (8) — form vẫn cho khai tới 12 nhưng gấp phần đuôi lại. */
  soTiet: number;
}) {
  const [mo, setMo] = useState(false);
  const [state, formAction] = useActionState<LuuOState, FormData>(luuGioTiet, {ok: false});
  // Ô giờ là state (không defaultValue) để nút "Tự điền" ghi được vào — form không controlled
  // thì máy rải xong người dùng không thấy gì đổi.
  const [o, setO] = useState<GioTiet>(gio);
  const [batDau1, setBatDau1] = useState(gio[1]?.tu ?? '07:00');
  const [doDai, setDoDai] = useState(45);
  const [nghi, setNghi] = useState(5);

  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state.ok]);

  const tuDien = () => {
    const ra: GioTiet = {};
    let tu = batDau1;
    for (let p = 1; p <= soTiet; p++) {
      const den = themPhut(tu, doDai);
      ra[p] = {tu, den};
      tu = themPhut(den, nghi);
    }
    setO(ra);
  };

  const oNho =
    'h-10 rounded-[9px] border-[1.5px] border-navy/15 bg-white px-2 text-[12.5px] font-bold tabular-nums text-navy outline-none focus:border-navy';

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[9px] border-[1.5px] border-navy/15 bg-white/60 px-2.5 text-[11.5px] font-extrabold text-navy transition-colors hover:border-navy sm:min-h-0 sm:h-8"
      >
        <Clock3 size={13} strokeWidth={2.4} />
        {nhan.moNut}
      </button>

      {mo && (
        <Popup title={nhan.tieuDe} onClose={() => setMo(false)} width="max-w-[440px]">
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="class_id" value={classId} />

            {/* Tự điền: ba con số → cả dãy. */}
            <div className="flex flex-wrap items-end gap-2 rounded-[12px] bg-navy/[0.04] p-2.5">
              <label className="flex flex-col gap-1 text-[10.5px] font-extrabold uppercase text-grey-mid">
                {nhan.batDau1}
                <input type="time" value={batDau1} onChange={(e) => setBatDau1(e.target.value)} className={`${oNho} w-28`} />
              </label>
              <label className="flex flex-col gap-1 text-[10.5px] font-extrabold uppercase text-grey-mid">
                {nhan.doDai}
                <input type="number" min={20} max={120} value={doDai} onChange={(e) => setDoDai(Number(e.target.value))} className={`${oNho} w-20`} />
              </label>
              <label className="flex flex-col gap-1 text-[10.5px] font-extrabold uppercase text-grey-mid">
                {nhan.nghi}
                <input type="number" min={0} max={60} value={nghi} onChange={(e) => setNghi(Number(e.target.value))} className={`${oNho} w-20`} />
              </label>
              <button type="button" onClick={tuDien} className={btnGhost}>
                <Wand2 size={13} strokeWidth={2.4} />
                {nhan.tuDien}
              </button>
            </div>

            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-2 gap-y-1.5">
              <span className="text-[10.5px] font-extrabold uppercase text-grey-mid">{nhan.tiet}</span>
              <span className="text-[10.5px] font-extrabold uppercase text-grey-mid">{nhan.tu}</span>
              <span className="text-[10.5px] font-extrabold uppercase text-grey-mid">{nhan.den}</span>
              {Array.from({length: soTiet}, (_, i) => i + 1).map((p) => (
                <FieldsTiet key={p} p={p} o={o} setO={setO} oNho={oNho} />
              ))}
            </div>

            {state.error && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
                <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMo(false)} className={btnGhost}>
                {nhan.huy}
              </button>
              <SubmitButton className={btnGold} wrapClass="contents">
                {nhan.luu}
              </SubmitButton>
            </div>
          </form>
        </Popup>
      )}
    </>
  );
}

function FieldsTiet({
  p,
  o,
  setO,
  oNho,
}: {
  p: number;
  o: GioTiet;
  setO: (f: (cu: GioTiet) => GioTiet) => void;
  oNho: string;
}) {
  const dat = (k: 'tu' | 'den') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setO((cu) => ({...cu, [p]: {tu: cu[p]?.tu ?? '', den: cu[p]?.den ?? '', [k]: e.target.value}}));
  return (
    <>
      <span className="text-[13px] font-bold text-navy">{p}</span>
      <input type="time" name={`tu_${p}`} value={o[p]?.tu ?? ''} onChange={dat('tu')} className={oNho} />
      <input type="time" name={`den_${p}`} value={o[p]?.den ?? ''} onChange={dat('den')} className={oNho} />
    </>
  );
}
