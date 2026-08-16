'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder, selectCls, btnGold} from '@/components/ui/Field';
import {ONgayVN, ngayVN} from '@/components/ui/ONgayVN';
import {luuMucTieuCuaEm, xoaMucTieuCuaEm, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';
import {kieuDonVi, coTrongDanhSach, DON_VI} from '@/lib/don-vi';
import {ChonCuon} from '@/components/ui/ChonCuon';

// ════════════════════════════════════════════════════════════════════════════
// FORM ĐẶT MỤC TIÊU — ba câu hỏi, nằm trong một hộp thoại
// ════════════════════════════════════════════════════════════════════════════
//
// Tách khỏi MucTieuCuaCon vì nay có HAI chỗ mở đúng cái form này: màn của em, và bức tường WIG bên
// trang giáo viên (cô chọn tên em rồi đặt hộ). Một bản dùng chung để hai đường ghi không bao giờ
// lệch luật nhau — đây là chỗ quyết định `set_by`, và `set_by` là thước đo của cả chương trình.
//
// VÌ SAO LÀ HỘP THOẠI chứ không phải khối mở sẵn giữa trang: form chỉ dùng vài lần một năm, còn
// màn của em thì mở mỗi ngày. Để nó nằm sẵn giữa trang nghĩa là mỗi ngày em phải cuộn qua một form
// trống dài nửa màn hình mới tới việc hôm nay. Chủ dự án chốt 12/08/2026: "cho cái form thành cái
// popup là được rồi".

export type DangSua = {
  id: string;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  start_date?: string;
  end_date: string;
  area: string;
  source_wig_id: string | null;
} | null;

export type WigLop = {id: string; area: string; title: string};


export function FormMucTieu({
  studentId,
  classId,
  kind = 'academic',
  tenEm,
  wigLop,
  dangSua,
  laChinhEm,
  onClose,
  onDone,
}: {
  studentId: string;
  classId: string;
  /**
   * HỌC TẬP hay RIÊNG CỦA CON. Trước đây đóng cứng 'academic' ngay trong ô hidden, nên đường tạo
   * mục tiêu riêng — máy chủ nhận được, CSDL cho phép (wigs_em_uidx: 1 academic + 1 personal) —
   * không có một cái nút nào để đi tới.
   *
   * Mục tiêu RIÊNG không nối vào WIG lớp: wig_source_ck (0100) bắt source_wig_id phải null. Nên
   * bước ① không hỏi "góp vào trận nào của lớp" nữa — hỏi một câu mà mọi câu trả lời đều bị CSDL
   * từ chối là mời người dùng gõ vào một cái bẫy.
   */
  kind?: 'academic' | 'personal';
  /** Tên em — chỉ dùng khi cô đặt hộ, để tiêu đề hộp thoại nói rõ đang gõ cho AI. */
  tenEm?: string;
  wigLop: WigLop[];
  dangSua: DangSua;
  laChinhEm: boolean;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieuCuaEm, {ok: false});

  // MỤC TIÊU LỚP mà việc này góp sức vào — nay BẮT BUỘC với cả hai loại, và là nguồn duy nhất của
  // lĩnh vực. Mục tiêu riêng đang sửa thì không có `source_wig_id` để mở lại (CSDL bắt nó null),
  // nên rơi về rỗng và em chọn lại — một cú bấm, đổi lấy việc bốn vòng lĩnh vực đọc đúng.
  const [nguon, setNguon] = useState(dangSua?.source_wig_id ?? '');

  // Các ô rời rạc rất khó ráp lại thành một ý, nhất là với học sinh. Giữ giá trị ở đây để ghép
  // chúng thành MỘT CÂU HOÀN CHỈNH ngay dưới nút Gửi.
  const [g, setG] = useState({
    title: dangSua?.title ?? '',
    baseline: dangSua?.baseline != null ? String(dangSua.baseline) : '',
    target: dangSua?.target_value != null ? String(dangSua.target_value) : '',
    unit: dangSua?.unit ?? '',
    start: dangSua?.start_date ?? '',
    due: dangSua?.end_date ?? '',
  });
  const duCau = Boolean(g.title && g.target && g.unit && g.due);

  // Lưu xong thì ĐÓNG. Trước đây form cứ nằm mở sau khi gửi, nên màn hình có đồng thời một thẻ
  // "đã gửi cô xem" và một form còn nguyên chữ — không đọc ra được cái nào là thật.
  useEffect(() => {
    if (!state.ok) return;
    onDone?.(state.message ?? '');
    onClose();
    // Chỉ chạy khi kết quả từ máy chủ đổi; onClose/onDone là hàm mới mỗi lần render cha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);

  // KIỂU ĐƠN VỊ (0110) quyết định bước ③ trông ra sao. Máy chủ tự suy lại từ đơn vị nên đây chỉ
  // là để bày đúng ô — không phải nguồn quyết định.
  const kieu = kieuDonVi(g.unit);
  // Mục tiêu cũ có thể mang đơn vị gõ tay không nằm trong danh sách — mở thẳng ô "Khác" cho nó,
  // đừng lặng lẽ xoá mất chữ em đã khai.
  const [khacDonVi, setKhacDonVi] = useState(
    Boolean(dangSua?.unit) && !coTrongDanhSach(dangSua?.unit),
  );
  return (
    <Popup
      title={
        kind === 'personal'
          ? t('formTitlePersonal')
          : laChinhEm
          ? t('formTitle')
          : t('formTitleFor', {ten: tenEm ?? ''})
      }
      onClose={onClose}
      width="max-w-[620px]"
    >
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="kind" value={kind} />

        {state.error && !state.fieldError && (
          <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
            <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
            {state.error}
          </p>
        )}

        {/* ① Con muốn tiến bộ ở việc gì. */}
        <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
          <p className="mb-2 text-[13px] font-extrabold text-navy">
            {kind === 'personal' ? t('step1Personal') : t('step1')}
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label={t('what')} htmlFor="mt-title" error={err('title')}>
              <input
                id="mt-title"
                name="title"
                value={g.title}
                onChange={(e) => setG((p) => ({...p, title: e.target.value}))}
                placeholder={t('whatPlaceholder')}
                className={ctlWithBorder(state.fieldError === 'title')}
              />
            </Field>
            {/* HỎI CẢ VỚI MỤC TIÊU RIÊNG, và không còn lựa chọn "để trống".
                Lĩnh vực lấy từ đúng mục tiêu lớp em chọn ở đây — không hỏi em một câu riêng về
                lĩnh vực nữa (chủ dự án chốt 13/08/2026: cô đã khai đủ bốn lĩnh vực rồi). Với mục
                tiêu RIÊNG, máy chủ chỉ mượn lĩnh vực và bỏ liên kết đi: wig_source_ck bắt
                source_wig_id phải null với kind='personal'. */}
            <Field label={t('joinBattle')} htmlFor="mt-source" error={err('source_wig_id')}>
              <select
                id="mt-source"
                name="source_wig_id"
                value={nguon}
                onChange={(e) => setNguon(e.target.value)}
                className={selectCls}
              >
                <option value="">{t('pickBattle')}</option>
                {wigLop.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Lớp chưa có mục tiêu nào thì em không có gì để gắn vào. Nói thẳng ra và chỉ sang
              người làm được việc ấy — im lặng để em bấm Gửi rồi nhận một câu lỗi thì tệ hơn. */}
          {wigLop.length === 0 && (
            <p className="mt-2 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
              {t('noClassWig')}
            </p>
          )}

        </div>

        {/* ② "Từ X đến Y trước ngày nào" — công thức của canon, nằm gọn một hàng. */}
        <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
          <p className="mb-2 text-[13px] font-extrabold text-navy">{t('step2')}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Field label={t('now')} htmlFor="mt-baseline" error={err('baseline')}>
              <input
                id="mt-baseline"
                name="baseline"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={g.baseline}
                onChange={(e) => setG((p) => ({...p, baseline: e.target.value}))}
                placeholder="0"
                className={ctlWithBorder(state.fieldError === 'baseline')}
              />
            </Field>
            <Field label={t('to')} htmlFor="mt-target" error={err('target_value')}>
              <input
                id="mt-target"
                name="target_value"
                type="number"
                step="any"
                min="0.01"
                inputMode="decimal"
                value={g.target}
                onChange={(e) => setG((p) => ({...p, target: e.target.value}))}
                className={ctlWithBorder(state.fieldError === 'target_value')}
              />
            </Field>
            {/* ĐƠN VỊ CHỌN TỪ DANH SÁCH, không gõ tay.
                Gõ tay thì app phải ĐOÁN kiểu từ chuỗi chữ — "tiet" không dấu, "Bài" hoa — và đoán
                sai là hỏi sai câu hỏi tiếp theo. Tệ hơn: bỏ trống thì bước ③ không biết hỏi "mỗi
                lần bao nhiêu GÌ" nên im lặng bỏ luôn câu hỏi ấy, em điền xong mới bị đẩy ngược về
                đây. Chọn từ danh sách thì luật lộ ra ngay lúc chọn và không còn trạng thái trống.
                Vẫn có "Khác…" — danh sách không phủ hết mọi môn, mọi trường. */}
            <Field label={t('unit')} htmlFor="mt-unit" error={err('unit')}>
              {khacDonVi ? (
                <div className="flex gap-1.5">
                  <input
                    id="mt-unit"
                    name="unit"
                    value={g.unit}
                    onChange={(e) => setG((p) => ({...p, unit: e.target.value}))}
                    placeholder={t('unitPlaceholder')}
                    className={ctlWithBorder(state.fieldError === 'unit')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setKhacDonVi(false);
                      setG((p) => ({...p, unit: ''}));
                    }}
                    className="shrink-0 rounded-[10px] border-[1.5px] border-navy/20 px-2 text-[12px] font-extrabold text-navy"
                  >
                    {t('unitBack')}
                  </button>
                </div>
              ) : (
                <ChonCuon
                  id="mt-unit"
                  name="unit"
                  value={g.unit}
                  onChange={(v) => {
                    if (v === '__khac__') {
                      setKhacDonVi(true);
                      setG((p) => ({...p, unit: ''}));
                    } else setG((p) => ({...p, unit: v}));
                  }}
                  danhSach={DON_VI.map((d) => ({ma: d.ma}))}
                  chuaChon={t('unitPick')}
                  loi={state.fieldError === 'unit'}
                  cuoiDanhSach={{ma: '__khac__', nhan: t('unitOther')}}
                />
              )}
            </Field>
            {/* Không có htmlFor: đây là NHÓM ba ô, nhãn của nhóm đã gắn bằng role="group"
                bên trong <ONgayVN>. Trỏ htmlFor vào một id không tồn tại thì bấm vào nhãn
                không đưa được con trỏ đi đâu cả. */}
            {/* Cả một hàng riêng: ba ô ngày/tháng/năm cộng hai dấu gạch không nhét vừa một cột
                của lưới bốn cột — chữ trong ô bị cắt thành "Ng / Th / Nă". */}
            {/* KHOẢNG NGÀY — từ ngày nào tới ngày nào (chủ dự án 16/08/2026: "phải chọn lịch từ ngày
                tháng năm nào đến ngày tháng năm nào, chứ ko phải mỗi ngày cuối"). Máy chủ kẹp cả
                hai đầu trong năm học. */}
            <Field label={t('startOn')} error={err('start_on')} className="col-span-2 sm:col-span-3">
              <ONgayVN
                name="start_on"
                nhan={t('startOn')}
                value={g.start}
                loi={state.fieldError === 'start_on'}
                onChange={(iso) => setG((p) => ({...p, start: iso}))}
              />
            </Field>
            <Field label={t('due')} error={err('due_on')} className="col-span-2 sm:col-span-3">
              <ONgayVN
                name="due_on"
                nhan={t('due')}
                value={g.due}
                min={g.start || undefined}
                loi={state.fieldError === 'due_on'}
                onChange={(iso) => setG((p) => ({...p, due: iso}))}
              />
            </Field>
          </div>
        </div>

        {/* BƯỚC ③ "TUẦN NÀY CON LÀM GÌ" ĐÃ RỜI KHỎI ĐÂY (0121, dọn nốt 16/08/2026). Máy chủ đã
            thôi đọc các ô ấy từ 0121 mà form vẫn bày ra: em điền một việc, bấm Gửi, và việc ấy
            đi vào hư không. Việc tuần nay đặt ở CamKetCuaEm, treo dưới cam kết của từng tuần. */}
        {kieu === 'do' && g.unit && (
          <p className="rounded-[10px] bg-navy/[0.05] px-2.5 py-2 text-[12px] font-semibold text-grey-mid">
            {t('unitMeasured', {unit: g.unit})}
          </p>
        )}

        {/* CÂU MỤC TIÊU — ráp từ chính những ô em vừa gõ. */}
        <div
          className={`rounded-[14px] px-3.5 py-3 text-[13px] font-bold leading-relaxed ${
            duCau ? 'bg-gold/[0.14] text-navy' : 'bg-navy/[0.04] italic text-grey-mid'
          }`}
        >
          {duCau
            ? t('preview', {
                what: g.title,
                from: g.baseline || '0',
                to: g.target,
                unit: g.unit,
                due: ngayVN(g.due),
              })
            : t('previewEmpty')}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className={btnGold} wrapClass="contents">
            {laChinhEm ? t('send') : t('saveForStudent')}
          </SubmitButton>
          <button
            type="button"
            onClick={onClose}
            // Vùng chạm ≥24px: chữ vẫn 12px như cũ, chỉ nới chỗ ngón tay đặt vào. Nút chữ trần
            // cao đúng bằng dòng chữ (~16px) là dưới ngưỡng, mà đây là màn các em bấm trên điện
            // thoại — hụt vài pixel là bấm ba lần mới trúng.
            className="inline-flex min-h-[24px] cursor-pointer items-center py-1 text-[12px] font-extrabold text-grey-mid underline"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
      {/* XOÁ — chữ nhỏ ở góc form sửa, không đứng lộ ngoài thẻ (chủ dự án 16/08/2026). Form riêng vì
          không lồng form; máy chủ và RLS quyết có xoá được không. */}
      {dangSua && laChinhEm && (
        <form
          action={xoaMucTieuCuaEm}
          className="mt-2 flex justify-end"
          onSubmit={(e) => {
            if (!window.confirm(t('confirmDelete'))) e.preventDefault();
          }}
        >
          <input type="hidden" name="wig_id" value={dangSua.id} />
          <input type="hidden" name="student_id" value={studentId} />
          <SubmitButton
            className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[11.5px] font-extrabold text-status-bad underline"
            wrapClass="contents"
          >
            <Trash2 size={12} strokeWidth={2.5} />
            {t('deleteGoal')}
          </SubmitButton>
        </form>
      )}
    </Popup>
  );
}
