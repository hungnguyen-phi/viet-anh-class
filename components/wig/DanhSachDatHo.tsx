'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, Clock, Pencil, Plus, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {FormMucTieu, type DangSua, type WigLop} from '@/components/student/FormMucTieu';
import {xoaMucTieuCuaEm} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// DANH SÁCH LỚP — cô nhìn thấy CẢ EM CHƯA ĐẶT, và đặt hộ ngay tại chỗ
// ════════════════════════════════════════════════════════════════════════════
//
// Bức tường WIG bản đầu chỉ liệt kê những mục tiêu ĐÃ CÓ. Nhưng câu hỏi thật của cô không phải
// "ai đã đặt" mà là "CÒN AI CHƯA" — và đúng câu ấy thì bản cũ không trả lời được: em chưa đặt thì
// không có dòng nào, tức là em càng im lặng càng vô hình.
//
// Nay danh sách chạy từ SĨ SỐ chứ không từ số mục tiêu: đủ mặt cả lớp, em nào trống thì trống rõ
// ràng kèm một cái nút. Cô bấm là mở đúng cái form em vẫn dùng (FormMucTieu) — cùng một luật, cùng
// một chỗ ghi `set_by='teacher'`.
//
// Van an toàn vẫn phải lộ ra: mục tiêu cô gõ hộ mang nhãn "Cô đặt giúp con" trên màn của em, và
// trong 24 giờ đầu em sửa hoặc xoá được (0102). Cô đặt hộ là để em có chỗ bắt đầu, không phải để
// thay em quyết định.

export type EmTrongLop = {
  id: string;
  ten: string;
  mucTieu:
    | (DangSua & {
        status: string;
        set_by: string | null;
        achieved_at: string | null;
      })
    | null;
};

export function DanhSachDatHo({
  classId,
  danhSach,
  wigLop,
  dayShort,
}: {
  classId: string;
  danhSach: EmTrongLop[];
  wigLop: WigLop[];
  dayShort: string[];
}) {
  const t = useTranslations('goal');
  const [dangMo, setDangMo] = useState<EmTrongLop | null>(null);

  if (danhSach.length === 0)
    return <p className="text-[12.5px] italic text-grey-mid">{t('wallEmpty')}</p>;

  return (
    <div className="flex flex-col">
      {danhSach.map((em) => {
        const m = em.mucTieu;
        return (
          <div
            key={em.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-navy/[0.06] py-2 first:border-t-0"
          >
            <span className="min-w-[110px] text-[12.5px] font-extrabold text-navy">{em.ten}</span>

            {m ? (
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-grey-mid">
                {m.title} ·{' '}
                {t('fromTo', {
                  from: m.baseline ?? 0,
                  to: m.target_value,
                  unit: m.unit,
                  due: m.end_date,
                })}
              </span>
            ) : (
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold italic text-status-bad">
                {t('notSetYet')}
              </span>
            )}

            {m?.achieved_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                <Check size={11} strokeWidth={3} />
                {t('achieved')}
              </span>
            )}
            {m?.status === 'sent' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                <Clock size={11} strokeWidth={3} />
                {t('waiting')}
              </span>
            )}
            {m?.set_by === 'teacher' && (
              <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                {t('setByTeacher')}
              </span>
            )}

            <button
              type="button"
              onClick={() => setDangMo(em)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-navy/20 bg-white px-2.5 py-1 text-[11.5px] font-extrabold text-navy transition-colors hover:border-navy"
            >
              {m ? <Pencil size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
              {m ? t('edit') : t('setFor')}
            </button>

            {m && (
              <form
                action={xoaMucTieuCuaEm}
                onSubmit={(e) => {
                  if (!window.confirm(t('confirmDeleteFor', {ten: em.ten}))) e.preventDefault();
                }}
              >
                <input type="hidden" name="wig_id" value={m.id} />
                <input type="hidden" name="student_id" value={em.id} />
                <SubmitButton
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                  wrapClass="contents"
                >
                  <Trash2 size={13} strokeWidth={2.5} />
                </SubmitButton>
              </form>
            )}
          </div>
        );
      })}

      {dangMo && (
        <FormMucTieu
          studentId={dangMo.id}
          classId={classId}
          tenEm={dangMo.ten}
          wigLop={wigLop}
          dangSua={dangMo.mucTieu}
          laChinhEm={false}
          dayShort={dayShort}
          onClose={() => setDangMo(null)}
        />
      )}
    </div>
  );
}
