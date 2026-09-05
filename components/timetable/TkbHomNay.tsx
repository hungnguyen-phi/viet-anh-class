'use client';

import {useState, type ReactNode} from 'react';
import {ArrowRight, MapPin, UserRound} from 'lucide-react';
import {NutTiet, type ODangSua} from './OTiet';

// THỜI KHOÁ BIỂU TRÊN ĐIỆN THOẠI: MỘT NGÀY MỘT CỘT.
//
// Lưới 7 ngày × 8 tiết rộng 1000px; trên máy 360px chỉ thấy T2–T3 và không có dấu hiệu cuộn
// (audit 04/09/2026). Em mở app buổi sáng chỉ cần biết HÔM NAY học gì — nên mặc định hiện đúng
// ngày hôm nay (cuối tuần thì thứ Hai tới), có dải chọn ngày, và một nút "Cả tuần" cho ai cần
// nhìn toàn cảnh (khi ấy hiện lại lưới đầy đủ, cuộn ngang).
//
// Chỉ bố cục ở đây; dữ liệu và nhãn do máy chủ dựng sẵn, truyền qua props (cùng lối OTiet).

export type TietTrongNgay = {
  p: number;
  gio?: {tu: string; den: string};
  ten: string | null; // null = ô trống
  phong: string | null;
  giaoVien: string | null;
  kind: string;
  ov: {status: string; new_date?: string | null; new_period_no?: number | null; substitute_name?: string | null} | null;
  o: ODangSua;
};

export type NgayTkb = {
  d: number;
  nhan: string; // "T2"
  ngay: string; // "09-01"
  laHomNay: boolean;
  tiet: TietTrongNgay[];
};

const KIND: Record<string, string> = {
  exam: 'border-gold/60 bg-gold/[0.18]',
  practice: 'border-success/40 bg-success/[0.12]',
  regular: 'border-navy/12 bg-navy/[0.05]',
};

export function TkbHomNay({
  ngay,
  nhan,
  batDuoc,
  trong,
  children,
}: {
  ngay: NgayTkb[];
  nhan: {caTuan: string; homNay: string; tiet: string; trongNgay: string; ovCancelled: string; ovSubstituted: string; them: string};
  /** Người xem sửa được lưới (GVCN/admin) — ô trống thành nút thêm. */
  batDuoc: boolean;
  /** Cả lớp chưa có tiết nào → câu nói thẳng thay vì bảng câm. */
  trong: string | null;
  children: ReactNode;
}) {
  const macDinh = ngay.find((n) => n.laHomNay)?.d ?? ngay[0]?.d ?? 2;
  const [chon, setChon] = useState<number>(macDinh);
  const [caTuan, setCaTuan] = useState(false);
  const n = ngay.find((x) => x.d === chon) ?? ngay[0];

  return (
    // data-hd="tkb-ngay": neo dự phòng của tour TKB trên máy hẹp (lưới tuần không dựng ở đây).
    <div data-hd="tkb-ngay" className="flex flex-col gap-2">
      {/* Dải chọn ngày + nút Cả tuần. Nút chạm cao 44px. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ngay.map((x) => (
          <button
            key={x.d}
            type="button"
            onClick={() => {
              setChon(x.d);
              setCaTuan(false);
            }}
            aria-pressed={!caTuan && x.d === chon}
            className={`flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-[8px] px-2 text-chu-thich font-extrabold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              !caTuan && x.d === chon ? 'bg-navy text-white' : x.laHomNay ? 'bg-gold/[0.25] text-navy' : 'bg-white/70 text-navy'
            }`}
          >
            {x.nhan}
            <span className={`text-chu-thich font-bold ${!caTuan && x.d === chon ? 'text-white/70' : 'text-grey-mid'}`}>{x.ngay}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCaTuan((v) => !v)}
          aria-pressed={caTuan}
          className={`ml-auto min-h-[44px] shrink-0 cursor-pointer rounded-[8px] px-3 text-chu-thich font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
            caTuan ? 'bg-navy text-white' : 'border-[1.5px] border-navy/15 bg-white/70 text-navy'
          }`}
        >
          {nhan.caTuan}
        </button>
      </div>

      {caTuan ? (
        children
      ) : trong ? (
        <p className="glass rounded-[16px] px-4 py-6 text-center text-than font-semibold leading-relaxed text-grey-mid">{trong}</p>
      ) : (
        <div className="glass flex flex-col gap-1.5 rounded-[16px] p-2.5">
          {n?.tiet.map((tt) => {
            const co = tt.ten != null;
            const noiDung = co ? (
              <div className={`rounded-[8px] border-[1.5px] px-2.5 py-2 ${KIND[tt.kind] ?? KIND.regular} ${tt.ov?.status === 'cancelled' ? 'opacity-55' : ''}`}>
                <span className={`block text-noi-dung font-bold text-navy ${tt.ov?.status === 'cancelled' ? 'line-through' : ''}`}>{tt.ten}</span>
                {(tt.phong || tt.giaoVien) && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-chu-thich font-semibold text-grey-mid">
                    {tt.phong && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={12} strokeWidth={2.5} />
                        {tt.phong}
                      </span>
                    )}
                    {tt.giaoVien && (
                      <span className="inline-flex items-center gap-0.5">
                        <UserRound size={12} strokeWidth={2.5} />
                        {tt.giaoVien}
                      </span>
                    )}
                  </span>
                )}
                {tt.ov && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-navy/[0.10] px-1.5 py-0.5 text-chu-thich font-extrabold text-navy">
                    {tt.ov.status === 'cancelled' && nhan.ovCancelled}
                    {tt.ov.status === 'substituted' && `${nhan.ovSubstituted}: ${tt.ov.substitute_name}`}
                    {tt.ov.status === 'moved' && (
                      <>
                        <ArrowRight size={12} strokeWidth={2.5} />
                        {tt.ov.new_date?.slice(5)} · {nhan.tiet} {tt.ov.new_period_no}
                      </>
                    )}
                  </span>
                )}
              </div>
            ) : batDuoc ? (
              <span className="grid min-h-[44px] w-full place-items-center rounded-[8px] border-[1.5px] border-dashed border-navy/15 text-chu-thich font-bold text-navy/40">
                {nhan.them}
              </span>
            ) : (
              <span className="block min-h-[36px] rounded-[8px] bg-navy/[0.02]" />
            );
            return (
              <div key={tt.p} className="grid grid-cols-[44px_1fr] items-stretch gap-2">
                <div className="flex flex-col items-center justify-center rounded-[8px] bg-navy/[0.04] leading-tight">
                  <span className="text-than font-extrabold text-navy">{tt.p}</span>
                  {tt.gio && (
                    <span className="text-chu-thich font-bold tabular-nums text-grey-mid">
                      {tt.gio.tu}
                      <br />
                      {tt.gio.den}
                    </span>
                  )}
                </div>
                {batDuoc ? (
                  <NutTiet o={tt.o} title={`${nhan.tiet} ${tt.p}`} className="block w-full cursor-pointer text-left">
                    {noiDung}
                  </NutTiet>
                ) : (
                  noiDung
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
