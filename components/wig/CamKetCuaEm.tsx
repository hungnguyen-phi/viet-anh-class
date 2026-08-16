'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, CheckCircle2, Clock, Target} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, selectCls, btnGold} from '@/components/ui/Field';
import {datCamKetTuan} from '@/app/[locale]/(dashboard)/student/actions';
import {kieuDonVi} from '@/lib/don-vi';

// ════════════════════════════════════════════════════════════════════════════════════════════
// EM TỰ ĐẶT CAM KẾT CHO TUẦN TỚI — mắt xích bị đứt của cả vòng
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Cho tới 16/08/2026, cam kết tuần của một em CHỈ sinh ra được từ ô mà giáo viên gõ trong phòng
// họp. Chủ dự án bảo gỡ ô ấy ("phải là em đặt chứ"), và gỡ xong thì không còn đường nào cả — em
// viết cam kết thành một câu văn trong biên bản, còn bảng của cô đọc bảng `commitments`. Hai bên
// nói về hai thứ khác nhau, và suốt tuần không có gì để tick.
//
// Khối này là nửa cây cầu còn thiếu.
//
// ĐẶT Ở PHÒNG HỌP CỦA EM, ngay dưới phần nhìn lại tuần qua: đó đúng là nhịp mà PRD mô tả — cuối
// tuần nhìn lại, rồi hứa cho tuần tới, trong cùng một lần ngồi. Nhưng nó KHÔNG khoá theo buổi
// họp: chủ dự án đã chốt "điền sau cũng được, miễn là có để mà thực hiện, và gv duyệt sau".
//
// MỘT Ô, KHÔNG PHẢI HAI. Trần là 2 cam kết mỗi tuần, nhưng bày sẵn hai ô trống là mời người ta
// điền cho đủ. Đặt xong một cái thì khối này hiện lại để đặt tiếp — ai cần cái thứ hai sẽ tự làm,
// ai không cần thì không thấy một ô rỗng nào nhìn mình.
export function CamKetCuaEm({
  weekStart,
  weekLabel,
  daCo,
  dayShort,
  wigLop,
  wigMacDinh,
  tongDaCo,
  gon = false,
}: {
  /** Thứ Hai của tuần đang đặt cam kết cho. */
  weekStart: string;
  /** Nhãn tuần để nói rõ đang hứa cho tuần nào — "cam kết" mà không nói tuần nào là một câu lửng. */
  weekLabel: string;
  /** Cam kết em đã đặt cho tuần ấy, kèm trạng thái duyệt. */
  daCo: {id: string; title: string; status: string}[];
  /** Nhãn thứ trong tuần đã dịch sẵn ở máy chủ — T2…CN. */
  dayShort: string[];
  /**
   * Những trận đánh em chọn được cho tuần này: mục tiêu năm của LỚP, cộng mục tiêu năm của chính
   * em nếu có (0138). Lớp có ba bốn trận; mỗi tuần em hứa vào cái nào là quyền của em.
   */
  wigLop: {id: string; title: string; area: string; unit?: string | null}[];
  /** Mục tiêu chọn sẵn (thẻ mục tiêu năm mở form cho đúng mục tiêu ấy). */
  wigMacDinh?: string;
  /** Tổng cam kết em đã đặt tuần này (mọi mục tiêu) — trần 2 tính trên tổng, không trên `daCo`. */
  tongDaCo?: number;
  /** Bản gọn để đặt TRONG thẻ mục tiêu năm: không khung, tiêu đề nhỏ. */
  gon?: boolean;
}) {
  const t = useTranslations('meeting');
  const tg = useTranslations('goal');
  const tw = useTranslations('wig');
  const [state, formAction] = useActionState(datCamKetTuan, {ok: false});
  // Mặc định T2–T6: gần như luôn là thứ em định chọn, và ai muốn khác thì chạm hai cái là xong.
  const [thu, setThu] = useState<number[]>([1, 2, 3, 4, 5]);
  const doiThu = (d: number) =>
    setThu((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort((a, b) => a - b)));

  const conCho = (tongDaCo ?? daCo.length) < 2;
  // Bản gọn trong thẻ mục tiêu: chưa hứa gì vào mục tiêu này VÀ đã hết chỗ hứa (đủ 2 ở mục tiêu
  // khác) thì không có gì để bày — một tiêu đề trơ trọi chỉ gây thắc mắc.
  if (gon && daCo.length === 0 && !conCho) return null;

  // ĐƠN VỊ THEO MỤC TIÊU ĐANG CHỌN — quyết định việc này đo bằng gì (0110, xem datCamKetTuan).
  const [wigChon, setWigChon] = useState(wigMacDinh ?? wigLop[0]?.id ?? '');
  const donVi = wigLop.find((w) => w.id === wigChon)?.unit ?? '';
  const kieu = kieuDonVi(donVi);
  const [moiLanKhac, setMoiLanKhac] = useState(false);
  const [upt, setUpt] = useState('1');
  const [luong, setLuong] = useState('');
  const [tenViec, setTenViec] = useState('');
  const tongTuan = moiLanKhac ? Number(luong || 0) : thu.length * (Number(upt || 0) || 0);

  return (
    <section className={gon ? 'flex flex-col gap-2.5' : 'glass flex flex-col gap-3 rounded-[20px] p-[18px]'}>
      {/* KHÔNG GIẢNG VỀ GIỚI HẠN. Chủ dự án: "bạn không cần nói tôi giới hạn chỗ này, nó không
          tạo được nữa thì nó tự hiểu". Ô biến mất khi đã đủ hai — đó là câu trả lời rõ hơn mọi
          dòng chữ, và không chiếm chỗ của thứ em đang cần đọc. */}
      <h2 className={gon ? 'text-[11px] font-extrabold uppercase tracking-wide text-grey-mid' : 'font-display text-[16px] font-bold text-navy'}>
        {t('step3', {week: weekLabel})}
      </h2>

      {daCo.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {daCo.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 px-3 py-2"
            >
              <Target size={13} strokeWidth={2.5} className="shrink-0 text-navy/50" />
              <span className="min-w-0 flex-1 text-[13px] font-bold text-navy">{c.title}</span>
              {/* NÓI RÕ ĐANG CHỜ CÔ. Em gửi xong mà màn hình im lặng thì em tưởng chưa gửi được,
                  rồi gửi lại — và đâm vào trần 2 cam kết bằng một câu lỗi khó hiểu. */}
              {c.status === 'sent' ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                  <Clock size={10} strokeWidth={2.5} />
                  {tg('waiting')}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                  <CheckCircle2 size={10} strokeWidth={2.5} />
                  {tg('approved')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {conCho && (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="week" value={weekStart} />
          {/* TRẬN ĐÁNH CỦA TUẦN NÀY. Bỏ trống danh sách (lớp chưa đặt mục tiêu năm nào) thì không
              bày ô rỗng ra — máy chủ tự rơi về mục tiêu năm của chính em. */}
          {wigLop.length > 0 && (
            <Field
              label={tw('parentYear')}
              htmlFor="ck-em-wig"
              error={state.fieldError === 'wig_id' ? state.error : null}
            >
              <select
                id="ck-em-wig"
                name="wig_id"
                className={selectCls}
                value={wigChon}
                onChange={(e) => setWigChon(e.target.value)}
              >
                {wigLop.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label={t('commitmentNo', {n: daCo.length + 1})}
            htmlFor="ck-em-title"
            error={state.fieldError === 'title' ? state.error : null}
          >
            <input
              id="ck-em-title"
              name="title"
              maxLength={160}
              placeholder={t('commitmentPlaceholder')}
              className={ctlWithBorder(state.fieldError === 'title')}
            />
          </Field>
          {/* VIỆC ĐỂ TICK — TUỲ CHỌN, nhưng ngay tại đây.
              Một lời hứa không có việc để tick là lời hứa không ai đo được: cả tuần ô tick trống
              trơn, tới buổi họp không có gì để nói ngoài trí nhớ. Bắt em sang một màn khác để thêm
              việc là chỗ người ta bỏ dở — nhất là trẻ con, nhất là trên điện thoại. */}
          <Field
            label={t('thisWeekWork')}
            htmlFor="ck-em-viec"
            error={state.fieldError === 'viec_days' ? state.error : null}
          >
            <input
              id="ck-em-viec"
              name="viec_title"
              maxLength={120}
              value={tenViec}
              onChange={(e) => setTenViec(e.target.value)}
              placeholder={t('workPlaceholder')}
              className={ctlWithBorder(false)}
            />
          </Field>
          {/* ĐONG ĐẾM — chỉ hỏi khi có việc và đơn vị đếm theo LƯỢNG (bài, giờ, trang). Đơn vị theo
              lượt (buổi) thì mỗi ngày là một chạm, không hỏi thêm gì; đơn vị đo lại (điểm, kg) thì
              con số ghi ở ô số đo của mục tiêu, việc chỉ là nhắc làm. */}
          {tenViec && kieu === 'luong' && donVi && (
            <div className="rounded-[12px] bg-navy/[0.04] p-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold text-navy">
                <input
                  type="checkbox"
                  checked={moiLanKhac}
                  onChange={(e) => setMoiLanKhac(e.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-[var(--color-gold)]"
                />
                {tg('eachTimeVaries')}
              </label>
              <input type="hidden" name="viec_nhap_luong" value={moiLanKhac ? '1' : ''} />
              {moiLanKhac ? (
                <div className="mt-2">
                  <Field label={tg('weekAmount', {unit: donVi})} htmlFor="ck-em-luong" error={state.fieldError === 'viec_luong' ? state.error : null}>
                    <input
                      id="ck-em-luong"
                      name="viec_luong"
                      type="number"
                      step="any"
                      min="0.01"
                      inputMode="decimal"
                      value={luong}
                      onChange={(e) => setLuong(e.target.value)}
                      className={ctlWithBorder(state.fieldError === 'viec_luong')}
                    />
                  </Field>
                </div>
              ) : (
                <div className="mt-2">
                  <Field label={tg('perTick', {unit: donVi})} htmlFor="ck-em-upt" error={state.fieldError === 'viec_upt' ? state.error : null}>
                    <input
                      id="ck-em-upt"
                      name="viec_upt"
                      type="number"
                      step="any"
                      min="0.01"
                      inputMode="decimal"
                      value={upt}
                      onChange={(e) => setUpt(e.target.value)}
                      className={ctlWithBorder(state.fieldError === 'viec_upt')}
                    />
                  </Field>
                  {tongTuan > 0 && (
                    <p className="mt-1.5 text-[12px] font-bold text-grey-mid">
                      {tg('perTickSum', {n: thu.length, moi: upt, tuan: tongTuan, unit: donVi})}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {thu.map((d) => (
            <input key={d} type="hidden" name="viec_days" value={d} />
          ))}
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => doiThu(d)}
                aria-pressed={thu.includes(d)}
                aria-label={dayShort[d - 1]}
                className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[9px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                  thu.includes(d)
                    ? 'border-transparent bg-gold text-navy'
                    : 'border-navy/15 bg-white text-navy/60 hover:border-navy'
                }`}
              >
                {dayShort[d - 1]}
              </button>
            ))}
          </div>

          <SubmitButton className={`${btnGold} w-fit`} wrapClass="contents">
            {tg('send')}
          </SubmitButton>
        </form>
      )}

      {state.error && !state.fieldError && (
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
    </section>
  );
}
