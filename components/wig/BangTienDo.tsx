'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Check, Pencil, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {suaWig, deleteWig} from '@/app/[locale]/(dashboard)/wig/actions';
import {OSoDo} from '@/components/student/OSoDo';
import {kieuDonVi} from '@/lib/don-vi';

// ════════════════════════════════════════════════════════════════════════════
// LỚP ĐANG ĐI TỚI ĐÂU — năm, tháng, tuần, mỗi cấp một thanh.
// ════════════════════════════════════════════════════════════════════════════
//
// Chủ dự án xin đúng thứ này: "tại cột bên phải mỗi wig sẽ hiện luôn thanh tiến độ 1 năm thì
// được bao nhiêu / mục tiêu, tháng thì bao nhiêu / mục tiêu".
//
// Trước đây tiến độ năm nằm ở đầu một khung dài, tiến độ tháng nằm lồng bên trong khung đó, tiến
// độ tuần lồng thêm một tầng nữa — ba con số cùng trả lời một câu hỏi mà phải cuộn qua ba tầng
// khung mới đọc hết. Xếp thẳng ba dòng cạnh nhau thì thấy ngay chỗ đứt: năm đang 27% mà tháng
// chưa đặt mục tiêu nào.
//
// CẤP NÀO CHƯA CÓ THÌ VẪN CHIẾM MỘT DÒNG, ghi "chưa đặt mục tiêu tháng". Ẩn đi thì cái thiếu trở
// nên vô hình — mà cái thiếu mới đúng là thứ cần làm tiếp.

export type DongTienDo = {
  id: string | null; // null = cấp này chưa có mục tiêu nào
  cap: 'year' | 'month' | 'week';
  title: string;
  periodLabel: string | null;
  // Ngày bắt đầu/kết thúc thật của kỳ — nhãn (VD "W33-2026") không tự nói ra ngày, người đọc phải
  // tự quy đổi trong đầu. null khi cấp này chưa có mục tiêu.
  startDate: string | null;
  endDate: string | null;
  baseline: number | null;
  target: number;
  unit: string;
  actual: number;
  pct: number;
  status: string | null;
  // Lĩnh vực hiện tại — chỉ form sửa của cấp NĂM dùng (tháng/tuần thừa hưởng từ cha).
  area: string | null;
  // ĐO BẰNG GÌ. 'manual' = con số nằm ngoài app (điểm trung bình, kết quả thi): app không đếm
  // được, nên KHÔNG vẽ vạch — vạch ấy là app nói dối. Chỉ có Đạt / Chưa đạt theo achievedAt.
  // 'cuon'   = số của nó là kết quả ĐẾM NGƯỢC từ mục tiêu năm của từng bạn (hoặc từng lớp).
  measureBy: 'tick' | 'manual' | 'cuon';
  // Chỉ có khi measureBy = 'cuon'. `tongDich` không tham gia phép tính, chỉ để câu chữ trên màn
  // hình giống câu cô đã viết ("6/8 môn").
  cuon: {tong: number; dat: number; tyLe: number; can: number; soDichCan: number; tongDich: number | null} | null;
  achievedAt: string | null;
};

const MAU: Record<string, string> = {
  on_track: 'var(--color-success)',
  mid: 'var(--color-warn)',
  off_track: 'var(--color-status-bad)',
};

export function BangTienDo({
  nhom,
  weekParam,
  classParam,
  areaOptions,
}: {
  // Một nhóm = một mục tiêu NĂM và cả chuỗi tháng → tuần của nó trong tuần đang xem.
  nhom: {
    areaLabel: string;
    areaHex: string;
    areaSoft: string;
    dong: DongTienDo[];
    // Số đo tuần này của mục tiêu đo lại (kg, điểm, cm) — 14/08/2026. Loại này không tick hằng
    // ngày; con số được điền lại MỖI TUẦN, đúng nhịp buổi họp.
    soDo?: {giaTri: number; vaiTro: string; ghiLuc: string} | null;
    soDoMoKhoa?: boolean;
  }[];
  weekParam: string;
  classParam?: string;
  // Bốn lĩnh vực (kiến thức/kĩ năng/tiếng Anh/thể chất) — cho ô đổi lĩnh vực trong form sửa.
  areaOptions: {value: string; label: string}[];
}) {
  const t = useTranslations('wig');
  const [sua, setSua] = useState<string>('');

  if (nhom.length === 0) {
    return (
      <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-4 text-center text-[12.5px] font-semibold italic leading-relaxed text-grey-mid">
        {t('noWigs')}
      </p>
    );
  }

  const tenCap = (c: DongTienDo['cap']) =>
    c === 'year' ? t('year') : c === 'month' ? t('month') : t('week');
  const dm = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;

  return (
    <div className="flex flex-col gap-4">
      {nhom.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-2.5">
          <span
            className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
            style={{background: g.areaSoft, color: g.areaHex}}
          >
            {g.areaLabel}
          </span>

          {g.dong.map((d) => {
            if (sua && d.id === sua) {
              return <SuaForm key={d.cap} dong={d} areaOptions={areaOptions} onDong={() => setSua('')} />;
            }
            const laCuon = d.id != null && d.measureBy === 'cuon' && d.cuon != null;
            // Vạch của mục tiêu cuộn đi theo TỈ LỆ, không theo lượt tick: 85,7% trên đích 86% thì
            // vạch gần đầy. Con số nằm trong wig_progress_v (private.wig_actual trả tỉ lệ cho loại
            // này) nên d.pct đã đúng — nhưng nếu dòng tiến độ vắng mặt thì tự tính lại, đừng vẽ
            // một vạch 0% cạnh dòng chữ "6/7 bạn đạt".
            const pct = laCuon
              ? Math.round(Math.min(100, (d.cuon!.tyLe / (d.cuon!.can || 100)) * 100))
              : Math.round(d.pct * 100);
            // Dòng trống (chưa đặt mục tiêu) vẫn giữ vạch xám như cũ — nó nói "chỗ này còn thiếu".
            const laManual = d.id != null && d.measureBy === 'manual';
            return (
              <div key={d.cap} className="group">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-grey-soft">
                    {tenCap(d.cap)}
                    {d.periodLabel ? ` · ${d.periodLabel}` : ''}
                    {d.startDate && d.endDate ? ` · ${dm(d.startDate)}→${dm(d.endDate)}` : ''}
                  </span>
                  {d.id && (
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSua(d.id!)}
                        aria-label={`${t('edit')} — ${d.title}`}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-[7px] text-grey-soft transition-colors hover:bg-navy/[0.07] hover:text-navy"
                      >
                        <Pencil size={12} strokeWidth={2.5} />
                      </button>
                      <form action={deleteWig} className="contents">
                        {classParam && <input type="hidden" name="class_id" value={classParam} />}
                        <input type="hidden" name="wig_id" value={d.id} />
                        <input type="hidden" name="week" value={weekParam} />
                        <ConfirmButton
                          message={t('confirmDeleteWig')}
                          label={`${t('deleteWig')} — ${d.title}`}
                          className="grid h-6 w-6 cursor-pointer place-items-center rounded-[7px] text-grey-soft transition-colors hover:bg-status-bad/[0.12] hover:text-status-bad"
                        >
                          <Trash2 size={12} strokeWidth={2.5} />
                        </ConfirmButton>
                      </form>
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex items-baseline gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] font-bold ${
                      d.id ? 'text-navy' : 'italic text-grey-mid'
                    }`}
                    title={d.title}
                  >
                    {d.title}
                  </span>
                  <span
                    className={`shrink-0 text-[12.5px] font-extrabold tabular-nums ${
                      d.id ? 'text-navy' : 'text-grey-soft'
                    }`}
                  >
                    {!d.id
                      ? '—'
                      : laCuon
                        ? `${d.cuon!.tyLe}% / ${d.cuon!.can}%`
                        : laManual
                          ? `→ ${d.target} ${d.unit}`
                          : `${d.actual} / ${d.target} ${d.unit}`}
                  </span>
                </div>

                {/* PHÂN SỐ, KHÔNG CHỈ PHẦN TRĂM. "85,7%" không nói cho cô biết còn phải kéo thêm
                    mấy em; "6/7 bạn đạt" thì nói ngay là một em. Với lớp 32 em thì khác biệt còn
                    lớn hơn: 84,4% và 85,7% trông như nhau, "27/32" và "6/7" thì không. */}
                {laCuon && (
                  <p className="mt-1 text-[11px] font-bold text-grey-mid">
                    {t('cuonDat', {dat: d.cuon!.dat, tong: d.cuon!.tong})}
                    {' · '}
                    {t('cuonSoDich')} {d.cuon!.soDichCan}
                    {d.cuon!.tongDich ? `/${d.cuon!.tongDich}` : ''}
                  </p>
                )}

                {/* ĐÍCH GHI NHẬN NGOÀI: không vạch, không phần trăm — app không đếm được con số
                    ấy thì mọi vạch nó vẽ ra đều là bịa. Chỉ nói Đạt hay Chưa đạt, y như màn của
                    em đang làm đúng (MucTieuCuaCon). */}
                {laManual ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-grey-mid">
                    {d.achievedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                        <Check size={11} strokeWidth={3} />
                        {t('achieved')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                        {t('notYet')}
                      </span>
                    )}
                  </p>
                ) : (
                  <div className="mt-1.5 h-[8px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
                    <div
                      className="h-full rounded-[5px]"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: MAU[d.status ?? ''] ?? 'var(--color-grey-soft)',
                      }}
                    />
                  </div>
                )}
                {/* Dòng "Từ 6 → 8 điểm" đã bỏ (16/08/2026): tiêu đề mục tiêu ngay trên đã ghi
                    đúng câu ấy ("Điểm trung bình thể lực từ 6 lên 8"), nên đây là nhắc lại. */}
                {/* Ô SỐ ĐO CỦA TUẦN — chỉ ở dòng NĂM, và chỉ với đích ghi-nhận-ngoài.
                    Chủ dự án chốt 14/08/2026: kg/điểm không nhập hằng ngày; điền lại mỗi tuần,
                    đúng nhịp buổi họp. Ô này đã có sẵn ở màn của em từ 0108 (wig_so_do khoá theo
                    mục tiêu + tuần, không theo học sinh) nên dùng lại nguyên vẹn cho mục tiêu lớp. */}
                {/* Điều kiện là KIỂU ĐƠN VỊ, không phải cột 'đo bằng gì': chủ dự án nói
                    "điểm, hay kg, hay bất cứ cái nào không đong đếm được" thì điền lại mỗi
                    tuần. Một mục tiêu tính bằng điểm mà khai 'máy đếm' vẫn cần ô này — sau
                    14/08/2026 việc dẫn dắt thôi mang con số ấy, nên không còn nguồn nào khác. */}
                {/* MỤC TIÊU CUỘN THÌ KHÔNG. Đơn vị của nó cũng là '%' nên nó lọt qua điều kiện
                    trên, và ô "Số của lớp tuần này ___ %" hiện ra ngay dưới dòng "0/7 bạn đạt" —
                    mời cô gõ tay đúng con số mà app vừa tự đếm xong. Bắt được bằng mắt trên trình
                    duyệt thật, không phép kiểm số nào thấy. */}
                {kieuDonVi(d.unit) === 'do' && d.measureBy !== 'cuon' && d.cap === 'year' && d.id && (
                  <div className="mt-2">
                    <OSoDo
                      wigId={d.id}
                      unit={d.unit}
                      soHienTai={g.soDo?.giaTri ?? null}
                      nguoiGhi={(g.soDo?.vaiTro as 'student' | 'teacher' | null) ?? null}
                      ghiLuc={g.soDo?.ghiLuc ?? null}
                      moKhoa={g.soDoMoKhoa !== false}
                      canGhi
                      laCuaLop
                      tuanDangXem={weekParam || undefined}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Sửa tên / mốc xuất phát / mục tiêu / đơn vị. KHÔNG có ô ngày — xem ghi chú ở suaWig: ngày sinh
// ra từ nhãn kỳ, cho sửa tay là mở lại đúng cái cửa đã gây sự cố lệch tuần.
// Cấp NĂM sửa được cả LĨNH VỰC (người thử 08/2026 xin đúng thứ này) — tháng/tuần thì không, chúng
// thừa hưởng lĩnh vực từ mục tiêu năm, và server tự lan lĩnh vực mới xuống các con.
function SuaForm({
  dong,
  areaOptions,
  onDong,
}: {
  dong: DongTienDo;
  areaOptions: {value: string; label: string}[];
  onDong: () => void;
}) {
  const t = useTranslations('wig');
  const [state, formAction] = useActionState(suaWig, {ok: false});

  useEffect(() => {
    if (state.ok) onDong();
  }, [state.ok, onDong]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-gold/60 bg-white p-3">
      <input type="hidden" name="wig_id" value={dong.id ?? ''} />
      {dong.measureBy === 'cuon' && <input type="hidden" name="la_cuon" value="1" />}
      <h2 className="font-display text-[13px] font-bold text-navy">
        {t('editWig')} · {dong.periodLabel ?? ''}
      </h2>

      {dong.cap === 'year' && (
        <Field label={t('area')} htmlFor={`sw-a-${dong.id}`}>
          <select id={`sw-a-${dong.id}`} name="area" defaultValue={dong.area ?? ''} className={selectCls}>
            {areaOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label={t('wigTitle')} htmlFor={`sw-t-${dong.id}`} error={err('title')}>
        <input
          id={`sw-t-${dong.id}`}
          name="title"
          defaultValue={dong.title}
          aria-invalid={state.fieldError === 'title'}
          className={ctlWithBorder(state.fieldError === 'title')}
        />
      </Field>

      {dong.measureBy === 'cuon' && dong.cuon ? (
        // Ba ô của phép cuộn thay ba ô Từ/Đến/Đơn vị: mục tiêu này không có mốc xuất phát (đếm từ
        // 0 bạn) và đơn vị của nó luôn là %.
        <div className="grid grid-cols-3 gap-2">
          <Field label={t('cuonTyLe')} htmlFor={`sw-tl-${dong.id}`} error={err('ty_le_can')}>
            <input
              id={`sw-tl-${dong.id}`}
              name="ty_le_can"
              type="number"
              step="any"
              min="1"
              max="100"
              inputMode="decimal"
              defaultValue={dong.cuon.can}
              aria-invalid={state.fieldError === 'ty_le_can'}
              className={ctlWithBorder(state.fieldError === 'ty_le_can')}
            />
          </Field>
          <Field label={t('cuonSoDich')} htmlFor={`sw-sd-${dong.id}`} error={err('so_dich_can')}>
            <input
              id={`sw-sd-${dong.id}`}
              name="so_dich_can"
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              defaultValue={dong.cuon.soDichCan}
              aria-invalid={state.fieldError === 'so_dich_can'}
              className={ctlWithBorder(state.fieldError === 'so_dich_can')}
            />
          </Field>
          <Field label={t('cuonTongDich')} htmlFor={`sw-td-${dong.id}`} error={err('tong_dich')}>
            <input
              id={`sw-td-${dong.id}`}
              name="tong_dich"
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              defaultValue={dong.cuon.tongDich ?? ''}
              aria-invalid={state.fieldError === 'tong_dich'}
              className={ctlWithBorder(state.fieldError === 'tong_dich')}
            />
          </Field>
        </div>
      ) : (
      <div className="grid grid-cols-3 gap-2">
        <Field label={t('baseline')} htmlFor={`sw-b-${dong.id}`} error={err('baseline')}>
          <input
            id={`sw-b-${dong.id}`}
            name="baseline"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            defaultValue={dong.baseline ?? ''}
            placeholder="0"
            aria-invalid={state.fieldError === 'baseline'}
            className={ctlWithBorder(state.fieldError === 'baseline')}
          />
        </Field>
        <Field label={t('targetTo')} htmlFor={`sw-m-${dong.id}`} error={err('target_value')}>
          <input
            id={`sw-m-${dong.id}`}
            name="target_value"
            type="number"
            step="any"
            min="0.01"
            inputMode="decimal"
            defaultValue={dong.target}
            aria-invalid={state.fieldError === 'target_value'}
            className={ctlWithBorder(state.fieldError === 'target_value')}
          />
        </Field>
        <Field label={t('unit')} htmlFor={`sw-u-${dong.id}`} error={err('unit')}>
          <input id={`sw-u-${dong.id}`} name="unit" defaultValue={dong.unit} className={inputCls} />
        </Field>
      </div>
      )}

      {state.error && !state.fieldError && (
        <p className="inline-flex items-start gap-1.5 text-[12px] font-bold text-status-bad">
          <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
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
