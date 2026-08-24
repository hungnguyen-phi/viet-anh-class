'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Pencil} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, ctlWithBorder, btnGold, btnGhost} from '@/components/ui/Field';
import {kieuDonVi} from '@/lib/don-vi';
import {suaCamKetTuan, xoaCamKetTuan, xoaViecCuaEm, type CamKetState} from '@/app/[locale]/(dashboard)/student/actions';
import {EditRequestButton} from '@/components/student/EditRequestButton';

// SỬA MỘT CAM KẾT TUẦN — của chính em.
//
// Chủ dự án 16/08/2026: "đừng để nút xóa lộ liễu, để là sửa, khi chưa duyệt thì cứ sửa thoải mái,
// còn duyệt thì sửa phải xin, tương tự bên trong".
//   · CHƯA DUYỆT → nút "Sửa" mở một khung nhỏ: tên cam kết, tên + đích của từng việc; "Xoá việc" và
//     "Xoá cam kết" là chữ nhỏ ở cuối khung, không đứng lộ ngoài dòng.
//   · ĐÃ DUYỆT → nút "Xin sửa" (đường xin cô có sẵn, EditRequestButton) — cô gật rồi mới đổi.
// Xoá/sửa việc gì thì cam kết mẹ tự về chờ duyệt (trigger 0141).
export function SuaCamKet({
  commitmentId,
  studentId,
  classId,
  title,
  status,
  viec,
  donVi = '',
  dayShort,
}: {
  commitmentId: string;
  studentId: string;
  classId: string;
  title: string;
  status: string;
  viec: {id: string; title: string; target: number; unit: string | null}[];
  /** Đơn vị của mục tiêu mà cam kết phục vụ ('bài', 'lead'…) — quyết định cách hỏi đong đếm. */
  donVi?: string;
  /** Nhãn T2…CN theo ngôn ngữ (màn cha đã có sẵn, không đọc lại ở client). */
  dayShort?: string[];
}) {
  const t = useTranslations('goal');
  const tm = useTranslations('meeting');
  const [mo, setMo] = useState(false);
  // VIỆC MỚI (24/08/2026) — cam kết được phép gửi khi chưa nghĩ ra việc, nhưng trước nay "thêm
  // sau" không có đường nào đi: khung này chỉ sửa được việc đã có, nên cam kết trống là cam kết
  // không bao giờ tick được. Bộ ô ở đây giống hệt lúc tạo, để em không phải học lần thứ hai.
  const [tenViec, setTenViec] = useState('');
  const [thu, setThu] = useState<number[]>([]);
  const [moiLanKhac, setMoiLanKhac] = useState(false);
  const kieu = kieuDonVi(donVi);
  const nhan = dayShort ?? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const [state, formAction] = useActionState<CamKetState, FormData>(suaCamKetTuan, {ok: false});
  useEffect(() => {
    if (state.ok) setMo(false);
  }, [state]);

  if (status === 'approved') {
    return viec.length > 0 ? <EditRequestButton studentId={studentId} classId={classId} leads={viec} /> : null;
  }

  if (!mo) {
    return (
      <button type="button" onClick={() => setMo(true)} className={`${btnGhost} h-8 px-2.5 text-[11.5px]`}>
        <Pencil size={12} strokeWidth={2.5} />
        {t('edit')}
      </button>
    );
  }

  return (
    <div className="basis-full">
    <form action={formAction} className="rounded-[12px] border-[1.5px] border-navy/10 bg-white p-3">
      <input type="hidden" name="commitment_id" value={commitmentId} />
      <input type="hidden" name="student_id" value={studentId} />
      <div className="flex flex-col gap-2.5">
        <Field label={tm('commitmentOne')} htmlFor={`sck-${commitmentId}`} error={state.fieldError === 'title' ? state.error : null}>
          <input id={`sck-${commitmentId}`} name="title" defaultValue={title} maxLength={160} className={ctlWithBorder(state.fieldError === 'title')} />
        </Field>
        {viec.map((v) => (
          <div key={v.id} className="grid grid-cols-[1fr_92px] items-end gap-2">
            <input type="hidden" name="viec_id" value={v.id} />
            <Field label={tm('thisWeekWork')} htmlFor={`sv-${v.id}`}>
              <input id={`sv-${v.id}`} name={`viec_title_${v.id}`} defaultValue={v.title} maxLength={120} className={ctlWithBorder(false)} />
            </Field>
            <Field label={v.unit ? `${t('target')} (${v.unit})` : t('target')} htmlFor={`st-${v.id}`}>
              <input id={`st-${v.id}`} name={`viec_target_${v.id}`} type="number" step="any" min="0.01" inputMode="decimal" defaultValue={v.target} className={ctlWithBorder(false)} />
            </Field>
          </div>
        ))}
        {/* THÊM MỘT VIỆC — cùng bộ ô với lúc tạo cam kết. Để trống tên thì không thêm gì. */}
        <div className="rounded-[12px] bg-navy/[0.04] p-2.5">
          <Field
            label={viec.length === 0 ? tm('thisWeekWork') : t('addWork')}
            htmlFor={`nv-${commitmentId}`}
            error={state.fieldError === 'viec_days' ? state.error : null}
          >
            <input
              id={`nv-${commitmentId}`}
              name="viec_title"
              maxLength={120}
              value={tenViec}
              onChange={(e) => setTenViec(e.target.value)}
              placeholder={tm('workPlaceholder')}
              className={ctlWithBorder(false)}
            />
          </Field>
          {tenViec && (
            <>
              {kieu === 'luong' && donVi && (
                <div className="mt-2">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-navy">
                    <input
                      type="checkbox"
                      checked={moiLanKhac}
                      onChange={(e) => setMoiLanKhac(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[var(--color-gold)]"
                    />
                    {t('eachTimeVaries')}
                  </label>
                  <input type="hidden" name="viec_nhap_luong" value={moiLanKhac ? '1' : ''} />
                  <div className="mt-2">
                    {moiLanKhac ? (
                      <Field label={t('weekAmount', {unit: donVi})} htmlFor={`nl-${commitmentId}`} error={state.fieldError === 'viec_luong' ? state.error : null}>
                        <input id={`nl-${commitmentId}`} name="viec_luong" type="number" step="any" min="0.01" inputMode="decimal" className={ctlWithBorder(state.fieldError === 'viec_luong')} />
                      </Field>
                    ) : (
                      <Field label={t('perTick', {unit: donVi})} htmlFor={`nu-${commitmentId}`} error={state.fieldError === 'viec_upt' ? state.error : null}>
                        <input id={`nu-${commitmentId}`} name="viec_upt" type="number" step="any" min="0.01" inputMode="decimal" defaultValue="1" className={ctlWithBorder(state.fieldError === 'viec_upt')} />
                      </Field>
                    )}
                  </div>
                </div>
              )}
              {thu.map((d) => (
                <input key={d} type="hidden" name="viec_days" value={d} />
              ))}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setThu((cu) => (cu.includes(d) ? cu.filter((x) => x !== d) : [...cu, d].sort((a, b) => a - b)))}
                    aria-pressed={thu.includes(d)}
                    aria-label={nhan[d - 1]}
                    className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[9px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                      thu.includes(d)
                        ? 'border-transparent bg-gold text-navy'
                        : 'border-navy/15 bg-white text-grey-mid hover:border-navy'
                    }`}
                  >
                    {nhan[d - 1]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {state.error && !state.fieldError && (
          <p className="inline-flex items-start gap-1.5 text-[12px] font-bold text-status-bad">
            <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className={btnGold} wrapClass="contents">
            {t('save')}
          </SubmitButton>
          <button type="button" onClick={() => setMo(false)} className="inline-flex min-h-[24px] cursor-pointer items-center text-[12px] font-extrabold text-grey-mid underline">
            {t('cancel')}
          </button>
        </div>
      </div>
    </form>
    {/* XOÁ — chữ nhỏ ở cuối khung, mỗi cái một form riêng (không lồng form). */}
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-1">
      {viec.map((v) => (
        <form key={v.id} action={xoaViecCuaEm}>
          <input type="hidden" name="lead_id" value={v.id} />
          <input type="hidden" name="student_id" value={studentId} />
          <ConfirmButton
            message={t('confirmDeleteWork')}
            label={`${t('deleteWork')}: ${v.title}`}
            className="inline-flex min-h-[24px] cursor-pointer items-center text-[11px] font-extrabold text-status-bad underline"
          >
            {t('deleteWork')}{viec.length > 1 ? ` "${v.title}"` : ''}
          </ConfirmButton>
        </form>
      ))}
      <form action={xoaCamKetTuan}>
        <input type="hidden" name="commitment_id" value={commitmentId} />
        <input type="hidden" name="student_id" value={studentId} />
        <ConfirmButton
          message={t('confirmDeleteCommitment')}
          label={t('deleteCommitmentLong')}
          className="inline-flex min-h-[24px] cursor-pointer items-center text-[11px] font-extrabold text-status-bad underline"
        >
          {t('deleteCommitmentLong')}
        </ConfirmButton>
      </form>
    </div>
    </div>
  );
}
