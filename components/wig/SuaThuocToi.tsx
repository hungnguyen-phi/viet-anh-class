'use client';

// SỬA / XÓA THƯỚC ĐO DẪN DẮT cá nhân của thầy cô — nút bút cạnh tên thước, mở Popup: đổi tên +
// cách đo + đích + ngày tick. Đã có lượt ghi thì KHOÁ cách đo/đơn vị (th_truoc_sua chặn) và nói
// lý do ngay trong hộp; xoá cũng chỉ được khi chưa ghi lần nào (th_truoc_xoa). Cùng mẫu SuaViecEm.
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Trash2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder} from '@/components/ui/Field';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ChonNgayTuan} from '@/components/ui/ChonNgayTuan';
import {suaThuocToi, xoaThuocToi} from '@/app/[locale]/(dashboard)/wig/lop-actions';

export function SuaThuocToi({
  thuocId,
  ten,
  cachGhi,
  chiTieu,
  ngayApDung,
  donViId,
  classId,
  weekQ,
  coLuot,
  donViList = [],
}: {
  thuocId: string;
  ten: string;
  cachGhi: string;
  chiTieu: number;
  ngayApDung: number[];
  donViId: string | null;
  classId: string;
  weekQ: string;
  /** Đã có lượt ghi (ít nhất tuần này) → khoá đổi cách đo/đơn vị, nói lý do. */
  coLuot: boolean;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('camKet');
  const [mo, setMo] = useState(false);
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>(cachGhi === 'dien_so' ? 'dien_so' : 'cham');

  const ctx = (
    <>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="week" value={weekQ} />
      <input type="hidden" name="thuoc_id" value={thuocId} />
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('suaThuoc')}
        title={t('suaThuoc')}
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-[7px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy"
      >
        <Pencil size={12} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('suaThuoc')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={suaThuocToi} className="flex flex-col gap-2.5">
            {ctx}
            <input type="hidden" name="viec_cach" value={viecCach} />
            <Field label={t('viecBoTroLabel')} htmlFor="stt-ten">
              <input id="stt-ten" name="ten" maxLength={160} defaultValue={ten} className={ctlWithBorder(false)} autoFocus />
            </Field>

            {/* CÁCH ĐO — đã có lượt thì đông cứng (đổi là số cũ mất nghĩa), chỉ nói lý do. */}
            {coLuot ? (
              <p className="text-[11.5px] font-semibold italic text-grey-mid">{t('khoaCachDo')}</p>
            ) : (
              <div className="inline-flex w-fit rounded-[9px] border-[1.5px] border-navy/20 p-0.5 text-[12px] font-extrabold">
                <button
                  type="button"
                  onClick={() => setViecCach('cham')}
                  className={`cursor-pointer rounded-[7px] px-2.5 py-1 transition-colors ${viecCach === 'cham' ? 'bg-navy text-white' : 'text-grey-mid'}`}
                >
                  {t('viecTick')}
                </button>
                <button
                  type="button"
                  onClick={() => setViecCach('dien_so')}
                  className={`cursor-pointer rounded-[7px] px-2.5 py-1 transition-colors ${viecCach === 'dien_so' ? 'bg-navy text-white' : 'text-grey-mid'}`}
                >
                  {t('viecSo')}
                </button>
              </div>
            )}

            {viecCach === 'cham' ? (
              <Field label={t('chonNgayTick')} htmlFor="stt-ngay" hint={t('chonNgayHint')}>
                <ChonNgayTuan daChon={ngayApDung} />
              </Field>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                {!coLuot && (
                  <Field label={t('chonDonVi')} htmlFor="stt-vdv">
                    <select id="stt-vdv" name="viec_don_vi" defaultValue={donViId ?? ''} className={ctlWithBorder(false)}>
                      <option value="">{t('chonDonVi')}</option>
                      {donViList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nhan ?? d.ma}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label={t('viecDichHoi')} htmlFor="stt-vdich">
                  <input id="stt-vdich" type="number" name="viec_dich" step="any" min="0" defaultValue={chiTieu} className={`${ctlWithBorder(false)} max-w-[120px]`} />
                </Field>
              </div>
            )}
            <SubmitButton className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90" wrapClass="contents">
              {t('luuSua')}
            </SubmitButton>
          </form>

          {/* XÓA — chỉ được khi chưa ghi lần nào (th_truoc_xoa chặn, câu báo hiện nguyên). */}
          <form
            action={xoaThuocToi}
            className="mt-3 flex justify-end border-t border-navy/[0.08] pt-3"
            onSubmit={(e) => {
              if (!window.confirm(t('xoaThuocHoi'))) e.preventDefault();
            }}
          >
            {ctx}
            <SubmitButton
              className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-extrabold text-status-bad underline"
              wrapClass="contents"
            >
              <Trash2 size={13} strokeWidth={2.5} />
              {t('xoaThuoc')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}
