'use client';

import {useActionState, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Popup} from '@/components/ui/Popup';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold} from '@/components/ui/Field';
import {luuMucTieuCuaEm, type MucTieuState} from '@/app/[locale]/(dashboard)/student/actions';
import {nhipCuaMucTieu} from '@/lib/wig-nhip';
import {todayInVN} from '@/lib/dates';
import {kieuDonVi, coTrongDanhSach, DON_VI} from '@/lib/don-vi';

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

export type ViecCuaEm = {
  title: string;
  target_value: number;
  active_weekdays: number[] | null;
  /** 0110 — một lượt tick đáng bao nhiêu đơn vị. */
  unitPerTick?: number;
  /** 0110 — ô ngày là ô điền số. */
  nhapLuong?: boolean;
};

export type DangSua = {
  id: string;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  end_date: string;
  area: string;
  source_wig_id: string | null;
  viec: ViecCuaEm | null;
} | null;

export type WigLop = {id: string; area: string; title: string};

const DOW = [1, 2, 3, 4, 5, 6, 7];

export function FormMucTieu({
  studentId,
  classId,
  kind = 'academic',
  tenEm,
  wigLop,
  dangSua,
  laChinhEm,
  dayShort,
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
  dayShort: string[];
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const t = useTranslations('goal');
  const [state, formAction] = useActionState<MucTieuState, FormData>(luuMucTieuCuaEm, {ok: false});
  const [thu, setThu] = useState<number[]>(dangSua?.viec?.active_weekdays ?? [1, 3, 5]);

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
    due: dangSua?.end_date ?? '',
    viec: dangSua?.viec?.title ?? '',
    luong: dangSua?.viec?.target_value != null ? String(dangSua.viec.target_value) : '',
    upt: dangSua?.viec?.unitPerTick != null ? String(dangSua.viec.unitPerTick) : '1',
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
  const doiThu = (d: number) =>
    setThu((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)));

  // KIỂU ĐƠN VỊ (0110) quyết định bước ③ trông ra sao. Máy chủ tự suy lại từ đơn vị nên đây chỉ
  // là để bày đúng ô — không phải nguồn quyết định.
  const kieu = kieuDonVi(g.unit);
  // "Mỗi lần một khác" = ô điền số mỗi ngày; ngược lại = một chạm, mỗi chạm đáng `upt` đơn vị.
  const [moiLanKhac, setMoiLanKhac] = useState(Boolean(dangSua?.viec?.nhapLuong));
  // Mục tiêu cũ có thể mang đơn vị gõ tay không nằm trong danh sách — mở thẳng ô "Khác" cho nó,
  // đừng lặng lẽ xoá mất chữ em đã khai.
  const [khacDonVi, setKhacDonVi] = useState(
    Boolean(dangSua?.unit) && !coTrongDanhSach(dangSua?.unit),
  );
  // Chỉ tiêu TUẦN, tính theo ĐƠN VỊ của mục tiêu — không phải theo số lần.
  const moiTuan =
    kieu !== 'luong'
      ? thu.length
      : moiLanKhac
        ? Number(g.luong || 0)
        : thu.length * (Number(g.upt || 0) || 0);

  // NHỊP: quãng phải đi so với việc mỗi tuần. Tính ở đây để cảnh báo hiện NGAY LÚC EM ĐANG GÕ,
  // không đợi bấm Gửi rồi mới biết. Dùng chung lib/wig-nhip với phòng họp — một phép, một nguồn.
  const quang = Math.max(Number(g.target || 0) - Number(g.baseline || 0), 0);
  const tuanCon = g.due
    ? Math.max(Math.ceil((Date.parse(g.due) - Date.parse(todayInVN())) / 604800000), 0)
    : 0;
  const nhip = nhipCuaMucTieu({quang, moiTuan, tuanCon});

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
        {thu.map((d) => (
          <input key={d} type="hidden" name="viec_days" value={d} />
        ))}

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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1fr_1fr_1.4fr]">
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
                <select
                  id="mt-unit"
                  name="unit"
                  value={g.unit}
                  onChange={(e) => {
                    if (e.target.value === '__khac__') {
                      setKhacDonVi(true);
                      setG((p) => ({...p, unit: ''}));
                    } else setG((p) => ({...p, unit: e.target.value}));
                  }}
                  className={selectCls}
                >
                  <option value="">{t('unitPick')}</option>
                  {/* CHIA NHÓM ngay trong dropdown. Mười bốn đơn vị bày phẳng thì phải chọn xong,
                      đợi bước ③ đổi hình, mới đoán ra luật. Gom lại thì luật đọc được TRƯỚC khi
                      chọn — và đó chính là ba câu chủ dự án mô tả: "buổi thì 1 tick 1 buổi", "tiết
                      thì 1 tick bao nhiêu tiết", "điểm thì tự điền". */}
                  {(['luot', 'luong', 'do'] as const).map((k) => (
                    <optgroup key={k} label={t(`unitGroup_${k}`)}>
                      {DON_VI.filter((d) => d.kieu === k).map((d) => (
                        <option key={d.ma} value={d.ma}>
                          {d.ma}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__khac__">{t('unitOther')}</option>
                </select>
              )}
            </Field>
            <Field
              label={t('due')}
              htmlFor="mt-due"
              error={err('due_on')}
              className="col-span-2 sm:col-span-1"
            >
              <input
                id="mt-due"
                name="due_on"
                type="date"
                value={g.due}
                onChange={(e) => setG((p) => ({...p, due: e.target.value}))}
                className={ctlWithBorder(state.fieldError === 'due_on')}
              />
            </Field>
          </div>
        </div>

        {/* ③ Tuần này con làm gì. Bỏ trống được: khi ấy đây là đích ghi nhận ngoài (0101).
            ĐƠN VỊ ĐO LẠI (điểm, kg, cm) KHÔNG có bước này: cộng 7 điểm với 8 điểm ra 15 điểm là
            con số app không có quyền bày. Loại ấy ghi con số thật ở ô số đo mỗi tuần (0108). */}
        {kieu !== 'do' && (
        <div className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
          <p className="mb-2 text-[13px] font-extrabold text-navy">{t('step3')}</p>
          {/* Không còn `hint`. Câu cũ ("Để trống cũng được — xem dòng chữ nghiêng bên dưới") bắt
              em đọc một câu chỉ để được chỉ sang một câu khác, rồi câu kia lại dài bốn dòng. Ô này
              vốn đã không bắt buộc: bỏ trống thì bước ④ không hiện, gửi vẫn được. */}
          <Field label={t('workTitle')} htmlFor="mt-viec">
            <input
              id="mt-viec"
              name="viec_title"
              value={g.viec}
              onChange={(e) => setG((p) => ({...p, viec: e.target.value}))}
              placeholder={t('workPlaceholder')}
              className={inputCls}
            />
          </Field>

          {/* Ô "mấy lần/tuần" từng đứng ở đây. Bỏ hẳn: mỗi ngày chỉ tick được MỘT lượt
              (uq_lead_progress_daily, 0020), nên số lần mỗi tuần luôn đúng bằng số thứ được bật —
              hỏi thành hai chỗ chỉ tạo ra cơ hội cho chúng đá nhau ("chọn 5 thứ, đích 3 lần"). */}
          {g.viec && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[12px] font-extrabold text-navy">{t('whichDays')}</p>
              <div className="flex flex-wrap gap-1.5">
                {DOW.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => doiThu(d)}
                    aria-pressed={thu.includes(d)}
                    className={`grid h-9 w-11 cursor-pointer select-none place-items-center rounded-[10px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                      thu.includes(d)
                        ? 'border-transparent bg-gold text-navy'
                        : 'border-navy/15 bg-white text-navy/60 hover:border-navy'
                    }`}
                  >
                    {dayShort[i]}
                  </button>
                ))}
              </div>
              <p
                className={`mt-1.5 text-[12px] font-bold ${thu.length === 0 ? 'text-status-bad' : 'text-grey-mid'}`}
              >
                {thu.length === 0 ? t('pickADay') : t('perWeekCount', {n: thu.length})}
              </p>

              {/* KẾ HOẠCH CÓ TỰ MÂU THUẪN KHÔNG — nói ngay lúc em đang gõ.
                  Chuyện thật 13/08/2026: em đặt "từ 7 đến 9 tiết" (quãng 2) rồi giao cho mình 4
                  lần mỗi tuần, hạn bảy tuần sau. Nửa tuần là xong. App nhận nguyên, không nói một
                  chữ — rồi tick hai cái là vòng tròn nhảy 100% và nhìn như app hỏng, trong khi
                  phép tính đúng: kế hoạch sai từ lúc gõ. Cảnh báo, KHÔNG chặn — đây là mục tiêu
                  của em, app chỉ có quyền nói ra chỗ vênh. */}
              {nhip.qua_de && (
                <p className="mt-1.5 text-[12px] font-bold text-gold-text">
                  {t('paceTooEasy', {n: thu.length, can: nhip.tuanCan, con: tuanCon})}
                </p>
              )}
              {nhip.khong_kip && (
                <p className="mt-1.5 text-[12px] font-bold text-status-bad">
                  {t('paceTooHard', {n: moiTuan, can: nhip.tuanCan, con: tuanCon})}
                </p>
              )}

              {/* MỘT CÂU HỎI, HAI CÂU TRẢ LỜI (0110) — và đây đúng là hai ví dụ chủ dự án đưa:
                    · "10000 giờ học, 1 tick ngày = 3 giờ"  → trả lời 3   → vẫn MỘT CHẠM, mỗi chạm 3 giờ
                    · "5000 lead, thứ Hai điền 10 lead"     → "mỗi lần một khác" → Ô ĐIỀN SỐ
                  Bản trước hỏi "mỗi tuần bao nhiêu" — một con số thứ ba, không diễn đạt được vế
                  nào trong hai vế trên.
                  CHỈ HỎI KHI ĐÃ CÓ ĐƠN VỊ: chưa gõ đơn vị mà bày ô ra thì nhãn đọc thành "Mỗi lần
                  con làm được bao nhiêu ?" — một câu hỏi cụt. */}
              {kieu === 'luong' && g.unit && (
                <div className="mt-2.5 rounded-[12px] bg-navy/[0.04] p-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-navy">
                    <input
                      type="checkbox"
                      checked={moiLanKhac}
                      onChange={(e) => setMoiLanKhac(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-[var(--color-gold)]"
                    />
                    {t('eachTimeVaries')}
                  </label>

                  {moiLanKhac ? (
                    <div className="mt-2">
                      <Field label={t('weekAmount', {unit: g.unit})} htmlFor="mt-luong" error={err('viec_luong')}>
                        <input
                          id="mt-luong"
                          name="viec_luong"
                          type="number"
                          step="any"
                          min="0.01"
                          inputMode="decimal"
                          value={g.luong}
                          onChange={(e) => setG((p) => ({...p, luong: e.target.value}))}
                          className={ctlWithBorder(state.fieldError === 'viec_luong')}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Field label={t('perTick', {unit: g.unit})} htmlFor="mt-upt" error={err('viec_upt')}>
                        <input
                          id="mt-upt"
                          name="viec_upt"
                          type="number"
                          step="any"
                          min="0.01"
                          inputMode="decimal"
                          value={g.upt}
                          onChange={(e) => setG((p) => ({...p, upt: e.target.value}))}
                          className={ctlWithBorder(state.fieldError === 'viec_upt')}
                        />
                      </Field>
                      {/* Nói ra con số RÁP LẠI, đừng bắt em tự nhân. Đây cũng là chỗ em nhìn ra
                          kế hoạch của mình có hợp lý không trước khi bấm Gửi. */}
                      {moiTuan > 0 && (
                        <p className="mt-1.5 text-[12px] font-bold text-grey-mid">
                          {t('perTickSum', {n: thu.length, moi: g.upt, tuan: moiTuan, unit: g.unit})}
                        </p>
                      )}
                    </div>
                  )}
                  <input type="hidden" name="viec_nhap_luong" value={moiLanKhac ? '1' : ''} />
                </div>
              )}
            </div>
          )}
        </div>
        )}

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
                due: g.due,
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
            className="cursor-pointer text-[12px] font-extrabold text-grey-mid underline"
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </Popup>
  );
}
