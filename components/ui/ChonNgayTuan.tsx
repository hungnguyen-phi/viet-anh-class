'use client';

// BỘ CHIP CHỌN NGÀY TRONG TUẦN (T2…CN) — checkbox ẩn, gửi lên server qua name="ngay" value=1…7
// (quy ước isodow của thuoc.ngay_ap_dung: 1=Thứ Hai … 7=Chủ nhật). Cùng mẫu với SuaViecEm.
const NGAY: {v: number; nhan: string}[] = [
  {v: 1, nhan: 'T2'},
  {v: 2, nhan: 'T3'},
  {v: 3, nhan: 'T4'},
  {v: 4, nhan: 'T5'},
  {v: 5, nhan: 'T6'},
  {v: 6, nhan: 'T7'},
  {v: 7, nhan: 'CN'},
];

export function ChonNgayTuan({daChon = [1, 2, 3, 4, 5]}: {daChon?: number[]}) {
  return (
    <div className="flex flex-wrap gap-1">
      {NGAY.map((n) => (
        <label
          key={n.v}
          className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-1 rounded-[8px] border-[1.5px] border-navy/15 px-2 text-chu-thich font-bold text-navy has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white"
        >
          <input type="checkbox" name="ngay" value={n.v} defaultChecked={daChon.includes(n.v)} className="sr-only" />
          {n.nhan}
        </label>
      ))}
    </div>
  );
}
