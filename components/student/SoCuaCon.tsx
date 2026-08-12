'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, BookOpen, CheckCircle2, History} from 'lucide-react';
import {Popup} from '@/components/ui/Popup';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost, btnGold} from '@/components/ui/Field';
import {luuSoCuaCon, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';

// SỔ CỦA CON — cuốn sổ THUỘC VỀ HỌC SINH, không phải hồ sơ của giáo viên.
//
// Đó là toàn bộ lý do nó có tác dụng trong Leader in Me, và là chỗ duy nhất trong cả mô hình mà
// người lớn KHÔNG ghi được. Mục tiêu thì cô đặt hộ được; cuốn sổ thì không — một cuốn sổ ai cũng
// viết được thì không còn là sổ của em nữa. Chính sách rls_write_student_reflections (0100) chặn
// ở tầng CSDL, đây chỉ là cửa.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SỔ NÀY LÀ SỔ CỦA MỘT TUẦN — và trước 12/08/2026 màn hình không nói ra điều đó.
//
// `luuSoCuaCon` ghi theo `week_start` của tuần đang chạy, khoá duy nhất (student_id, week_start).
// Nghĩa là: chữ em viết thuộc về ĐÚNG MỘT TUẦN, và sáng thứ Hai ô nhập trống trở lại. Bản cũ chỉ
// bày một ô trống không nhãn, nên em không có cách nào biết mình đang viết cho tuần nào, chữ tuần
// trước đi đâu, hay bị xoá mất. Chủ dự án bắt đúng chỗ này. Nay nói cả ba: NHÃN TUẦN (kèm ngày
// đầu–cuối), một câu về việc sang thứ Hai là trang mới, và đường mở lại các tuần đã viết — dữ
// liệu vốn vẫn nằm nguyên trong CSDL, chỉ là chưa màn nào hỏi tới.
//
// Ô nhập nằm trong hộp thoại chứ không mở sẵn giữa trang: cùng lý do với FormMucTieu — thứ em làm
// MỖI NGÀY (tick việc) phải ở trên, thứ em làm mỗi tuần một lần thì nằm sau một cú bấm.
export type TrangSo = {week_start: string; body: string};

const ngay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function SoCuaCon({
  classId,
  tuanDau,
  tuanCuoi,
  lichSu,
  laChinhEm,
}: {
  classId: string;
  // Ngày đầu và cuối của TUẦN ĐANG CHẠY (lịch VN) — cùng nguồn với dải ô tick, để hai chỗ không
  // nói khác nhau về "tuần này".
  tuanDau: string;
  tuanCuoi: string;
  // Mọi trang đã viết, mới nhất trước. Trang đầu tiên CÓ THỂ chính là tuần này (em đã viết rồi).
  lichSu: TrangSo[];
  laChinhEm: boolean;
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuSoCuaCon, {ok: false});
  const [mo, setMo] = useState(false);

  const tuanNay = lichSu.find((x) => x.week_start === tuanDau) ?? null;
  const truoc = lichSu.filter((x) => x.week_start !== tuanDau);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="flex items-center gap-1.5 font-display text-[14px] font-bold text-navy">
          <BookOpen size={14} strokeWidth={2.5} />
          {t('journal')}
        </h3>
        <span className="text-[11px] font-extrabold text-gold-text">
          {t('journalWeek', {dau: ngay(tuanDau), cuoi: ngay(tuanCuoi)})}
        </span>
      </div>

      {/* Xem trước một dòng: đủ để em nhận ra mình đã viết gì tuần này mà không phải mở hộp thoại. */}
      <p className="line-clamp-2 text-[12.5px] font-semibold text-navy">
        {tuanNay?.body || <span className="italic text-grey-mid">{t('journalEmpty')}</span>}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setMo(true)} className={laChinhEm ? btnGold : btnGhost}>
          <BookOpen size={13} strokeWidth={2.5} />
          {laChinhEm ? (tuanNay ? t('journalEdit') : t('journalOpen')) : t('journalRead')}
        </button>
        {truoc.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-grey-mid">
            <History size={12} strokeWidth={2.5} />
            {t('journalHistoryCount', {n: truoc.length})}
          </span>
        )}
      </div>

      {mo && (
        <Popup title={t('journal')} onClose={() => setMo(false)} width="max-w-[560px]">
          <div className="flex flex-col gap-3">
            <div className="rounded-[10px] bg-gold/[0.10] px-3 py-2 text-[11.5px] font-bold leading-relaxed text-navy">
              {t('journalWeek', {dau: ngay(tuanDau), cuoi: ngay(tuanCuoi)})} · {t('journalReset')}
            </div>

            {state.error && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
                <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.error}
              </p>
            )}
            {state.ok && state.message && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
                <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.message}
              </p>
            )}

            {laChinhEm ? (
              <form action={formAction} className="flex flex-col gap-2.5">
                <input type="hidden" name="class_id" value={classId} />
                <span className="text-[12px] font-semibold text-grey-mid">{t('journalHint')}</span>
                <textarea
                  name="body"
                  rows={5}
                  defaultValue={tuanNay?.body ?? ''}
                  maxLength={2000}
                  placeholder={t('journalPlaceholder')}
                  className="w-full resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-colors focus:border-navy"
                />
                <div>
                  <SubmitButton className={btnGold} wrapClass="contents">
                    {t('journalSave')}
                  </SubmitButton>
                </div>
              </form>
            ) : (
              // Người lớn ĐỌC được — phụ huynh và cô cần thấy em đang nghĩ gì để mà đồng hành. Chỉ
              // là không có ô nhập nào cho họ.
              <p className="whitespace-pre-wrap text-[13px] font-semibold leading-relaxed text-navy">
                {tuanNay?.body || <span className="italic text-grey-mid">{t('journalEmpty')}</span>}
              </p>
            )}

            {/* CÁC TUẦN TRƯỚC — chữ cũ không mất, chỉ là thuộc về tuần khác. Chỉ đọc: sửa lại
                trang của tuần đã qua thì cuốn sổ thôi còn là bản ghi của lúc ấy. */}
            <div className="border-t border-navy/10 pt-2.5">
              <h4 className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-[0.03em] text-grey-mid">
                <History size={12} strokeWidth={2.5} />
                {t('journalHistory')}
              </h4>
              {truoc.length === 0 ? (
                <p className="mt-1 text-[12px] italic text-grey-mid">{t('journalNoHistory')}</p>
              ) : (
                <ul className="mt-1.5 flex max-h-[240px] flex-col gap-2 overflow-y-auto">
                  {truoc.map((x) => (
                    <li key={x.week_start} className="rounded-[10px] bg-navy/[0.03] px-2.5 py-2">
                      <div className="text-[11px] font-extrabold text-grey-mid">
                        {t('journalWeekOf', {dau: ngay(x.week_start)})}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] font-semibold text-navy">
                        {x.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
}
