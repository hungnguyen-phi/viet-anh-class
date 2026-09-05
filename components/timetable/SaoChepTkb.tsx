'use client';

import {useActionState, useEffect, useState} from 'react';
import {AlertCircle, Copy} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {XacNhanForm} from '@/components/ui/PopupXacNhan';
import {btnGold, btnGhost, selectCls} from '@/components/ui/Field';
import {saoChepTuLop, type LuuOState} from '@/app/[locale]/(dashboard)/timetable/actions';

// SAO CHÉP THỜI KHOÁ BIỂU TỪ LỚP KHÁC — các lớp cùng khối thường học cùng một khung.
// Chọn lớp nguồn → (tick ghi đè nếu muốn) → hộp hỏi lại → lưu. Ghi đè là thao tác không hoàn tác
// được trên 40 ô, nên đi qua XacNhanForm (hộp của app, không phải window.confirm).

export type NhanSaoChep = {
  nut: string;
  tieuDe: string;
  huongDan: string;
  lopNguon: string;
  chonLop: string;
  ghiDe: string;
  ghiDeHint: string;
  hoi: string; // "Sao chép từ {lop}? …"
  dongY: string;
  luu: string;
  huy: string;
  khongCoLop: string;
};

export function SaoChepTkb({
  classId,
  lopKhac,
  nhan,
}: {
  classId: string;
  lopKhac: {id: string; name: string}[];
  nhan: NhanSaoChep;
}) {
  const [mo, setMo] = useState(false);
  const [nguon, setNguon] = useState('');
  const [ghiDe, setGhiDe] = useState(false);
  const [state, formAction] = useActionState<LuuOState, FormData>(saoChepTuLop, {ok: false});
  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state.ok]);
  const tenNguon = lopKhac.find((l) => l.id === nguon)?.name ?? '';

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        data-hd="tkb-sao-chep"
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[8px] border-[1.5px] border-navy/15 bg-white/60 px-2.5 text-chu-thich font-extrabold text-navy transition-colors hover:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:min-h-0 sm:h-8"
      >
        <Copy size={12} strokeWidth={2.5} />
        {nhan.nut}
      </button>
      {mo && (
        <Popup title={nhan.tieuDe} onClose={() => setMo(false)} width="max-w-[440px]">
          {lopKhac.length === 0 ? (
            <p className="text-than font-semibold text-grey-mid">{nhan.khongCoLop}</p>
          ) : (
            <XacNhanForm
              action={formAction}
              hoi={nhan.hoi.replace('{lop}', tenNguon)}
              nhanDongY={nhan.dongY}
              nguyHiem={ghiDe}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="ghi_de" value={ghiDe ? '1' : ''} />
              <p className="text-than font-semibold leading-relaxed text-grey-mid">{nhan.huongDan}</p>
              <label className="flex flex-col gap-1">
                <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{nhan.lopNguon}</span>
                <select name="nguon_id" required value={nguon} onChange={(e) => setNguon(e.target.value)} className={selectCls} autoFocus>
                  <option value="">{nhan.chonLop}</option>
                  {lopKhac.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
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
                {nguon ? (
                  <SubmitButton className={btnGold} wrapClass="contents">
                    {nhan.luu}
                  </SubmitButton>
                ) : (
                  <span className={`${btnGold} pointer-events-none opacity-40`} aria-disabled>
                    {nhan.luu}
                  </span>
                )}
              </div>
            </XacNhanForm>
          )}
        </Popup>
      )}
    </>
  );
}
