'use client';

import {useRef} from 'react';
import {AlertCircle} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// NĂM Ô THÔNG TIN HỌC SINH — MỘT BẢN, HAI NƠI DÙNG.
// ════════════════════════════════════════════════════════════════════════════
//
// Form ghi danh và form sửa hỏi ĐÚNG một bộ trường, và cả hai cùng ghi vào một hàng
// student_details khoá theo email. Chép tay hai bản là hai cơ hội trôi khỏi nhau — thêm một
// trường ở bên này mà quên bên kia thì giáo viên điền được lúc ghi danh nhưng không sửa lại được,
// đúng kiểu hỏng chỉ lộ ra sau vài tuần.
//
// Trả về MỘT MẢNG THẺ ANH EM (fragment), không bọc thêm hộp nào: nơi gọi tự đặt lưới. Nhờ vậy
// form ghi danh giữ nguyên bố cục 3 cột như cũ, còn ô sửa hẹp thì xếp một cột — cùng một mã.

export type ThongTinHS = {
  full_name: string;
  student_code: string;
  dob_day: string;
  dob_month: string;
  dob_year: string;
  parent_phone: string;
  note: string;
};

export const THONG_TIN_RONG: ThongTinHS = {
  full_name: '',
  student_code: '',
  dob_day: '',
  dob_month: '',
  dob_year: '',
  parent_phone: '',
  note: '',
};

// Cắt một ngày ISO 'YYYY-MM-DD' thành ba ô. Dùng khi mở form sửa của em đã có ngày sinh.
export function baOTuIso(iso: string | null | undefined): Pick<ThongTinHS, 'dob_day' | 'dob_month' | 'dob_year'> {
  if (!iso) return {dob_day: '', dob_month: '', dob_year: ''};
  const [y, m, d] = iso.split('-');
  return {dob_day: d ?? '', dob_month: m ?? '', dob_year: y ?? ''};
}

const lbl = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-grey-mid';
// Tách phần KHÔNG có chiều rộng ra riêng: ba ô ngày sinh tự đặt chiều rộng, không được dính
// w-full (hai lớp width cùng độ ưu tiên thì thứ tự thắng thua phụ thuộc thứ tự trong file CSS).
const inpBase = 'rounded-[10px] border-[1.5px] bg-white py-2 text-sm font-semibold text-navy outline-none';
const inp = `w-full px-3 ${inpBase}`;
const inpDob = `px-2 ${inpBase}`;
const plain = 'border-navy/15 focus:border-navy';

export function OThongTinHocSinh({
  // Tiền tố id: hai form cùng nằm trên một trang thì id trùng là <label htmlFor> trỏ nhầm ô,
  // và người dùng bàn phím/trình đọc màn hình nhảy sang form kia.
  idTien,
  v,
  setV,
  loiNgaySinh,
  // Ô ghi chú chiếm hai cột ở lưới rộng của form ghi danh; ở panel sửa một cột thì vô hại.
  ghiChuRong = true,
}: {
  idTien: string;
  v: ThongTinHS;
  setV: (f: (p: ThongTinHS) => ThongTinHS) => void;
  loiNgaySinh?: string | null;
  ghiChuRong?: boolean;
}) {
  const set = (k: keyof ThongTinHS) => (e: {target: {value: string}}) =>
    setV((p) => ({...p, [k]: e.target.value}));

  // Ba ô ngày sinh: gõ đủ số thì tự nhảy sang ô kế — nhập 30 em một lượt không phải bấm chuột.
  const oThang = useRef<HTMLInputElement>(null);
  const oNam = useRef<HTMLInputElement>(null);

  // Chỉ nhận chữ số. Dán/gõ cả "25/11/2013" vào ô Ngày thì tự chia ra ba ô — dán từ danh sách
  // Excel là việc giáo viên làm nhiều nhất, không nên bắt họ tách tay.
  const onNgay = (e: {target: {value: string}}) => {
    const so = e.target.value.replace(/\D/g, '');
    if (so.length > 2) {
      setV((p) => ({...p, dob_day: so.slice(0, 2), dob_month: so.slice(2, 4), dob_year: so.slice(4, 8)}));
      oNam.current?.focus();
      return;
    }
    setV((p) => ({...p, dob_day: so}));
    if (so.length === 2) oThang.current?.focus();
  };
  const onThang = (e: {target: {value: string}}) => {
    const so = e.target.value.replace(/\D/g, '').slice(0, 2);
    setV((p) => ({...p, dob_month: so}));
    if (so.length === 2) oNam.current?.focus();
  };
  const onNam = (e: {target: {value: string}}) =>
    setV((p) => ({...p, dob_year: e.target.value.replace(/\D/g, '').slice(0, 4)}));

  const dobBorder = loiNgaySinh ? 'border-status-bad focus:border-status-bad' : plain;

  return (
    <>
      <div>
        <label className={lbl} htmlFor={`${idTien}-name`}>
          Họ và tên
        </label>
        <input
          id={`${idTien}-name`}
          name="full_name"
          value={v.full_name}
          onChange={set('full_name')}
          placeholder="Nguyễn Văn An"
          className={`${inp} ${plain}`}
        />
      </div>

      <div>
        <label className={lbl} htmlFor={`${idTien}-code`}>
          Mã học sinh
        </label>
        <input
          id={`${idTien}-code`}
          name="student_code"
          value={v.student_code}
          onChange={set('student_code')}
          placeholder="VA2026-0157"
          className={`${inp} ${plain}`}
        />
      </div>

      {/* Ngày sinh: BA ô rời, không dùng <input type="date"> — ô đó hiện thứ tự theo ngôn ngữ
          của trình duyệt (máy tiếng Anh ra mm/dd/yyyy), nên 09/03 dễ bị nhập thành mùng 3
          tháng 9. Ba ô có nhãn thì không nhầm được, ở bất kỳ máy nào. */}
      <div role="group" aria-labelledby={`${idTien}-dob-label`}>
        <span className={lbl} id={`${idTien}-dob-label`}>
          Ngày sinh
        </span>
        <div className="flex items-center gap-1.5">
          <input
            id={`${idTien}-dob-day`}
            name="dob_day"
            aria-label="Ngày sinh — ngày"
            aria-invalid={!!loiNgaySinh}
            inputMode="numeric"
            maxLength={2}
            placeholder="Ngày"
            value={v.dob_day}
            onChange={onNgay}
            className={`${inpDob} ${dobBorder} w-20 flex-none text-center`}
          />
          <span aria-hidden className="text-sm font-bold text-grey-soft">
            /
          </span>
          <input
            id={`${idTien}-dob-month`}
            name="dob_month"
            ref={oThang}
            aria-label="Ngày sinh — tháng"
            aria-invalid={!!loiNgaySinh}
            inputMode="numeric"
            maxLength={2}
            placeholder="Tháng"
            value={v.dob_month}
            onChange={onThang}
            className={`${inpDob} ${dobBorder} w-20 flex-none text-center`}
          />
          <span aria-hidden className="text-sm font-bold text-grey-soft">
            /
          </span>
          <input
            id={`${idTien}-dob-year`}
            name="dob_year"
            ref={oNam}
            aria-label="Ngày sinh — năm"
            aria-invalid={!!loiNgaySinh}
            inputMode="numeric"
            maxLength={4}
            placeholder="Năm"
            value={v.dob_year}
            onChange={onNam}
            className={`${inpDob} ${dobBorder} min-w-0 flex-1 text-center`}
          />
        </div>
        {loiNgaySinh && (
          <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-bold text-status-bad">
            <AlertCircle size={12} strokeWidth={2.5} />
            {loiNgaySinh}
          </p>
        )}
      </div>

      <div>
        <label className={lbl} htmlFor={`${idTien}-phone`}>
          SĐT phụ huynh
        </label>
        <input
          id={`${idTien}-phone`}
          name="parent_phone"
          type="tel"
          inputMode="tel"
          value={v.parent_phone}
          onChange={set('parent_phone')}
          placeholder="09xx xxx xxx"
          className={`${inp} ${plain}`}
        />
      </div>

      <div className={ghiChuRong ? 'lg:col-span-2' : undefined}>
        <label className={lbl} htmlFor={`${idTien}-note`}>
          Ghi chú
        </label>
        <input
          id={`${idTien}-note`}
          name="note"
          value={v.note}
          onChange={set('note')}
          placeholder="vd: dị ứng hải sản"
          className={`${inp} ${plain}`}
        />
      </div>
    </>
  );
}
