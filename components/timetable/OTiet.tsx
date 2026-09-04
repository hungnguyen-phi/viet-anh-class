'use client';

import {createContext, useActionState, useContext, useEffect, useState, type ReactNode} from 'react';
import {AlertCircle} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, inputCls, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {luuOTiet} from '@/app/[locale]/(dashboard)/timetable/actions';

// SỬA MỘT Ô THỜI KHOÁ BIỂU NGAY TẠI Ô ĐÓ.
//
// Trước đây lưới chỉ để nhìn: muốn thêm một tiết thì kéo xuống cuối trang, mở một khung nhập rời,
// rồi tự chọn lại thứ và tiết trong hai ô xổ — tức là khai lại bằng lời cái toạ độ mà mắt vừa
// nhìn thấy. Sáu ngày × tám tiết là 48 lần khai như vậy khi xếp lịch đầu năm, và chọn nhầm một ô
// thì ghi đè nhầm một tiết. Chủ dự án yêu cầu đúng chỗ này: bấm dấu + ngay trong ô, có rồi thì
// bấm vào ô để sửa.
//
// Thứ và tiết nay ĐI THEO Ô ĐƯỢC BẤM (hai trường ẩn), không còn ô xổ nào để chọn sai.
//
// Nhãn truyền vào bằng props, KHÔNG gọi useTranslations: thêm một namespace vào bundle trình
// duyệt cho vài chữ là cái giá không đáng (xem NAMESPACE_CHO_CLIENT ở app/[locale]/layout.tsx —
// OverrideForm cùng thư mục này cũng theo lối ấy).

export type MonChon = {id: string; name: string};

export type ODangSua = {
  day: number;
  period: number;
  /** "T2 · Tiết 3" — dựng sẵn ở máy chủ để tiêu đề hộp thoại nói đúng ô nào đang mở. */
  nhanO: string;
  /** null = ô trống, đang THÊM. */
  slot: {subjectId: string | null; room: string | null; teacher: string | null; kind: string} | null;
};

export type NhanTiet = {
  them: string;
  sua: string;
  mon: string;
  phong: string;
  giaoVien: string;
  loaiTiet: string;
  luu: string;
  huy: string;
  loai: {value: string; label: string}[];
  /** "Áp dụng thêm cho" + danh sách thứ (2..8, nhãn T2..CN) — lưu một lần cho nhiều ngày. */
  apDung: string;
  cacThu: {value: number; label: string}[];
};

const Ctx = createContext<((o: ODangSua) => void) | null>(null);

export function TietProvider({
  classId,
  monHoc,
  nhan,
  batDuoc,
  children,
}: {
  classId: string;
  monHoc: MonChon[];
  nhan: NhanTiet;
  /** Người xem có sửa được lưới không (và lớp đã khai môn chưa). Không thì lưới chỉ để đọc. */
  batDuoc: boolean;
  children: ReactNode;
}) {
  const [o, setO] = useState<ODangSua | null>(null);
  // Không bọc context khi không sửa được → NutTiet bên trong tự hiện ra dạng chữ thường, không
  // dựng nút. Học sinh và phụ huynh không bấm phải một ô rồi chờ một hộp thoại không bao giờ mở.
  if (!batDuoc) return <>{children}</>;
  return (
    <Ctx.Provider value={setO}>
      {children}
      {o && (
        <HopTiet classId={classId} monHoc={monHoc} nhan={nhan} o={o} dong={() => setO(null)} />
      )}
    </Ctx.Provider>
  );
}

// Vỏ bấm được của một ô. Không có provider bọc ngoài (người xem không sửa được) thì chỉ hiện
// nội dung, không dựng nút — để không mời người ta bấm vào một thứ không mở ra gì.
export function NutTiet({
  o,
  className,
  title,
  children,
}: {
  o: ODangSua;
  className: string;
  title: string;
  children: ReactNode;
}) {
  const mo = useContext(Ctx);
  if (!mo) return <>{children}</>;
  return (
    <button type="button" onClick={() => mo(o)} title={title} className={className}>
      {children}
    </button>
  );
}

function HopTiet({
  classId,
  monHoc,
  nhan,
  o,
  dong,
}: {
  classId: string;
  monHoc: MonChon[];
  nhan: NhanTiet;
  o: ODangSua;
  dong: () => void;
}) {
  const [state, formAction] = useActionState(luuOTiet, {ok: false});

  // Lưu xong thì đóng. Máy chủ đã revalidate nên lưới bên dưới đã là lưới mới lúc hộp biến mất.
  useEffect(() => {
    if (state.ok) dong();
  }, [state.ok, dong]);

  return (
    <Popup title={`${o.slot ? nhan.sua : nhan.them} · ${o.nhanO}`} onClose={dong}>
      <form action={formAction} className="flex flex-col gap-2.5">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="day_of_week" value={o.day} />
        <input type="hidden" name="period_no" value={o.period} />

        <Field label={nhan.mon} htmlFor="o-mon">
          {/* Bắt buộc chọn: bỏ trống thì trình duyệt chặn ngay tại chỗ, không phải chờ máy chủ. */}
          <select
            id="o-mon"
            name="subject_id"
            required
            autoFocus
            defaultValue={o.slot?.subjectId ?? ''}
            className={selectCls}
          >
            <option value="">— {nhan.mon} —</option>
            {monHoc.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field label={nhan.phong} htmlFor="o-phong">
            <input id="o-phong" name="room" defaultValue={o.slot?.room ?? ''} className={inputCls} />
          </Field>
          <Field label={nhan.giaoVien} htmlFor="o-gv">
            <input
              id="o-gv"
              name="teacher_name"
              defaultValue={o.slot?.teacher ?? ''}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label={nhan.loaiTiet} htmlFor="o-loai">
          <select id="o-loai" name="kind" defaultValue={o.slot?.kind ?? 'regular'} className={selectCls}>
            {nhan.loai.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        {/* ÁP CHO NHIỀU THỨ MỘT LẦN (18/08/2026): môn chính khoá lặp 2–3 buổi/tuần — tick thêm
            các thứ ở đây là một lần Lưu ghi cả dãy CÙNG TIẾT này. Ô gốc không cần tick, nó luôn
            được lưu. Chỉ hiện khi THÊM MỚI: đường sửa mà áp hàng loạt thì một cú ghi đè nhầm
            lan ra cả tuần. */}
        {!o.slot && (
          <fieldset className="rounded-[12px] border-[1.5px] border-navy/10 p-2.5">
            <legend className="px-1 text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">
              {nhan.apDung}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {nhan.cacThu
                .filter((d) => d.value !== o.day)
                .map((d) => (
                  <label key={d.value} className="cursor-pointer">
                    <input type="checkbox" name="ap_thu" value={d.value} className="peer sr-only" />
                    <span className="grid h-11 w-11 select-none place-items-center rounded-[10px] border-[1.5px] border-navy/15 bg-white text-[11.5px] font-extrabold text-grey-mid transition-all hover:border-navy peer-checked:border-transparent peer-checked:bg-gold peer-checked:text-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40">
                      {d.label}
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
        )}

        {state.error && (
          <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12.5px] font-bold text-status-bad">
            <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={dong} className={btnGhost}>
            {nhan.huy}
          </button>
          <SubmitButton className={btnGold} wrapClass="contents">
            {nhan.luu}
          </SubmitButton>
        </div>
      </form>
    </Popup>
  );
}
