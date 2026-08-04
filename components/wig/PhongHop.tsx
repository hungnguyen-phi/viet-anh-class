'use client';

import {useActionState, useState, type ChangeEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle2, Minus, Plus, Trash2, X} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold, labelCls} from '@/components/ui/Field';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {ketThucBuoiHop, xoaBienBan} from '@/app/[locale]/(dashboard)/wig/hop/actions';

// ════════════════════════════════════════════════════════════════════════════
// PHÒNG HỌP WIG — ba bước, một nút, một lần lưu.
// ════════════════════════════════════════════════════════════════════════════
//
// Nhịp 4DX của một buổi họp WIG có đúng ba nhịp, và bản này bày ra đúng ba nhịp ấy theo thứ tự:
//
//   1. Tuần vừa rồi lớp làm được gì   → chấm thắng/thua, ghi lý do, nhìn từng em
//   2. Cam kết của lớp                → một câu cả lớp hứa với nhau
//   3. Mục tiêu tuần tới              → điền ở đây là TẠO LUÔN mục tiêu tuần mới
//
// Bước 3 là thay đổi lớn nhất. Trước đây "kế hoạch tuần sau" là một ô chữ tự do trong biên bản,
// viết xong nằm im — rồi tuần sau giáo viên phải vào trang WIG tạo lại một mục tiêu tuần từ đầu,
// gõ lại đúng những thứ vừa bàn. Hai lần nhập cho một quyết định, và không có gì nối chúng lại:
// biên bản ghi một đằng, mục tiêu tạo một nẻo, không ai đối chiếu. Nay điền một lần là xong.
//
// MỌI Ô ĐỀU CONTROLLED. Một buổi họp có thể gõ vào đây vài trăm chữ; React reset form sau khi
// action chạy xong, nên ô không controlled là mất sạch chữ chỉ vì server trả về một câu lỗi.

export type ViecTuanQua = {
  id: string;
  title: string;
  ketQua: string; // "18/30 phút" — máy đếm, không sửa được ở đây
  daGop: number;
  siSo: number;
  verdict: 'win' | 'lose' | null;
  note: string;
  // Lúc mở trang, việc này ĐÃ có ghi nhận hay chưa — quyết định chuyện xoá (xem ketThucBuoiHop).
  daCo: boolean;
};

export type EmTrongTuan = {id: string; ten: string; lam: number; can: number};
export type WigOption = {id: string; title: string};
export type ViecMau = {
  title: string;
  target: string;
  unit: string;
  upt: string;
  days: number[];
};

const DOW = [1, 2, 3, 4, 5, 6, 7] as const;

export function PhongHop({
  classId,
  hopStart,
  hopLabel,
  hopRange,
  dichLabel,
  dichRange,
  viecTuanQua,
  tungEm,
  loiHuaTruoc,
  nhanTuanTruoc,
  chiemNghiemCu,
  camKetCu,
  mucTieuDaCo,
  thangHienCo,
  namHienCo,
  thangLabelCanTao,
  viecMau,
  dayShort,
  canManage,
  daCoBienBan,
  quayVe,
}: {
  classId: string;
  hopStart: string;
  hopLabel: string;
  hopRange: string;
  dichLabel: string;
  dichRange: string;
  viecTuanQua: ViecTuanQua[];
  tungEm: EmTrongTuan[];
  loiHuaTruoc: string | null;
  nhanTuanTruoc: string;
  chiemNghiemCu: string;
  camKetCu: string;
  // Tuần tới đã có mục tiêu rồi thì bước 3 chỉ hiện nó ra, không đẻ thêm cái thứ hai.
  mucTieuDaCo: {title: string; target: number; unit: string} | null;
  // Mục tiêu tháng phủ tuần tới. Rỗng = thiếu mắt xích, phải tạo ngay trong bước 3.
  thangHienCo: WigOption[];
  namHienCo: WigOption[];
  thangLabelCanTao: string;
  viecMau: ViecMau[];
  dayShort: string[];
  canManage: boolean;
  // Tuần này đã có biên bản chưa — quyết định có bày nút gỡ hay không. Bày nút gỡ khi chưa có gì
  // để gỡ là mời người ta bấm một nút chỉ biết báo lỗi.
  daCoBienBan: boolean;
  // Đường về trang WIG. null với ban giám hiệu — họ KHÔNG vào được /wig, nên vẽ một liên kết tới
  // đó là vẽ một cái cửa dẫn thẳng tới màn hình "bạn không có quyền".
  quayVe: {pathname: '/wig'; query: Record<string, string>} | null;
}) {
  const t = useTranslations('meeting');
  const tw = useTranslations('wig');
  const [state, formAction] = useActionState(ketThucBuoiHop, {ok: false});

  // ── MỘT KHO GIÁ TRỊ CHO TẤT CẢ Ô ─────────────────────────────────────────────────────────
  const [v, setV] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {
      chiem_nghiem: chiemNghiemCu,
      cam_ket: camKetCu,
      mt_title: '',
      mt_baseline: '',
      mt_target: '',
      mt_unit: '',
      mt_parent: thangHienCo[0]?.id ?? '',
      thang_parent: namHienCo[0]?.id ?? '',
      thang_title: '',
      thang_target: '',
      thang_unit: '',
    };
    for (const r of viecTuanQua) {
      o[`verdict_${r.id}`] = r.verdict ?? '';
      o[`note_${r.id}`] = r.note;
    }
    return o;
  });
  const set = (k: string, val: string) => setV((p) => ({...p, [k]: val}));
  const oNhap = (k: string) => ({
    value: v[k] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(k, e.target.value),
  });

  // ── DÒNG VIỆC CHO TUẦN TỚI ───────────────────────────────────────────────────────────────
  // Mang sẵn việc của tuần vừa rồi sang: 4DX bảo thước đo dẫn dắt phải bền, đổi mỗi tuần thì
  // không đo được gì. Nhưng vẫn sửa và xoá được — mang sẵn là gợi ý, không phải ép.
  const [dong, setDong] = useState<{k: string; days: number[]}[]>(() =>
    viecMau.map((m, i) => ({k: `m${i}`, days: m.days})),
  );
  const [viecVal, setViecVal] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    viecMau.forEach((m, i) => {
      o[`viec_m${i}_title`] = m.title;
      o[`viec_m${i}_target`] = m.target;
      o[`viec_m${i}_unit`] = m.unit;
      o[`viec_m${i}_upt`] = m.upt;
    });
    return o;
  });
  const [demMoi, setDemMoi] = useState(0);
  const setViec = (k: string, val: string) => setViecVal((p) => ({...p, [k]: val}));
  const oViec = (k: string) => ({
    value: viecVal[k] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement>) => setViec(k, e.target.value),
  });
  const doiThu = (k: string, d: number) =>
    setDong((p) =>
      p.map((r) =>
        r.k === k
          ? {...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort()}
          : r,
      ),
    );
  const themDong = () => {
    const k = `n${demMoi}`;
    setDemMoi((n) => n + 1);
    setDong((p) => [...p, {k, days: [1, 2, 3, 4, 5]}]);
    setViecVal((p) => ({...p, [`viec_${k}_upt`]: '1'}));
  };
  const xoaDong = (k: string) => setDong((p) => p.filter((r) => r.k !== k));

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const canTaoThang = thangHienCo.length === 0 && namHienCo.length > 0;
  const thieuNam = thangHienCo.length === 0 && namHienCo.length === 0;

  const buoc = (so: number, tieuDe: string, phu?: string) => (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 font-display text-[16px] font-bold text-navy">
        {/* aria-hidden: con số là dấu thứ tự nhìn bằng mắt. Để nó trong tên tiếp cận thì trình
            đọc màn hình đọc ra "1Tuần W31-2026 lớp làm được gì" — dính liền, khó hiểu. */}
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy font-display text-[13px] font-black text-white"
        >
          {so}
        </span>
        {tieuDe}
      </h2>
      {phu && <p className="ml-9 mt-0.5 text-[11.5px] font-semibold leading-relaxed text-grey-mid">{phu}</p>}
    </div>
  );

  // Ba nút tròn: thắng · thua · CHƯA CHẤM. Nút thứ ba bắt buộc phải có — radio đã chọn thì HTML
  // không có cách bỏ chọn, thiếu nó là bấm nhầm "thắng" một lần rồi kẹt luôn.
  const nutCham = (id: string, gt: 'win' | 'lose' | '') => {
    const dangChon = (v[`verdict_${id}`] ?? '') === gt;
    const mau =
      gt === 'win'
        ? dangChon
          ? 'border-transparent bg-success text-white'
          : 'border-success/30 text-success/40 hover:border-success/60'
        : gt === 'lose'
          ? dangChon
            ? 'border-transparent bg-status-bad text-white'
            : 'border-status-bad/30 text-status-bad/40 hover:border-status-bad/60'
          : dangChon
            ? 'border-navy/40 bg-navy/[0.08] text-navy'
            : 'border-navy/15 text-grey-soft hover:border-navy/40';
    const nhan = gt === 'win' ? t('verdictWin') : gt === 'lose' ? t('verdictLose') : t('verdictNone');
    return (
      <label className="cursor-pointer" title={nhan}>
        <input
          type="radio"
          name={`verdict_${id}`}
          value={gt}
          checked={dangChon}
          onChange={() => set(`verdict_${id}`, gt)}
          disabled={!canManage}
          className="peer sr-only"
          aria-label={nhan}
        />
        <span
          className={`grid h-8 w-8 place-items-center rounded-full border-[1.5px] transition-all ${mau} peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40`}
        >
          {gt === 'win' ? (
            <Check size={15} strokeWidth={3} />
          ) : gt === 'lose' ? (
            <X size={15} strokeWidth={3} />
          ) : (
            <Minus size={14} strokeWidth={3} />
          )}
        </span>
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-4">
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="hop_start" value={hopStart} />
      <input type="hidden" name="hop_label" value={hopLabel} />
      <input type="hidden" name="dich_label" value={dichLabel} />

      {/* ══ BƯỚC 1 ══ */}
      <section className="glass rounded-[20px] p-[18px]">
        {buoc(1, t('step1', {week: hopLabel}), t('step1Hint', {range: hopRange}))}

        {/* Nhịp 4DX mở đầu bằng "tuần trước hứa gì" — đặt TRƯỚC bảng để đọc theo đúng thứ tự ấy. */}
        {loiHuaTruoc && (
          <div className="mb-3 flex flex-wrap items-start gap-2 rounded-[14px] border-[1.5px] border-gold-deep/25 bg-gold/[0.12] px-3.5 py-2.5">
            <ArrowRight size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-gold-deep" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-gold-text">
                {t('promisedLastWeek', {week: nhanTuanTruoc})}
              </span>
              <p className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-navy">{loiHuaTruoc}</p>
            </div>
          </div>
        )}

        {viecTuanQua.length === 0 ? (
          <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-4 text-center text-[12.5px] font-semibold italic leading-relaxed text-grey-mid">
            {t('noWorkThatWeek', {week: hopLabel})}
          </p>
        ) : (
          <>
            {/* Cuộn ngang trong khung riêng — trang không được cuộn ngang (luật của dự án). */}
            <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
              <table className="w-full min-w-[680px] border-collapse">
                <thead>
                  <tr className="bg-navy/[0.03]">
                    {[t('colWork'), t('colResult', {week: hopLabel}), t('colVerdict'), t('colLesson')].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid ${
                            i >= 1 && i <= 2 ? 'text-center' : 'text-left'
                          } ${i === 0 ? 'sticky left-0 z-10 bg-white' : ''}`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {viecTuanQua.map((r) => (
                    <tr key={r.id} className="border-t border-navy/[0.07] align-top">
                      {/* Tên việc GHIM TRÁI: bảng rộng 680px nên trên điện thoại phải cuộn ngang,
                          và nếu tên trôi mất thì người ta gõ vào ô "Rút ra" mà không còn biết
                          mình đang viết cho việc nào. */}
                      <td className="sticky left-0 z-10 bg-white px-3 py-2.5">
                        <span className="text-[13px] font-bold text-navy">{r.title}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-grey-mid">
                          {t('joinedCount', {n: r.daGop, total: r.siSo})}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-[13px] font-extrabold tabular-nums text-navy">
                        {r.ketQua}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {nutCham(r.id, 'win')}
                          {nutCham(r.id, 'lose')}
                          {nutCham(r.id, '')}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {/* Ảnh chụp lúc mở trang: dòng này lúc ấy ĐÃ có ghi nhận hay chưa. Server
                            chỉ xoá những dòng người bấm Lưu THẬT SỰ nhìn thấy rồi xoá đi — không
                            có nó thì thầy A bấm Lưu là xoá mất ghi chú cô B vừa ghi, không báo. */}
                        {r.daCo && <input type="hidden" name={`co_${r.id}`} value="1" />}
                        <textarea
                          name={`note_${r.id}`}
                          aria-label={t('colLesson') + ' — ' + r.title}
                          {...oNhap(`note_${r.id}`)}
                          placeholder={t('lessonPlaceholder')}
                          disabled={!canManage}
                          rows={2}
                          className="w-full min-w-[180px] resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-navy outline-none transition-colors focus:border-navy disabled:bg-navy/[0.03]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TỪNG EM. Tổng cả lớp "25/30" không cho biết đó là cả lớp làm đều hay vài em gánh
                phần còn lại; buổi họp cần trả lời "em nào chưa làm", nên em thấp nhất đứng đầu. */}
            {tungEm.length > 0 && (
              <div className="mt-3.5">
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h3 className="font-display text-[13.5px] font-bold text-navy">
                    {t('perStudent', {week: hopLabel})}
                  </h3>
                  {tungEm.filter((e) => e.lam === 0).length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                      <AlertTriangle size={11} strokeWidth={2.5} />
                      {t('noneYet', {n: tungEm.filter((e) => e.lam === 0).length})}
                    </span>
                  )}
                </div>
                <div className="flex flex-col rounded-[14px] border-[1.5px] border-navy/10 px-3 py-1">
                  {tungEm.map((e) => {
                    const pct = e.can > 0 ? Math.round((e.lam / e.can) * 100) : 0;
                    return (
                      <div key={e.id} className="flex items-center gap-3 border-t border-navy/[0.07] py-2 first:border-t-0">
                        <Link
                          href={`/student/${e.id}`}
                          className="block min-w-0 flex-1 truncate py-1 text-[12.5px] font-bold text-navy hover:underline"
                        >
                          {e.ten}
                        </Link>
                        <span className="h-[7px] w-[56px] shrink-0 overflow-hidden rounded-[4px] bg-navy/[0.08] sm:w-[120px]">
                          <span
                            className="block h-full rounded-[4px]"
                            style={{
                              width: `${pct}%`,
                              background:
                                e.lam === 0
                                  ? 'var(--color-status-bad)'
                                  : pct >= 80
                                    ? 'var(--color-success)'
                                    : 'var(--color-gold-mid)',
                            }}
                          />
                        </span>
                        <span className="w-[58px] shrink-0 text-right text-[12.5px] font-extrabold tabular-nums text-navy">
                          {e.lam}/{e.can}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ══ BƯỚC 2 ══ */}
      <section className="glass rounded-[20px] p-[18px]">
        {buoc(2, t('step2'), t('step2Hint'))}
        <div className="flex flex-col gap-3">
          <Field label={t('reflection')} htmlFor="chiem-nghiem">
            <textarea
              id="chiem-nghiem"
              name="chiem_nghiem"
              {...oNhap('chiem_nghiem')}
              disabled={!canManage}
              rows={2}
              placeholder={t('reflectionPlaceholder')}
              className="w-full resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-colors focus:border-navy disabled:bg-navy/[0.03]"
            />
          </Field>
          <Field label={t('commitments')} htmlFor="cam-ket" hint={t('commitmentsHint')}>
            <textarea
              id="cam-ket"
              name="cam_ket"
              {...oNhap('cam_ket')}
              disabled={!canManage}
              rows={2}
              placeholder={t('commitmentsPlaceholder')}
              className="w-full resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-colors focus:border-navy disabled:bg-navy/[0.03]"
            />
          </Field>
        </div>
      </section>

      {/* ══ BƯỚC 3 ══ */}
      {canManage && (
        <section className="glass rounded-[20px] p-[18px]">
          {buoc(3, t('step3', {week: dichLabel}), t('step3Hint', {range: dichRange}))}

          {mucTieuDaCo ? (
            <div className="rounded-[14px] border-[1.5px] border-success/30 bg-success/[0.08] p-3.5">
              <p className="text-[12.5px] font-bold text-navy">
                {t('goalAlready', {
                  week: dichLabel,
                  title: mucTieuDaCo.title,
                  target: mucTieuDaCo.target,
                  unit: mucTieuDaCo.unit,
                })}
              </p>
              {quayVe && (
                <Link
                  href={quayVe}
                  className="mt-1.5 inline-flex min-h-[24px] items-center gap-1 text-[12px] font-extrabold text-navy underline"
                >
                  {t('goalEditThere')}
                  <ArrowRight size={12} strokeWidth={2.5} />
                </Link>
              )}
            </div>
          ) : thieuNam ? (
            <div className="rounded-[14px] border-[1.5px] border-dashed border-navy/20 p-4 text-center">
              <p className="text-[12.5px] font-bold text-navy">{t('needYearWig')}</p>
              {quayVe && (
                <Link
                  href={quayVe}
                  className="mt-1.5 inline-flex min-h-[24px] items-center gap-1 text-[12px] font-extrabold text-navy underline"
                >
                  {t('goToWig')}
                  <ArrowRight size={12} strokeWidth={2.5} />
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Thiếu mắt xích THÁNG thì tạo luôn ở đây. Đá người đang họp sang trang khác rồi
                  bắt quay lại là cách chắc chắn nhất để buổi họp đứt mạch. */}
              {canTaoThang && (
                <div className="rounded-[14px] border-[1.5px] border-gold/50 bg-gold/[0.08] p-3">
                  <p className="mb-2.5 text-[11.5px] font-semibold leading-relaxed text-navy">
                    {t('needMonthWig', {month: thangLabelCanTao})}
                  </p>
                  <input type="hidden" name="thang_can" value="1" />
                  <input type="hidden" name="thang_label" value={thangLabelCanTao} />
                  <div className="flex flex-col gap-2.5">
                    <Field label={tw('parentYear')} htmlFor="thang-parent" error={err('thang_parent_wig_id')}>
                      <select id="thang-parent" name="thang_parent" {...oNhap('thang_parent')} className={selectCls}>
                        {namHienCo.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr_1fr]">
                      <Field label={tw('wigTitle')} htmlFor="thang-title" error={err('thang_title')} className="col-span-2 sm:col-span-1">
                        <input
                          id="thang-title"
                          name="thang_title"
                          {...oNhap('thang_title')}
                          className={ctlWithBorder(state.fieldError === 'thang_title')}
                        />
                      </Field>
                      <Field label={tw('targetTo')} htmlFor="thang-target" error={err('thang_target_value')}>
                        <input
                          id="thang-target"
                          name="thang_target"
                          type="number"
                          step="any"
                          min="0.01"
                          inputMode="decimal"
                          {...oNhap('thang_target')}
                          className={ctlWithBorder(state.fieldError === 'thang_target_value')}
                        />
                      </Field>
                      <Field label={tw('unit')} htmlFor="thang-unit" error={err('thang_unit')}>
                        <input id="thang-unit" name="thang_unit" {...oNhap('thang_unit')} className={inputCls} />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {!canTaoThang && (
                <Field label={tw('parentMonth')} htmlFor="mt-parent" error={err('mt_parent_wig_id')}>
                  <select id="mt-parent" name="mt_parent" {...oNhap('mt_parent')} className={selectCls}>
                    {thangHienCo.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1fr_1fr_1.2fr]">
                <Field label={tw('wigTitle')} htmlFor="mt-title" error={err('mt_title')} className="col-span-2 sm:col-span-1">
                  <input
                    id="mt-title"
                    name="mt_title"
                    {...oNhap('mt_title')}
                    placeholder={tw('wigTitlePlaceholder')}
                    className={ctlWithBorder(state.fieldError === 'mt_title')}
                  />
                </Field>
                <Field label={tw('baseline')} htmlFor="mt-baseline" error={err('mt_baseline')}>
                  <input
                    id="mt-baseline"
                    name="mt_baseline"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder="0"
                    {...oNhap('mt_baseline')}
                    className={ctlWithBorder(state.fieldError === 'mt_baseline')}
                  />
                </Field>
                <Field label={tw('targetTo')} htmlFor="mt-target" error={err('mt_target_value')}>
                  <input
                    id="mt-target"
                    name="mt_target"
                    type="number"
                    step="any"
                    min="0.01"
                    inputMode="decimal"
                    {...oNhap('mt_target')}
                    className={ctlWithBorder(state.fieldError === 'mt_target_value')}
                  />
                </Field>
                <Field label={tw('unit')} htmlFor="mt-unit" error={err('mt_unit')} className="col-span-2 sm:col-span-1">
                  <input
                    id="mt-unit"
                    name="mt_unit"
                    {...oNhap('mt_unit')}
                    placeholder={tw('unitPlaceholder')}
                    className={ctlWithBorder(state.fieldError === 'mt_unit')}
                  />
                </Field>
              </div>

              <div>
                <span className={labelCls}>{tw('workToTick')}</span>
                {err('viec') && (
                  <p className="mb-2 inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
                    <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                    {err('viec')}
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {dong.map((r) => (
                    <div key={r.k} className="rounded-[12px] border-[1.5px] border-navy/10 p-2.5">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1.2fr_auto]">
                        <Field label={tw('leadTitle')} htmlFor={`v-${r.k}-t`} className="col-span-2 sm:col-span-1">
                          <input id={`v-${r.k}-t`} name={`viec_${r.k}_title`} {...oViec(`viec_${r.k}_title`)} className={inputCls} />
                        </Field>
                        <Field label={tw('target')} htmlFor={`v-${r.k}-m`}>
                          <input
                            id={`v-${r.k}-m`}
                            name={`viec_${r.k}_target`}
                            type="number"
                            step="any"
                            min="0.01"
                            inputMode="decimal"
                            {...oViec(`viec_${r.k}_target`)}
                            className={inputCls}
                          />
                        </Field>
                        <Field label={tw('unit')} htmlFor={`v-${r.k}-u`}>
                          <input id={`v-${r.k}-u`} name={`viec_${r.k}_unit`} {...oViec(`viec_${r.k}_unit`)} className={inputCls} />
                        </Field>
                        <Field label={tw('unitPerTick')} htmlFor={`v-${r.k}-p`}>
                          <input
                            id={`v-${r.k}-p`}
                            name={`viec_${r.k}_upt`}
                            type="number"
                            step="any"
                            min="0.01"
                            inputMode="decimal"
                            {...oViec(`viec_${r.k}_upt`)}
                            className={inputCls}
                          />
                        </Field>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => xoaDong(r.k)}
                            aria-label={tw('deleteLead')}
                            className="ctl-h grid w-11 cursor-pointer place-items-center rounded-[10px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.06] text-status-bad transition-all hover:bg-status-bad/[0.14]"
                          >
                            <Trash2 size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className={labelCls}>{tw('weekdays')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {DOW.map((d, i) => (
                            <label key={d} className="cursor-pointer">
                              <input
                                type="checkbox"
                                name={`viec_${r.k}_days`}
                                value={d}
                                checked={r.days.includes(d)}
                                onChange={() => doiThu(r.k, d)}
                                className="peer sr-only"
                              />
                              <span className="grid h-9 w-11 select-none place-items-center rounded-[10px] border-[1.5px] border-navy/15 bg-white text-[11.5px] font-extrabold text-navy/60 transition-all hover:border-navy peer-checked:border-transparent peer-checked:bg-gold peer-checked:text-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy/40">
                                {dayShort[i]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={themDong}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed border-navy/25 px-3 py-2.5 text-[12.5px] font-extrabold text-navy/60 transition-all hover:border-navy/50 hover:bg-navy/[0.03] hover:text-navy"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    {tw('addWork')}
                  </button>
                </div>
                {viecMau.length > 0 && (
                  <p className="mt-2 text-[11px] font-semibold italic text-grey-mid">{t('carriedOver')}</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ══ MỘT NÚT ══ */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-navy/[0.04] p-4">
          <span className="min-w-0 flex-1 text-[11.5px] font-semibold leading-relaxed text-grey-mid">
            {t('finishHint', {week: hopLabel})}
          </span>
          <SubmitButton className={btnGold} wrapClass="contents">
            {t('finish')}
          </SubmitButton>
        </div>
      )}

      {state.error && !state.fieldError && (
        <p className="inline-flex items-start gap-1.5 rounded-[12px] bg-status-bad/[0.08] px-3 py-2.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={15} strokeWidth={2.5} className="mt-px shrink-0" />
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-success/[0.10] px-3 py-2.5">
          <CheckCircle2 size={15} strokeWidth={2.5} className="shrink-0 text-success" />
          <span className="text-[13px] font-bold text-success-dark">{state.message}</span>
          {quayVe && (
            <Link href={quayVe} className="ml-auto inline-flex min-h-[24px] items-center gap-1 text-[12.5px] font-extrabold text-navy underline">
              {t('backToWig')}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          )}
        </div>
      )}
    </form>

    {/* GỠ BIÊN BẢN — đường lùi cho một việc một chiều.
        Ghi nhận buổi họp là thứ khoá tick của tuần đó (0081). Bấm ← quá tay một nhịp rồi lưu là
        khoá tick của tuần lớp đang làm dở, và các em lập tức không tick được mà không hiểu vì
        sao. Form RIÊNG, không lồng trong form trên: HTML không cho lồng form, và gộp chung thì
        một cái nút xoá đứng cạnh nút Lưu là công thức để bấm nhầm.
        Đặt cuối trang, chữ nhỏ: đây là việc hiếm, không phải việc chính. */}
    {canManage && daCoBienBan && <NutGoBienBan classId={classId} hopStart={hopStart} hopLabel={hopLabel} />}
    </div>
  );
}

function NutGoBienBan({classId, hopStart, hopLabel}: {classId: string; hopStart: string; hopLabel: string}) {
  const t = useTranslations('meeting');
  const [state, formAction] = useActionState(xoaBienBan, {ok: false});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 border-t border-navy/[0.08] pt-3">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="hop_start" value={hopStart} />
      <input type="hidden" name="hop_label" value={hopLabel} />
      <span className="mr-auto text-[11px] font-semibold italic leading-relaxed text-grey-mid">
        {t('undoHint', {week: hopLabel})}
      </span>
      {state.error && (
        <span className="text-[11.5px] font-bold text-status-bad">{state.error}</span>
      )}
      {state.ok && state.message && (
        <span className="text-[11.5px] font-bold text-success-dark">{state.message}</span>
      )}
      <ConfirmButton
        message={t('confirmUndo', {week: hopLabel})}
        label={t('undo', {week: hopLabel})}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.06] px-3 py-2 text-[12px] font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.14]"
      >
        <Trash2 size={13} strokeWidth={2.5} />
        {t('undo', {week: hopLabel})}
      </ConfirmButton>
    </form>
  );
}
