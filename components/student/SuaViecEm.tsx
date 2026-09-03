'use client';

// SỬA / XÓA THƯỚC ĐO DẪN DẮT của em — nút bút mở Popup đổi TÊN + CÁCH ĐO (tick mỗi ngày / đo bằng
// số + đơn vị) + ĐÍCH + NGÀY (hiệu lực ngay, KHÔNG duyệt). Đổi đơn vị/cách-đo chỉ được khi CHƯA ghi
// lượt nào (trigger th_truoc_sua chặn nếu đã tick — câu báo hiện nguyên). Trong hộp có nút XÓA.
import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Pencil, Trash2} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {suaViec, xoaViec} from '@/app/[locale]/(dashboard)/student/actions';

const NGAY: {v: number; nhan: string}[] = [
  {v: 1, nhan: 'T2'},
  {v: 2, nhan: 'T3'},
  {v: 3, nhan: 'T4'},
  {v: 4, nhan: 'T5'},
  {v: 5, nhan: 'T6'},
  {v: 6, nhan: 'T7'},
  {v: 7, nhan: 'CN'},
];

export function SuaViecEm({
  studentId,
  thuocId,
  ten,
  chiTieu,
  ngayApDung,
  tenDonVi,
  cachGhi,
  donViId,
  coLuot = false,
  donViList = [],
}: {
  studentId: string;
  thuocId: string;
  ten: string;
  chiTieu: number;
  ngayApDung: number[];
  tenDonVi: string | null;
  cachGhi?: string;
  donViId?: string | null;
  /** Đã có lượt ghi tuần này → khoá đổi cách đo/đơn vị (trigger chặn), nói lý do thay vì để lỗi văng. */
  coLuot?: boolean;
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const t = useTranslations('viec');
  const [mo, setMo] = useState(false);
  // Prefill CÁCH ĐO theo giá trị hiện tại: 'dien_so' = đo bằng số, còn lại (cham) = tick mỗi ngày.
  const [viecCach, setViecCach] = useState<'cham' | 'dien_so'>(cachGhi === 'dien_so' ? 'dien_so' : 'cham');
  const [viecDonVi, setViecDonVi] = useState(donViId ?? '');

  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label={t('sua')}
        title={t('sua')}
        className="grid h-6 w-6 cursor-pointer place-items-center rounded-[7px] text-navy transition-colors hover:bg-navy/[0.06]"
      >
        <Pencil size={12} strokeWidth={2.5} />
      </button>
      {mo && (
        <Popup title={t('sua')} onClose={() => setMo(false)} width="max-w-[440px]">
          <form action={suaViec} className="flex flex-col gap-2.5">
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="thuoc_id" value={thuocId} />
            <input type="hidden" name="viec_cach" value={viecCach} />
            <input
              name="ten"
              defaultValue={ten}
              maxLength={160}
              placeholder={t('tenHoi')}
              className="rounded-[9px] border-[1.5px] border-navy/20 px-2.5 py-1.5 text-[13px] text-navy"
              autoFocus
            />

            {/* CÁCH ĐO — tick mỗi ngày (đơn vị "ngày") hoặc đo bằng số (đơn vị tùy chọn).
                Đã có lượt thì đông cứng cách đo/đơn vị — nói lý do, giấu nút đổi. */}
            {coLuot && <p className="text-[11.5px] font-semibold italic text-grey-mid">{t('khoaCachDo')}</p>}
            <div className={coLuot ? 'hidden' : 'inline-flex w-fit rounded-[9px] border-[1.5px] border-navy/20 p-0.5 text-[12px] font-extrabold'}>
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

            <div className="flex flex-wrap items-center gap-2">
              {viecCach === 'dien_so' && !coLuot && (
                <select
                  name="viec_don_vi"
                  value={viecDonVi}
                  onChange={(e) => setViecDonVi(e.target.value)}
                  required
                  className="rounded-[9px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                >
                  <option value="">{t('chonDonVi')}</option>
                  {donViList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nhan ?? d.ma}
                    </option>
                  ))}
                </select>
              )}
              <span className="inline-flex items-center gap-1">
                <span className="text-[12px] font-semibold text-grey-mid">{t('dichLabel')}</span>
                <input
                  type="number"
                  name="chi_tieu_ky"
                  defaultValue={chiTieu}
                  step="any"
                  min="0"
                  className="w-20 rounded-[9px] border-[1.5px] border-navy/20 px-2 py-1 text-[12.5px] text-navy"
                />
                <span className="text-[12px] font-semibold text-grey-mid">
                  {viecCach === 'cham' ? t('donViNgay') : viecDonVi ? (donViList.find((d) => d.id === viecDonVi)?.nhan ?? '') : (tenDonVi ?? '')}
                </span>
              </span>
            </div>

            {/* NGÀY áp dụng (những thứ em phải làm/ghi việc này). */}
            <div className="flex flex-wrap gap-1">
              {NGAY.map((n) => (
                <label
                  key={n.v}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] border-[1.5px] border-navy/15 px-2 py-1 text-[12px] font-bold text-navy has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white"
                >
                  <input type="checkbox" name="ngay" value={n.v} defaultChecked={ngayApDung.includes(n.v)} className="sr-only" />
                  {n.nhan}
                </label>
              ))}
            </div>
            <SubmitButton
              className="mt-1 self-start rounded-[12px] bg-navy px-4 py-2.5 text-[13px] font-extrabold text-white transition-all hover:bg-navy/90"
              wrapClass="contents"
            >
              {t('luuSua')}
            </SubmitButton>
          </form>

          {/* XÓA — chỉ xoá được khi chưa ghi lần nào (RLS); nằm trong hộp Sửa cho gọn. */}
          <form
            action={xoaViec}
            className="mt-3 flex justify-end border-t border-navy/[0.08] pt-3"
            onSubmit={(e) => {
              if (!window.confirm(t('xoaHoi'))) e.preventDefault();
            }}
          >
            <input type="hidden" name="student_id" value={studentId} />
            <input type="hidden" name="thuoc_id" value={thuocId} />
            <SubmitButton
              className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-extrabold text-status-bad underline"
              wrapClass="contents"
            >
              <Trash2 size={13} strokeWidth={2.5} />
              {t('xoa')}
            </SubmitButton>
          </form>
        </Popup>
      )}
    </>
  );
}
