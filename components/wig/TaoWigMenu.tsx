'use client';

import {useActionState, useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, CheckCircle2, ChevronDown, Lock, Plus, X} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {taoWig} from '@/app/[locale]/(dashboard)/wig/actions';
import {tuanTronTrongCha, thangTronTrongCha, chaPhuKy, weekRangeVN, type PeriodOption} from '@/lib/dates';

// ════════════════════════════════════════════════════════════════════════════
// MỘT NÚT "+ Tạo mục tiêu" Ở GÓC PHẢI — thay cho ba khung form xếp dọc cả trang.
// ════════════════════════════════════════════════════════════════════════════
//
// Trước đây trang /wig bày SẴN mọi form tạo: một khung "1 · Tạo WIG năm" ở đầu trang, rồi bên
// trong mỗi WIG năm lại một khung "2 · Tạo WIG tuần", rồi bên trong mỗi WIG tháng lại một khung
// nữa. Lớp có 3 mục tiêu năm là 4 form trống nằm chờ, mỗi form 6 ô. Chủ dự án mô tả đúng cảm giác
// ấy: "nhìn từ trên xuống 1 lượt thấy toàn là ô xếp dọc nhau, toàn là chữ, tôi không biết mình
// nên làm gì luôn".
//
// Nay form chỉ xuất hiện khi người ta thật sự muốn tạo. Trang đọc còn lại đúng thứ đáng đọc:
// mục tiêu tuần này, và lớp đang đi tới đâu.
//
// RÀNG BUỘC CHUỖI NĂM → THÁNG → TUẦN nằm ngay trên ba cái tab: chưa có mục tiêu năm thì tab
// "Tháng" khoá, và bên cạnh nói rõ vì sao khoá. Khoá mà không nói lý do thì người dùng chỉ thấy
// một nút bấm không ăn.

type WigOption = {id: string; title: string; start_date: string; end_date: string};

export function TaoWigMenu({
  classId,
  areas,
  namOptions,
  thangOptions,
  tuanOptions,
  wigNam,
  wigThang,
  kyMacDinh,
  gioiHan,
}: {
  classId: string;
  areas: {value: string; label: string}[];
  // Danh sách kỳ để CHỌN — tính ở server để không lệch hydrate (xem lib/dates.ts).
  namOptions: PeriodOption[];
  thangOptions: PeriodOption[];
  tuanOptions: PeriodOption[];
  // Mục tiêu năm/tháng đang có của lớp, để chọn làm cha.
  wigNam: WigOption[];
  wigThang: WigOption[];
  // Nhãn kỳ chọn sẵn cho từng loại — theo TUẦN ĐANG XEM, không phải theo hôm nay.
  kyMacDinh: {year: string; month: string; week: string};
  // Chặn đầu–cuối cho ô lịch, bằng ĐÚNG cửa sổ mà server chấp nhận (xem gioiHanChonKy).
  gioiHan: {week: {min: string; max: string}; month: {min: string; max: string}};
}) {
  const t = useTranslations('wig');
  const [open, setOpen] = useState(false);
  const [loai, setLoai] = useState<'year' | 'month' | 'week'>('year');
  const boxRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(taoWig, {ok: false});

  const coNam = wigNam.length > 0;
  const coThang = wigThang.length > 0;

  // Mở ra thì đứng sẵn ở loại XA NHẤT mà lớp đã đủ điều kiện tạo: chưa có gì → Năm; có năm rồi →
  // Tháng; có tháng rồi → Tuần. Đó gần như luôn là thứ người ta định làm, và nó cũng dạy luôn
  // cái chuỗi mà không cần một dòng hướng dẫn nào.
  useEffect(() => {
    if (open) setLoai(coThang ? 'week' : coNam ? 'month' : 'year');
  }, [open, coNam, coThang]);

  // Bấm ra ngoài / Esc thì đóng. Không đóng khi vừa lưu xong: người ta hay tạo mấy cái liền tay.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const err = (f: string) => (state.fieldError === f ? state.error : null);
  const kyOptions = loai === 'year' ? namOptions : loai === 'month' ? thangOptions : tuanOptions;

  // ── CHỌN KỲ BẰNG LỊCH, KHÔNG BẰNG DANH SÁCH ──────────────────────────────────────────────
  //
  // Bản cũ đổ mọi kỳ ra một <select>: "W33-2026 · 10/08 → 16/08", "W34-2026 · 17/08 → 23/08"…
  // Người dùng không nghĩ bằng số tuần ISO — họ nghĩ bằng NGÀY ("tuần có ngày khai giảng").
  // Nay chọn một ngày trên lịch, hệ thống tự suy ra tuần chứa ngày ấy và nói rõ nó là tuần nào,
  // từ hôm nào tới hôm nào. Tháng thì dùng thẳng <input type="month"> — giá trị của nó ('2026-09')
  // đúng bằng nhãn kỳ tháng, không phải đổi gì.
  //
  // Năm học KHÔNG dùng lịch: '2026-2027' không phải một khoảng người ta trỏ vào lịch mà chọn, và
  // cũng chỉ có vài lựa chọn. Giữ nguyên danh sách.
  //
  // Ngày gửi lên vẫn KHÔNG có: form chỉ gửi nhãn kỳ như trước, server tự tra ngày. Đây là chỗ đã
  // gây sự cố 7B1 nên không đụng vào.
  const homNayCuaTuan = (ngay: string) => weekRangeVN(new Date(`${ngay}T12:00:00Z`));
  // Điền sẵn thứ Hai của tuần mặc định, KHÔNG để trống.
  //
  // Ô trống nhưng bên dưới vẫn ghi "Tuần W32-2026 · 03/08 → 09/08" là hai câu trái nhau trên cùng
  // một màn: nhìn thì tưởng chưa chọn gì, mà bấm Lưu lại ra một tuần cụ thể. Giá trị lấy từ prop
  // do server tính nên không lệch hydrate.
  const [ngayTuan, setNgayTuan] = useState(
    () => tuanOptions.find((o) => o.label === kyMacDinh.week)?.start ?? '',
  );
  const tuanDangChon = ngayTuan ? homNayCuaTuan(ngayTuan) : tuanOptions.find((o) => o.label === kyMacDinh.week);
  const [thangDangChon, setThangDangChon] = useState('');
  const nhanThang = thangDangChon || kyMacDinh.month;
  const thangHienThi = thangOptions.find((o) => o.label === nhanThang);
  // Năm học cũng phải nói rõ nó chạy từ hôm nào tới hôm nào — nhãn "2026-2027" một mình không trả
  // lời được câu người thử hỏi: "chưa thấy thời gian năm học nằm ở đâu". Ngày kèm năm vì khoảng
  // này vắt qua hai năm dương lịch.
  const [namChon, setNamChon] = useState(kyMacDinh.year);
  const namHienThi = namOptions.find((o) => o.label === namChon);
  const dm = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  const dmy = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}/${x.slice(0, 4)}`;
  const chaOptions = loai === 'month' ? wigNam : wigThang;

  // ── LỊCH BỊ RÀNG VÀO KHOẢNG CỦA MỤC TIÊU CHA ─────────────────────────────────────────────
  //
  // Đây là lỗi chủ dự án gặp: lớp có mục tiêu tháng cho THÁNG 9, nhưng form đứng ở tuần hiện tại
  // (đầu tháng 8), nên bấm Lưu ra "Kỳ này nằm ngoài mục tiêu cha (2026-09-01 → 2026-09-30). Chọn
  // kỳ khác hoặc chọn mục tiêu cha khác." Câu ấy đúng nhưng tới quá muộn — người ta điền xong cả
  // form rồi mới biết ô ĐẦU TIÊN đã sai.
  //
  // Nay ô lịch không cho chọn ra ngoài khoảng của cha, và ngày mặc định tự nhảy vào trong khoảng
  // ấy. Chọn sai thành chuyện không xảy ra được, thay vì chuyện bị mắng sau khi đã xảy ra.
  const [chaId, setChaId] = useState('');
  // MỤC TIÊU CHA CHỌN SẴN PHẢI LÀ CÁI PHỦ KỲ ĐANG ĐỨNG — không phải cái đầu danh sách.
  //
  // Lỗi chủ dự án gặp: lớp có mục tiêu tháng 9 (tạo trước) và mục tiêu tháng 8 (tạo sau). Mở form
  // tạo mục tiêu tuần trong lúc đang ở tuần đầu tháng 8, cha chọn sẵn là cái ĐẦU DANH SÁCH — tức
  // tháng 9 — nên ô lịch bị kéo vào tháng 9 và mục tiêu tuần vừa tạo rơi vào 07/09 → 13/09, cách
  // tuần anh đang nhìn cả tháng. Anh ấy đọc ra "chỗ tuần vẫn cứ ép tháng 9".
  //
  // Neo bằng KỲ MẶC ĐỊNH (prop từ server, tính theo tuần đang xem) chứ không bằng ngày đang chọn
  // trên lịch: ngày ấy lại bị kéo theo khoảng của cha ở useEffect dưới, lấy nó làm neo là hai thứ
  // đuổi nhau. Một chiều duy nhất: KỲ quyết định CHA, cha quyết định khoảng lịch.
  const neoCha =
    loai === 'month'
      ? thangOptions.find((o) => o.label === kyMacDinh.month)?.start
      : tuanOptions.find((o) => o.label === kyMacDinh.week)?.start;
  // Luật chọn nằm trong lib/dates.ts để kiểm được bằng số, không phải dựng trình duyệt rồi đoán.
  const cha = chaOptions.find((o) => o.id === chaId) ?? chaPhuKy(chaOptions, neoCha);
  const lonHon = (a: string, b: string) => (a > b ? a : b);
  const nhoHon = (a: string, b: string) => (a < b ? a : b);
  // Lùi vào TUẦN/THÁNG TRỌN VẸN, không chặn đúng bằng khoảng của cha.
  //
  // Chặn đúng bằng cha vẫn để lọt, và tôi đã đưa cái lọt ấy lên production: cha là tháng 9, ô lịch
  // cho chọn 01/09, nhưng TUẦN chứa 01/09 là 31/08 → 06/09 — thò sang tháng 8. Server đòi cả kỳ
  // nằm trong cha (lib/wig-tao.ts) nên vẫn từ chối, đúng câu mà bản sửa này sinh ra để dẹp.
  const tuanCha = cha ? tuanTronTrongCha(cha.start_date, cha.end_date) : null;
  const thangCha = cha ? thangTronTrongCha(cha.start_date, cha.end_date) : null;
  const chaQuaNgan = cha != null && (loai === 'week' ? tuanCha === null : thangCha === null);
  const minTuan = tuanCha ? lonHon(gioiHan.week.min, tuanCha.min) : gioiHan.week.min;
  const maxTuan = tuanCha ? nhoHon(gioiHan.week.max, tuanCha.max) : gioiHan.week.max;
  const minThang = thangCha ? lonHon(gioiHan.month.min, thangCha.min) : gioiHan.month.min;
  const maxThang = thangCha ? nhoHon(gioiHan.month.max, thangCha.max) : gioiHan.month.max;

  // Đổi mục tiêu cha (hoặc mở tab khác) mà ngày đang chọn rơi ra ngoài khoảng mới thì KÉO nó vào.
  // Không kéo thì ô lịch giữ một ngày mà chính nó đang cấm — trình duyệt không tự sửa hộ, và người
  // dùng lại rơi đúng vào câu "kỳ nằm ngoài mục tiêu cha".
  useEffect(() => {
    if (loai !== 'week' || !ngayTuan) return;
    if (ngayTuan < minTuan || ngayTuan > maxTuan) setNgayTuan(minTuan);
  }, [loai, ngayTuan, minTuan, maxTuan]);
  useEffect(() => {
    if (loai !== 'month') return;
    const ht = thangDangChon || kyMacDinh.month;
    if (ht < minThang || ht > maxThang) setThangDangChon(minThang);
  }, [loai, thangDangChon, minThang, maxThang, kyMacDinh.month]);

  const tab = (gt: 'year' | 'month' | 'week', nhan: string, mo: boolean, viSao: string) => (
    <button
      type="button"
      key={gt}
      onClick={() => mo && setLoai(gt)}
      disabled={!mo}
      title={mo ? undefined : viSao}
      aria-pressed={loai === gt}
      className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-[12.5px] font-extrabold transition-all disabled:cursor-not-allowed ${
        loai === gt
          ? 'bg-navy text-white shadow-[0_3px_10px_-2px_rgba(38,39,93,0.45)]'
          : mo
            ? 'text-navy/70 hover:bg-navy/[0.07] hover:text-navy'
            : 'text-grey-soft'
      }`}
    >
      {!mo && <Lock size={11} strokeWidth={2.5} />}
      {nhan}
    </button>
  );

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={btnGold}
      >
        <Plus size={15} strokeWidth={2.8} />
        {t('createTitle')}
        <ChevronDown size={14} strokeWidth={2.8} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('createTitle')}
          // Điện thoại: trải gần hết bề ngang, neo dưới thanh nav. Máy tính: thả xuống từ chính
          // cái nút. Một khối 400px neo phải trên màn 360px là tràn ra ngoài mép và mất một nửa.
          className="fixed inset-x-3 top-[88px] z-40 max-h-[76vh] overflow-y-auto rounded-[18px] bg-white p-4 shadow-pop ring-1 ring-navy/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[430px]"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="font-display text-[14.5px] font-bold text-navy">{t('createTitle')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('cancel')}
              className="ml-auto grid h-7 w-7 cursor-pointer place-items-center rounded-[9px] text-grey-mid transition-colors hover:bg-navy/[0.06] hover:text-navy"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          <div className="mb-1 flex gap-1 rounded-[12px] bg-navy/[0.05] p-1">
            {tab('year', t('year'), true, '')}
            {tab('month', t('month'), coNam, t('needYearFirst'))}
            {tab('week', t('week'), coThang, t('needMonthFirst'))}
          </div>
          <p className="mb-3 text-[11px] font-semibold leading-relaxed text-grey-mid">
            {loai === 'year' ? t('chainYear') : loai === 'month' ? t('chainMonth') : t('chainWeek')}
          </p>

          {/* key theo loại: đổi tab là dựng lại form, không để sót giá trị của loại trước. */}
          <form key={loai} action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="class_id" value={classId} />
            <input type="hidden" name="period" value={loai} />

            {loai !== 'year' && (
              <Field
                label={loai === 'month' ? t('parentYear') : t('parentMonth')}
                htmlFor="wig-parent"
                error={err('parent_wig_id')}
              >
                <select
                  id="wig-parent"
                  name="parent_wig_id"
                  className={selectCls}
                  value={cha?.id ?? ''}
                  onChange={(e) => setChaId(e.target.value)}
                >
                  {chaOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={t('wigTitle')} htmlFor="wig-title" error={err('title')} hint={t('wigTitleHint')}>
              <input
                id="wig-title"
                name="title"
                placeholder={t('wigTitlePlaceholder')}
                aria-invalid={state.fieldError === 'title'}
                className={ctlWithBorder(state.fieldError === 'title')}
              />
            </Field>

            {loai === 'year' && (
              <Field label={t('area')} htmlFor="wig-area" error={err('area')}>
                <select id="wig-area" name="area" className={selectCls} defaultValue="">
                  <option value="" disabled>
                    — {t('area')} —
                  </option>
                  {areas.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {/* ĐO BẰNG GÌ — chỉ hỏi ở cấp NĂM, tháng/tuần thừa kế từ cha (lib/wig-tao.ts).
                Trước đây luôn đóng cứng 'tick', nên "Điểm TB Toán 6,5 → 8,0" — chính ví dụ định
                nghĩa đích ghi-nhận-ngoài trong tài liệu — không tạo nổi, và mọi mục tiêu kiểu ấy
                bị app vẽ cho một vạch tiến độ mà nó không có cách nào biết đúng hay sai. */}
            {loai === 'year' && (
              <Field label={t('measureBy')} htmlFor="wig-measure">
                <select id="wig-measure" name="measure_by" className={selectCls} defaultValue="tick">
                  <option value="tick">{t('measureTick')}</option>
                  <option value="manual">{t('measureManual')}</option>
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.3fr]">
              <Field label={t('baseline')} htmlFor="wig-baseline" error={err('baseline')}>
                <input
                  id="wig-baseline"
                  name="baseline"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="numeric"
                  placeholder="0"
                  aria-invalid={state.fieldError === 'baseline'}
                  className={ctlWithBorder(state.fieldError === 'baseline')}
                />
              </Field>
              <Field label={t('targetTo')} htmlFor="wig-target" error={err('target_value')}>
                <input
                  id="wig-target"
                  name="target_value"
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  aria-invalid={state.fieldError === 'target_value'}
                  className={ctlWithBorder(state.fieldError === 'target_value')}
                />
              </Field>
              <Field label={t('unit')} htmlFor="wig-unit" error={err('unit')} className="col-span-2 sm:col-span-1">
                <input
                  id="wig-unit"
                  name="unit"
                  placeholder={t('unitPlaceholder')}
                  aria-invalid={state.fieldError === 'unit'}
                  className={ctlWithBorder(state.fieldError === 'unit')}
                />
              </Field>
            </div>

            {/* CHỈ GỬI NHÃN KỲ, không gửi ngày. Server tra ngày từ nhãn (xem ngayCuaKy trong
                actions.ts) nên không còn đường nào để một mục tiêu mang ngày lệch với nhãn của
                chính nó — đúng cái bẫy đã gây sự cố 7B1. */}
            <Field label={t('periodWhich')} htmlFor="wig-ky" error={err('period_label')}>
              {loai === 'week' ? (
                <>
                  {/* Ô lịch chỉ để CHỌN; thứ gửi lên vẫn là nhãn kỳ. */}
                  <input type="hidden" name="period_label" value={tuanDangChon?.label ?? ''} />
                  <input
                    id="wig-ky"
                    type="date"
                    value={ngayTuan}
                    onChange={(e) => setNgayTuan(e.target.value)}
                    min={minTuan}
                    max={maxTuan}
                    aria-describedby="wig-ky-ghi"
                    className={ctlWithBorder(state.fieldError === 'period_label')}
                  />
                  <p id="wig-ky-ghi" className="mt-1 text-[12px] font-semibold text-grey-mid">
                    {chaQuaNgan
                      ? t('parentTooShort')
                      : tuanDangChon
                      ? t('weekResolved', {
                          week: tuanDangChon.label,
                          from: dm(tuanDangChon.start),
                          to: dm(tuanDangChon.end),
                        })
                        : t('weekPickHint')}
                  </p>
                </>
              ) : loai === 'month' ? (
                <>
                  <input type="hidden" name="period_label" value={nhanThang} />
                  <input
                    id="wig-ky"
                    type="month"
                    value={nhanThang}
                    onChange={(e) => setThangDangChon(e.target.value)}
                    min={minThang}
                    max={maxThang}
                    aria-describedby="wig-ky-ghi"
                    className={ctlWithBorder(state.fieldError === 'period_label')}
                  />
                  {thangHienThi && (
                    <p id="wig-ky-ghi" className="mt-1 text-[12px] font-semibold text-grey-mid">
                      {dm(thangHienThi.start)} → {dm(thangHienThi.end)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <select
                    id="wig-ky"
                    name="period_label"
                    className={selectCls}
                    value={namChon}
                    onChange={(e) => setNamChon(e.target.value)}
                    aria-describedby="wig-ky-ghi"
                  >
                    {kyOptions.map((o) => (
                      <option key={o.label} value={o.label}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {namHienThi && (
                    <p id="wig-ky-ghi" className="mt-1 text-[12px] font-semibold text-grey-mid">
                      {dmy(namHienThi.start)} → {dmy(namHienThi.end)}
                    </p>
                  )}
                </>
              )}
            </Field>

            {state.error && !state.fieldError && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12.5px] font-bold text-status-bad">
                <AlertCircle size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                {state.error}
              </p>
            )}
            {state.ok && state.message && (
              <div className="flex flex-wrap items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12.5px] font-bold text-success-dark">
                <CheckCircle2 size={14} strokeWidth={2.5} className="mt-px shrink-0" />
                <span className="min-w-0 flex-1">{state.message}</span>
                {/* Form cố ý KHÔNG tự đóng (người ta hay tạo mấy cái liền tay — xem ghi chú trên),
                    nhưng người tạo xong một cái thì phải có đường đóng ngay tại chỗ vừa nhìn. */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 cursor-pointer font-extrabold text-navy underline underline-offset-2"
                >
                  {t('doneClose')}
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
                {t('cancel')}
              </button>
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('save')}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
