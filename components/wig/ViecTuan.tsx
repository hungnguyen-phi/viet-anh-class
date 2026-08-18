'use client';

import {TickCuaLop} from '@/components/wig/TickCuaLop';
import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, AlertTriangle, CheckCircle2, Plus} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, inputCls, btnGold, btnGhost} from '@/components/ui/Field';
import {WeekdayPicker} from '@/components/wig/WeekdayPicker';
import {luuViec} from '@/app/[locale]/(dashboard)/wig/actions';
import {kieuDonVi} from '@/lib/don-vi';

// ════════════════════════════════════════════════════════════════════════════
// VIỆC ĐỂ CÁC EM TICK — mỗi việc một thẻ, sửa/xoá ngay tại thẻ.
// ════════════════════════════════════════════════════════════════════════════
//
// Trước đây danh sách này là mấy dòng <li> gạch chân, còn form thêm việc thì nằm SẴN bên dưới
// mỗi mục tiêu tuần với đủ 6 ô trống. Muốn sửa một việc thì bấm "Sửa" → cả trang tải lại → một
// panel hiện ở TẬN ĐẦU TRANG, cách chỗ vừa bấm mấy màn hình cuộn. Sửa xong lại tải lại lần nữa.
//
// Nay: thẻ đọc được trong một liếc (tên · mục tiêu · những thứ được tick · một lượt đáng bao
// nhiêu), và bấm Sửa là form mở ra ĐÚNG CHỖ ẤY, lưu xong đóng lại, không chuyển trang lần nào.
// Gõ hỏng một ô cũng không mất năm ô kia (xem luuViec trong actions.ts).

export type ViecItem = {
  id: string;
  title: string;
  target_value: number;
  unit: string | null;
  sub_category: string | null;
  active_weekdays: number[] | null;
  unit_per_tick: number | null;
  // 0114 — việc này để em TỰ ĐIỀN SỐ mỗi ngày thay vì một chạm.
  nhap_luong: boolean | null;
  // Cảnh báo tính ở server (cùng công thức với hàm SQL lead_measure_canh_bao).
  quaNhieu: boolean;
  soTickCan: number;
  tran: number;
  soNgay: number;
  soNguoi: number;
  /** Ngày trong tuần đang xem mà việc này áp dụng — để cô tick ngay tại chỗ (16/08/2026). */
  ngayTrongTuan: string[];
  /** Ngày lớp đã có lượt tick (dòng không gắn với em nào). */
  ngayDaTick: string[];
};

export function ViecTuan({
  commitmentId,
  wigUnit,
  homNay,
  moKhoa,
  wigArea,
  viec,
  dayShort,
}: {
  // Mục tiêu tuần mà những việc này thuộc về. Rỗng = tuần này chưa có mục tiêu nào → không thêm
  // việc được, và thẻ trống phải nói ra lý do thay vì chỉ biến mất.
  /** Cam kết mà việc này treo dưới (0121). null = chưa có cam kết nào cho tuần. */
  commitmentId: string | null;
  wigUnit: string;
  /** Hôm nay theo giờ VN — cô không tick trước ngày (16/08/2026). */
  homNay: string;
  /** Tuần chưa chốt thì còn tick được. */
  moKhoa: boolean;
  // Lĩnh vực của mục tiêu (đã dịch) — form dùng để NÓI RA rằng lĩnh vực lấy sẵn từ đây.
  wigArea: string;
  viec: ViecItem[];
  dayShort: string[];
}) {
  const t = useTranslations('wig');
  // 'none' | 'them'. Không còn nhánh "đang sửa việc nào": việc dẫn dắt khoá ngay khi thêm (0129).
  const [mo, setMo] = useState<'none' | 'them'>('none');

  // (Hàm `thu` đã gỡ cùng dòng chữ liệt kê thứ: hàng ô ngày nói việc ấy bằng hình.)

  if (mo === 'them') {
    return (
      <ViecForm
        commitmentId={commitmentId}
        wigUnit={wigUnit}
        wigArea={wigArea}
        dayShort={dayShort}
        onDong={() => setMo('none')}
      />
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {viec.map((v) => (
        <div
          key={v.id}
          className="flex flex-col rounded-[14px] border-[1.5px] border-navy/10 bg-white/60 p-3"
        >
          <div className="text-[13.5px] font-extrabold leading-snug text-navy">{v.title}</div>

          {/* CÔ TICK NGAY TẠI ĐÂY (16/08/2026). Việc chung là phần của cô — em không thấy nó nữa,
              nên nếu chỗ này không có ô bấm thì con số của lớp đứng im mãi mãi. */}
          <TickCuaLop
            leadId={v.id}
            days={v.ngayTrongTuan}
            daTick={v.ngayDaTick}
            today={homNay}
            moKhoa={moKhoa}
            dayShort={dayShort}
          />
          {/* Dòng "5 lần · T2 · T3 · T4 · T5 · T6" và "mỗi lần 1" đã bỏ (16/08/2026, chủ dự án
              chỉ định). Hàng ô ngày ngay trên đã nói cả hai điều ấy bằng hình: có mấy ô là mấy
              ngày, ô nào sáng là ngày nào. Viết lại bằng chữ là kể lại thứ mắt vừa thấy. */}

          {/* Cảnh báo, KHÔNG phải rào chắn: giáo viên vẫn lưu được, chỉ là từ nay họ nhìn thấy. */}
          {v.quaNhieu && (
            <p className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-status-bad">
              <AlertTriangle size={12} strokeWidth={2.5} className="mt-px shrink-0" />
              {t('warnTooMany', {can: v.soTickCan, co: v.tran, ngay: v.soNgay, nguoi: v.soNguoi})}
            </p>
          )}

          {/* HAI NÚT SỬA/XOÁ ĐÃ BỎ (0129).
              "Lead measure của commitment đó không được xoá, sửa, nhưng có thể thêm" — vòng
              comment PRD v3, chủ dự án chốt tiếp 15/08/2026: khoá NGAY KHI VỪA THÊM.

              Vì sao đáng khoá chặt: đây là thứ các em tick vào mỗi ngày. Đổi tên hay đổi chỉ tiêu
              giữa tuần là đổi luật giữa trận — mọi lượt tick đã ghi bỗng nói về một việc khác.
              Gõ nhầm thì xoá cả CAM KẾT rồi đặt lại; đó là đường thoát, và nó không mập mờ.

              RLS mới là thứ chặn thật (chỉ quản trị viên còn sửa/xoá được); bỏ hai nút ở đây là
              để đừng bày ra cái bấm vào sẽ báo lỗi. */}
        </div>
      ))}

      {commitmentId ? (
        <button
          type="button"
          onClick={() => setMo('them')}
          className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-navy/25 bg-transparent p-3 text-[12.5px] font-extrabold text-grey-mid transition-all hover:border-navy/50 hover:bg-navy/[0.03] hover:text-navy"
        >
          <Plus size={16} strokeWidth={2.5} />
          {t('addWork')}
        </button>
      ) : (
        <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-3 text-[11.5px] font-semibold italic leading-relaxed text-grey-mid sm:col-span-2">
          {t('addWorkNeedsWig')}
        </p>
      )}
    </div>
  );
}

// Form thêm/sửa một việc. Tách riêng để mỗi lần mở là một thể hiện mới — state của
// useActionState nhờ vậy sạch, không mang câu báo lỗi của lần mở trước sang lần này.
function ViecForm({
  commitmentId,
  wigUnit,
  wigArea,
  dayShort,
  onDong,
}: {
  /** Cam kết mà việc này treo dưới (0121). null = chưa có cam kết nào cho tuần. */
  commitmentId: string | null;
  wigUnit: string;
  wigArea: string;
  dayShort: string[];
  // Những việc KHÁC đang treo dưới cùng mốc tuần. Nhịp là phép cộng của cả nhóm: sửa một việc mà
  // chỉ nhìn riêng nó thì con số hụt luôn sai.
  onDong: () => void;
}) {
  const t = useTranslations('wig');
  const [state, formAction] = useActionState(luuViec, {ok: false});

  // CẢNH BÁO LỆCH NHỊP, SỐNG THEO TỪNG PHÍM (§6.1 bước 4). Trước đây câu này chỉ có ở phòng họp —
  // tức là hiện ra ở chỗ cô KHÔNG gõ mục tiêu của việc, và im ở chỗ cô gõ. Cùng một hàm với
  // PhongHop (lib/wig-nhip) nên hai màn không bao giờ nói hai con số khác nhau.
  const [oTarget, setOTarget] = useState('');
  const [oUpt, setOUpt] = useState('1');
  // CHỖ THỨ BA của cùng một lỗi trong một ngày: step="1" chặn "6,7 điểm" và trình duyệt từ chối
  // bằng câu tiếng Anh của chính nó, giữa một biểu mẫu tiếng Việt. Đã sửa ở form mục tiêu của
  // lớp (TaoWigMenu) sáng nay; ô mục tiêu của VIỆC thì nằm ở tệp này và bị sót.
  // Đơn vị đo lại cũng không cần hỏi "mỗi lần tick đáng bao nhiêu": số em gõ chính là con số.
  const [oDonVi, setODonVi] = useState('');
  const soLe = kieuDonVi(oDonVi) === 'do';
  // MỖI LẦN MỘT KHÁC — các em tự điền số mỗi ngày, thay vì một chạm nhân hệ số.
  //
  // Việc của EM đã có lựa chọn này từ 0110; việc CHUNG của lớp thì chưa, nên "đọc sách" của cả
  // lớp chỉ ghi được "một buổi = 30 trang" cố định — hôm nay 12 trang mai 40 trang thì không có
  // chỗ ghi. Đơn vị đo lại (điểm, kg) LUÔN ở chế độ này, không hỏi.
  const [moiLanKhac, setMoiLanKhac] = useState(false);
  const nhapSo = moiLanKhac;
  // GỢI Ý NHỊP ĐÃ BỎ (0121). Nó so "mốc tuần cần bao nhiêu" với "việc đang giao cho được bao
  // nhiêu" — mà mốc tuần không còn tồn tại: mỗi tuần nay là một CAM KẾT, và cam kết là lời hứa
  // chứ không mang con số đích của riêng nó. Giữ lại thì nó sẽ so với một số 0 vĩnh viễn.

  // Lưu xong thì đóng lại — trang đã được revalidate nên thẻ vừa sửa hiện ra ngay bên dưới.
  useEffect(() => {
    if (state.ok) onDong();
  }, [state.ok, onDong]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-gold/60 bg-white p-3.5">
      <h2 className="font-display text-[13.5px] font-bold text-navy">
        {t('addWork')}
      </h2>
      <input type="hidden" name="commitment_id" value={commitmentId ?? ''} />

      <Field label={t('leadTitle')} htmlFor="viec-title" error={err('title')}>
        <input
          id="viec-title"
          name="title"
          aria-invalid={state.fieldError === 'title'}
          className={ctlWithBorder(state.fieldError === 'title')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={t('target')} htmlFor="viec-target" error={err('target_value')}>
          <input
            id="viec-target"
            name="target_value"
            type="number"
            step={soLe ? 'any' : '1'}
            min={soLe ? '0.01' : '1'}
            inputMode={soLe ? 'decimal' : 'numeric'}
            value={oTarget}
            onChange={(e) => setOTarget(e.target.value)}
            aria-invalid={state.fieldError === 'target_value'}
            className={ctlWithBorder(state.fieldError === 'target_value')}
          />
        </Field>
        <Field label={t('unit')} htmlFor="viec-unit">
          <input
            id="viec-unit"
            name="unit"
            value={oDonVi}
            onChange={(e) => setODonVi(e.target.value)}
            placeholder={t('unitPlaceholder')}
            className={inputCls}
          />
        </Field>
        {/* Ô "nhóm nhỏ trong lĩnh vực" (sub_category) đã bỏ 17/08/2026: bảng điểm 4 hạng mục đã bỏ từ 11/08,
            ô này chỉ còn là một câu giảng giải. Cột giữ nguyên ở CSDL, không ghi nữa. */}
      </div>

      {/* `required` để trình duyệt chặn ngay tại chỗ nếu ô bị xoá trắng: hệ số KHÔNG đóng băng vào
          từng lượt tick mà được nhân lúc đọc, nên ghi đè 30 thành 1 là chia cả lịch sử tick cho
          30 — một mục tiêu đang "30/30 đã đạt" tụt về "1/30" chỉ vì ai đó mở ra sửa cái tên. */}
      {/* ĐƠN VỊ ĐO LẠI KHÔNG CÓ "MỖI LẦN TICK ĐÁNG BAO NHIÊU". Với điểm/kg/cm thì em gõ thẳng
          con số của mình, không có lượt nào để quy đổi — hỏi câu ấy là mời người ta điền một hệ
          số rồi máy chủ lặng lẽ bỏ qua (server ép về 1). Thay bằng một câu nói rõ chuyện gì sẽ
          xảy ra trên màn của em. */}
      <input type="hidden" name="nhap_luong" value={nhapSo ? '1' : ''} />
      <>
      {/* Ô TÍCH, không phải hai chế độ tách rời: mặc định vẫn là một chạm — thứ nhanh nhất và
          đúng với phần lớn việc — còn đây là lối ra cho việc mà mỗi ngày một lượng khác nhau. */}
      <label className="flex cursor-pointer items-start gap-2 rounded-[10px] bg-navy/[0.04] px-3 py-2.5">
        <input
          type="checkbox"
          checked={moiLanKhac}
          onChange={(e) => setMoiLanKhac(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--color-navy)]"
        />
        <span className="text-[12.5px] font-bold leading-relaxed text-navy">
          {t('eachTimeVaries')}
        </span>
      </label>
      {!moiLanKhac && (
      <Field label={t('unitPerTick')} htmlFor="viec-upt" className="sm:max-w-[300px]">
        <input
          id="viec-upt"
          name="unit_per_tick"
          type="number"
          step="any"
          min="0.01"
          inputMode="decimal"
          required
          value={oUpt}
          onChange={(e) => setOUpt(e.target.value)}
          className={inputCls}
        />
      </Field>
      )}
      </>

      <WeekdayPicker
        label={t('weekdays')}
        dayLabels={dayShort}
      />

      {state.error && !state.fieldError && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12.5px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p className="inline-flex items-start gap-1.5 text-[12.5px] font-bold text-success-dark">
          <CheckCircle2 size={14} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDong} className={btnGhost}>
          {t('cancel')}
        </button>
        <SubmitButton className={btnGold} wrapClass="contents">
          {t('save')}
        </SubmitButton>
      </div>
    </form>
  );
}
