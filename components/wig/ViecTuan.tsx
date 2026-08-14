'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, AlertTriangle, CheckCircle2, Pencil, Plus, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, inputCls, btnGold, btnGhost} from '@/components/ui/Field';
import {WeekdayPicker} from '@/components/wig/WeekdayPicker';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {luuViec, deleteLeadMeasure} from '@/app/[locale]/(dashboard)/wig/actions';
import {nhipCuaMoc} from '@/lib/wig-nhip';
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
  // Cảnh báo tính ở server (cùng công thức với hàm SQL lead_measure_canh_bao).
  quaNhieu: boolean;
  lechDonVi: boolean;
  soTickCan: number;
  tran: number;
  soNgay: number;
  soNguoi: number;
};

export function ViecTuan({
  wigId,
  wigUnit,
  wigArea,
  viec,
  dayShort,
  weekParam,
  classParam,
  mocTarget,
  siSo,
}: {
  // Mục tiêu tuần mà những việc này thuộc về. Rỗng = tuần này chưa có mục tiêu nào → không thêm
  // việc được, và thẻ trống phải nói ra lý do thay vì chỉ biến mất.
  wigId: string | null;
  wigUnit: string;
  // Lĩnh vực của mục tiêu (đã dịch) — form dùng để NÓI RA rằng lĩnh vực lấy sẵn từ đây.
  wigArea: string;
  viec: ViecItem[];
  dayShort: string[];
  weekParam: string;
  classParam?: string;
  // Nhịp: mốc tuần cần bao nhiêu, lớp có mấy em (§6.1 bước 4 — cảnh báo phải hiện NGAY LÚC CÔ GÕ).
  mocTarget: number;
  siSo: number;
}) {
  const t = useTranslations('wig');
  // 'none' | 'them' | <id việc đang sửa>
  const [mo, setMo] = useState<string>('none');

  const thu = (w: number[] | null) =>
    (w ?? [1, 2, 3, 4, 5, 6, 7]).map((d) => dayShort[d - 1]).join(' · ');

  if (mo !== 'none') {
    const dangSua = viec.find((v) => v.id === mo);
    return (
      <ViecForm
        key={mo}
        wigId={wigId}
        wigUnit={wigUnit}
        wigArea={wigArea}
        viec={dangSua}
        dayShort={dayShort}
        mocTarget={mocTarget}
        siSo={siSo}
        khac={viec.filter((x) => x.id !== mo)}
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
          <div className="mt-1 text-[11.5px] font-semibold leading-relaxed text-grey-mid">
            {v.target_value} {v.unit ?? ''} · {thu(v.active_weekdays)}
            <br />
            {t('perTickShort', {n: Number(v.unit_per_tick ?? 1), unit: wigUnit})}
          </div>

          {/* Cảnh báo, KHÔNG phải rào chắn: giáo viên vẫn lưu được, chỉ là từ nay họ nhìn thấy. */}
          {v.quaNhieu && (
            <p className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-status-bad">
              <AlertTriangle size={12} strokeWidth={2.5} className="mt-px shrink-0" />
              {t('warnTooMany', {can: v.soTickCan, co: v.tran, ngay: v.soNgay, nguoi: v.soNguoi})}
            </p>
          )}
          {v.lechDonVi && (
            <p className="mt-2 flex items-start gap-1.5 rounded-[10px] bg-gold/20 px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-gold-text">
              <AlertTriangle size={12} strokeWidth={2.5} className="mt-px shrink-0" />
              {t('warnUnitMismatch', {lead: v.unit ?? '', wig: wigUnit})}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setMo(v.id)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy"
            >
              <Pencil size={11} strokeWidth={2.5} />
              {t('edit')}
            </button>
            <form action={deleteLeadMeasure} className="contents">
              {classParam && <input type="hidden" name="class_id" value={classParam} />}
              <input type="hidden" name="lead_measure_id" value={v.id} />
              <input type="hidden" name="week" value={weekParam} />
              <ConfirmButton
                message={t('confirmDeleteLead')}
                label={t('deleteLead')}
                className="inline-flex cursor-pointer items-center gap-1 rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.06] px-2.5 py-1.5 text-[11.5px] font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.14]"
              >
                <Trash2 size={11} strokeWidth={2.5} />
                {t('delete')}
              </ConfirmButton>
            </form>
          </div>
        </div>
      ))}

      {wigId ? (
        <button
          type="button"
          onClick={() => setMo('them')}
          className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-navy/25 bg-transparent p-3 text-[12.5px] font-extrabold text-navy/60 transition-all hover:border-navy/50 hover:bg-navy/[0.03] hover:text-navy"
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
  wigId,
  wigUnit,
  wigArea,
  viec,
  dayShort,
  mocTarget,
  siSo,
  khac,
  onDong,
}: {
  wigId: string | null;
  wigUnit: string;
  wigArea: string;
  viec?: ViecItem;
  dayShort: string[];
  mocTarget: number;
  siSo: number;
  // Những việc KHÁC đang treo dưới cùng mốc tuần. Nhịp là phép cộng của cả nhóm: sửa một việc mà
  // chỉ nhìn riêng nó thì con số hụt luôn sai.
  khac: ViecItem[];
  onDong: () => void;
}) {
  const t = useTranslations('wig');
  const tm = useTranslations('meeting');
  const [state, formAction] = useActionState(luuViec, {ok: false});

  // CẢNH BÁO LỆCH NHỊP, SỐNG THEO TỪNG PHÍM (§6.1 bước 4). Trước đây câu này chỉ có ở phòng họp —
  // tức là hiện ra ở chỗ cô KHÔNG gõ mục tiêu của việc, và im ở chỗ cô gõ. Cùng một hàm với
  // PhongHop (lib/wig-nhip) nên hai màn không bao giờ nói hai con số khác nhau.
  const [oTarget, setOTarget] = useState(String(viec?.target_value ?? ''));
  const [oUpt, setOUpt] = useState(String(Number(viec?.unit_per_tick ?? 1)));
  // CHỖ THỨ BA của cùng một lỗi trong một ngày: step="1" chặn "6,7 điểm" và trình duyệt từ chối
  // bằng câu tiếng Anh của chính nó, giữa một biểu mẫu tiếng Việt. Đã sửa ở form mục tiêu của
  // lớp (TaoWigMenu) sáng nay; ô mục tiêu của VIỆC thì nằm ở tệp này và bị sót.
  // Đơn vị đo lại cũng không cần hỏi "mỗi lần tick đáng bao nhiêu": số em gõ chính là con số.
  const [oDonVi, setODonVi] = useState(viec?.unit ?? '');
  const soLe = kieuDonVi(oDonVi) === 'do';
  const {mocCan, tongViecCho, thieuNhip} = nhipCuaMoc({
    mocCan: mocTarget,
    siSo,
    viec: [
      ...khac.map((k) => ({target: k.target_value, upt: Number(k.unit_per_tick ?? 1) || 1})),
      {target: Number(oTarget) || 0, upt: Number(oUpt) || 1},
    ],
  });

  // Lưu xong thì đóng lại — trang đã được revalidate nên thẻ vừa sửa hiện ra ngay bên dưới.
  useEffect(() => {
    if (state.ok) onDong();
  }, [state.ok, onDong]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-gold/60 bg-white p-3.5">
      <h2 className="font-display text-[13.5px] font-bold text-navy">
        {viec ? t('editWork') : t('addWork')}
      </h2>
      {viec ? (
        <input type="hidden" name="lead_measure_id" value={viec.id} />
      ) : (
        <input type="hidden" name="wig_id" value={wigId ?? ''} />
      )}

      <Field label={t('leadTitle')} htmlFor="viec-title" error={err('title')} hint={t('leadHint')}>
        <input
          id="viec-title"
          name="title"
          defaultValue={viec?.title ?? ''}
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
        {/* LĨNH VỰC KHÔNG PHẢI ĐIỀN — Ô NÀY LÀ NHÓM NHỎ BÊN TRONG NÓ.
            Nhãn cũ đóng cứng chữ "Nhóm (Kỹ năng)" ở mọi lĩnh vực: mục tiêu thuộc Kiến thức mà ô
            vẫn ghi "Kỹ năng", nên đọc thành "khai lại lĩnh vực đi, và lĩnh vực là Kỹ năng". Chủ
            dự án hỏi đúng: "nhóm kĩ năng thì nó phải lấy từ thằng wig trên luôn chứ".
            Nó LẤY SẴN RỒI — bảng điểm ghép category = wig.area (hàm class_scoreboard, 0028), ô này
            chỉ để tách nhỏ thêm (5 Giá trị / 7 Thói quen / DEAR). Nay nhãn nói ra đúng lĩnh vực
            của mục tiêu và nói rõ là không bắt buộc. */}
        <Field
          label={t('subCat', {area: wigArea})}
          hint={t('subCatHint', {area: wigArea})}
          htmlFor="viec-sub"
          className="col-span-2 sm:col-span-1"
        >
          <input id="viec-sub" name="sub_category" defaultValue={viec?.sub_category ?? ''} className={inputCls} />
        </Field>
      </div>

      {/* `required` để trình duyệt chặn ngay tại chỗ nếu ô bị xoá trắng: hệ số KHÔNG đóng băng vào
          từng lượt tick mà được nhân lúc đọc, nên ghi đè 30 thành 1 là chia cả lịch sử tick cho
          30 — một mục tiêu đang "30/30 đã đạt" tụt về "1/30" chỉ vì ai đó mở ra sửa cái tên. */}
      {/* ĐƠN VỊ ĐO LẠI KHÔNG CÓ "MỖI LẦN TICK ĐÁNG BAO NHIÊU". Với điểm/kg/cm thì em gõ thẳng
          con số của mình, không có lượt nào để quy đổi — hỏi câu ấy là mời người ta điền một hệ
          số rồi máy chủ lặng lẽ bỏ qua (server ép về 1). Thay bằng một câu nói rõ chuyện gì sẽ
          xảy ra trên màn của em. */}
      {soLe ? (
        <p className="rounded-[10px] bg-navy/[0.05] px-3 py-2 text-[12px] font-semibold leading-relaxed text-grey-mid">
          {t('doNhapSoHint', {unit: oDonVi || wigUnit})}
        </p>
      ) : (
      <Field label={t('unitPerTick')} hint={t('unitPerTickHint', {unit: wigUnit})} htmlFor="viec-upt" className="sm:max-w-[300px]">
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

      <WeekdayPicker
        label={t('weekdays')}
        hint={t('weekdaysHint')}
        dayLabels={dayShort}
        selected={viec?.active_weekdays ?? undefined}
      />

      {/* Cảnh báo, KHÔNG phải rào chắn — cô vẫn lưu được. */}
      {thieuNhip > 0 && (
        <p className="flex items-start gap-1.5 rounded-[10px] bg-gold/20 px-2.5 py-2 text-[11.5px] font-semibold leading-relaxed text-gold-text">
          <AlertTriangle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {tm('paceWarn', {can: mocCan, cho: tongViecCho, thieu: thieuNhip})}
        </p>
      )}

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
