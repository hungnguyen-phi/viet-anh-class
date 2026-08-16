'use client';

import {useActionState, useEffect, useRef, useState, type ChangeEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, ArrowRight, Check, CheckCircle2, PencilLine, RotateCcw, Trash2, X} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {Link} from '@/i18n/navigation';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, inputCls, selectCls, btnGold} from '@/components/ui/Field';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {moPhongHop, ketThucBuoiHop, xoaBienBan} from '@/app/[locale]/(dashboard)/wig/hop/actions';

// ════════════════════════════════════════════════════════════════════════════
// PHÒNG HỌP WIG — ba bước, một nút, một lần lưu.
// ════════════════════════════════════════════════════════════════════════════
//
// Nhịp 4DX của một buổi họp WIG có đúng ba nhịp, và bản này bày ra đúng ba nhịp ấy theo thứ tự:
//
//   1. Tuần vừa rồi làm được gì   → cam kết của lớp và của từng em: việc → tick → V/X; đọc năm
//                                   câu em tự viết
//   2. Chiêm nghiệm                → một đoạn cả lớp rút ra
//   3. Cam kết tuần tới            → hai lời hứa của lớp, treo dưới mục tiêu năm
//
// ── VÌ SAO GỌN LẠI THẾ NÀY (16/08/2026) ──────────────────────────────────────────────────────
//
// Bản trước có SÁU khối cho một buổi họp: lời hứa tuần trước (chữ tự do), V/X từng cam kết, bảng
// PDR, bảng "Việc chung" chấm từng việc + rút ra, "Từng em 0/8" (tick việc chung), rồi mãi cuối
// trang lại một "Từng em" nữa với hai ô cô gõ hộ. Cùng một em xuất hiện ở ba bảng với ba con số,
// và bước 2 hỏi "Cam kết" bằng chữ trong khi bước 3 đặt cam kết bằng dòng có cấu trúc. Chủ dự án:
// "rất rời rạc và thừa mà ko có tính liên kết chặt chẽ nào", "đã chiêm nghiệm - cam kết rồi còn
// cam kết cho tuần tới nữa?".
//
// Nay MỘT trục: cam kết. Lớp có cam kết → việc → tick của cô → V/X. Mỗi em có cam kết → việc →
// tick của em → V/X, ngay dưới là năm câu em tự viết trong phòng họp của em. Không còn ô nào để cô
// ghi đè lời của em (0129/0133: lời hứa là của em, cô duyệt và chấm, không gõ hộ).
//
// MỌI Ô ĐỀU CONTROLLED. Một buổi họp có thể gõ vào đây vài trăm chữ; React reset form sau khi
// action chạy xong, nên ô không controlled là mất sạch chữ chỉ vì server trả về một câu lỗi.

/** Một việc dẫn dắt dưới một cam kết, đã đếm tick của đúng người sở hữu. */
export type ViecHop = {
  id: string;
  title: string;
  unit: string | null;
  dat: number;
  target: number;
  xong: boolean;
};

/** Một cam kết (của lớp hoặc của em) trong tuần đang họp. */
export type CamKetHop = {
  id: string;
  title: string;
  area: string;
  verdict: 'win' | 'lose' | null;
  /** Gợi ý của máy: đủ mọi việc thì 'win'. KHÔNG tự thành kết quả — người bấm mới là kết quả. */
  goiY: 'win' | 'lose';
  viec: ViecHop[];
  /** Em đổi lời hứa giữa tuần mấy lần (0126). Tín hiệu kỷ luật, không phải điểm trừ. */
  soLanSua: number;
};

/** Một em trong buổi họp: cam kết của em, và năm câu em tự viết ở /student/hop. */
export type EmHop = {
  id: string;
  ten: string;
  camKet: CamKetHop[];
  traLoi: {khoKhan: string; vuotQua: string; cachTotHon: string; ketQua: string; camKet: string};
  /** Em đã bấm "Tham gia" trong buổi họp này chưa (0130). */
  thamGia: boolean;
};
export type WigOption = {id: string; title: string};

export function PhongHop({
  classId,
  hopStart,
  hopLabel,
  hopRange,
  dichLabel,
  dichRange,
  camKetLop,
  tungEm,
  chiemNghiemCu,
  camKetDich,
  namHienCo,
  canManage,
  daCoBienBan,
  daChot,
  phongMo,
  quayVe,
  xemTuanMoi = null,
}: {
  classId: string;
  hopStart: string;
  hopLabel: string;
  hopRange: string;
  dichLabel: string;
  dichRange: string;
  camKetLop: CamKetHop[];
  tungEm: EmHop[];
  chiemNghiemCu: string;
  /** Cam kết ĐÃ đặt cho tuần tới — mở lại buổi họp thì điền sẵn, không đẻ bản sao. */
  camKetDich: {id: string; title: string; wigId: string}[];
  // Danh sách mục tiêu NĂM để chọn khi đặt cam kết.
  namHienCo: WigOption[];
  canManage: boolean;
  // Tuần này đã có biên bản chưa — quyết định có bày nút gỡ hay không. Bày nút gỡ khi chưa có gì
  // để gỡ là mời người ta bấm một nút chỉ biết báo lỗi.
  daCoBienBan: boolean;
  // Đã bấm CHỐT chưa (0108). Khác "đã có biên bản": lưu tạm cũng sinh biên bản, nhưng chỉ chốt mới
  // khoá tick và khoá ô số đo của tuần.
  daChot: boolean;
  /** Phòng đang mở chưa (0130) — cô bấm "Bắt đầu họp" là mở, "Kết thúc" là đóng. */
  phongMo: boolean;
  // Đường về trang WIG. null với ban giám hiệu — họ KHÔNG vào được /wig, nên vẽ một liên kết tới
  // đó là vẽ một cái cửa dẫn thẳng tới màn hình "bạn không có quyền".
  quayVe: {pathname: '/wig'; query: Record<string, string>} | null;
  // Trang WIG mở sẵn TUẦN MỚI — đích đến sau khi lưu, nơi cam kết vừa tạo nằm. Cùng luật null
  // với quayVe.
  xemTuanMoi?: {pathname: '/wig'; query: Record<string, string>} | null;
}) {
  const t = useTranslations('meeting');
  const tw = useTranslations('wig');
  // Lựa chọn V/X đang giữ trên màn (chưa bấm Chốt) — cho cả cam kết lớp lẫn cam kết từng em.
  const [vx, setVx] = useState<Record<string, 'win' | 'lose'>>({});
  const [state, formAction] = useActionState(ketThucBuoiHop, {ok: false});

  // ── MỘT KHO GIÁ TRỊ CHO CÁC Ô CHỮ ────────────────────────────────────────────────────────
  const [v, setV] = useState<Record<string, string>>(() => ({chiem_nghiem: chiemNghiemCu}));
  const set = (k: string, val: string) => setV((p) => ({...p, [k]: val}));
  const oNhap = (k: string) => ({
    value: v[k] ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(k, e.target.value),
  });

  // ── BẢN NHÁP: BUỔI HỌP DÀI, PHIÊN THÌ ĐỨT ─────────────────────────────────────────────────
  //
  // Một buổi họp gõ vào đây vài trăm chữ và chỉ ghi vào CSDL ở nút cuối cùng. Trang này lại chạy
  // trên đường truyền hay rớt gói (xem docs/), nên chỉ cần trình duyệt tải lại một lần là mất
  // sạch — đã mất thật một lần trong buổi chạy thử 13/08/2026.
  // Nháp nằm ở localStorage, KHÔNG ở CSDL: nó là chữ chưa ai duyệt, chưa phải biên bản. Ghi vào
  // bảng là biến bản gõ dở của một người thành số liệu chính thức của lớp.
  const khoaNhap = `vac:hop:${classId}:${hopStart}`;
  const [nhapDaKhoiPhuc, setNhapDaKhoiPhuc] = useState(false);
  const daDocNhap = useRef(false);
  useEffect(() => {
    if (daDocNhap.current) return;
    daDocNhap.current = true;
    try {
      const raw = window.localStorage.getItem(khoaNhap);
      if (!raw) return;
      const cu = JSON.parse(raw) as {v?: Record<string, string>; vx?: Record<string, 'win' | 'lose'>};
      if (cu?.v) setV((p) => ({...p, ...cu.v}));
      if (cu?.vx) setVx((p) => ({...p, ...cu.vx}));
      if (cu?.v || cu?.vx) setNhapDaKhoiPhuc(true);
    } catch {
      // Nháp hỏng thì bỏ qua — không có gì để cứu, và không được làm hỏng cả trang vì nó.
    }
  }, [khoaNhap]);
  useEffect(() => {
    if (!daDocNhap.current) return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(khoaNhap, JSON.stringify({v, vx}));
      } catch {
        // Hết chỗ hoặc chế độ riêng tư — nháp là thứ có thì tốt, không có thì thôi.
      }
    }, 500);
    return () => clearTimeout(id);
  }, [khoaNhap, v, vx]);
  const boNhap = () => {
    try {
      window.localStorage.removeItem(khoaNhap);
    } catch {
      /* không sao */
    }
    setNhapDaKhoiPhuc(false);
  };

  // ── EM ĐANG ĐIỀN, CÔ NHÌN THẤY ────────────────────────────────────────────────────────────
  //
  // Từ 0111, mỗi em tự điền phần của mình ngay trong phòng họp (/student/hop). Chữ ấy đi vào cùng
  // bảng `wig_meetings`, nên chỗ này chỉ cần nghe thay đổi của bảng là câu trả lời của em tự cập
  // nhật — cô không phải tải lại trang giữa buổi họp.
  //
  // ĐI QUA postgres_changes chứ không qua kênh broadcast: broadcast của Supabase mặc định ai
  // đăng nhập cũng vào được nếu đoán trúng tên kênh, mà đây là chữ của trẻ con. postgres_changes
  // thì Realtime áp đúng RLS của bảng.
  const [traLoi, setTraLoi] = useState<Record<string, EmHop['traLoi']>>(() =>
    Object.fromEntries(tungEm.map((e) => [e.id, e.traLoi])),
  );
  const [dangGoLuc, setDangGoLuc] = useState<Record<string, number>>({});
  const [coMat, setCoMat] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tungEm.filter((e) => e.thamGia).map((e) => [e.id, true])),
  );
  // Nhịp đồng hồ để chữ "đang điền…" tự tắt sau vài giây — không có nó thì cái chấm động đậy
  // nằm lại đó suốt buổi họp dù em đã gõ xong từ lâu.
  const [nhip, setNhip] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNhip(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!canManage) return;
    const supabase = createClient();
    const kenh = supabase
      .channel(`hop-${classId}-${hopStart}`)
      .on(
        'postgres_changes',
        {event: '*', schema: 'public', table: 'wig_meetings', filter: `class_id=eq.${classId}`},
        (payload) => {
          const r = payload.new as {
            student_id: string | null;
            week_start: string | null;
            week_label: string | null;
            results: string | null;
            commitments: string | null;
            kho_khan: string | null;
            vuot_qua: string | null;
            cach_tot_hon: string | null;
            tham_gia_luc: string | null;
          } | null;
          // Khớp theo NGÀY thứ Hai, không theo nhãn: nhãn là chữ, và cùng một tuần đã từng mang
          // hai nhãn ("32-2026" / "W32-2026") trong dữ liệu thật.
          if (!r?.student_id || (r.week_start ?? '') !== hopStart) return;
          // GÓI TIN VỪA TỚI LÀ ĐỦ ĐỂ NÓI "vừa có người gõ" — không dò thêm cột nào. (Hai lần hụt
          // trước ở đúng chỗ này: parse hs_go_luc, rồi chờ hs_go_luc có trong gói — gói Realtime
          // không phải lúc nào cũng mang đủ cột.)
          setDangGoLuc((p) => ({...p, [r.student_id!]: Date.now()}));
          if (r.tham_gia_luc) setCoMat((p) => ({...p, [r.student_id!]: true}));
          setTraLoi((p) => ({
            ...p,
            [r.student_id!]: {
              khoKhan: r.kho_khan ?? '',
              vuotQua: r.vuot_qua ?? '',
              cachTotHon: r.cach_tot_hon ?? '',
              ketQua: r.results ?? '',
              camKet: r.commitments ?? '',
            },
          }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kenh);
    };
  }, [canManage, classId, hopStart]);
  // 6 giây: đủ dài để một em gõ chậm không bị nhấp nháy, đủ ngắn để cô không tưởng em còn đang gõ.
  const dangGo = (id: string) => nhip - (dangGoLuc[id] ?? 0) < 6000;

  const err = (f: string) => (state.fieldError === f ? state.error : null);

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
      {phu && <p className="ml-9 mt-0.5 text-[11.5px] font-semibold text-grey-mid">{phu}</p>}
    </div>
  );

  // Chốt xong là nháp hết việc — giữ lại thì lần sau mở buổi họp ra nó đè lên số liệu thật.
  useEffect(() => {
    if (state.ok) boNhap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const soCoMat = tungEm.filter((e) => coMat[e.id]).length;

  // ══ V / X CHO MỘT CAM KẾT ══ (0121)
  // Thắng/thua là Ý NGƯỜI, không phải phép so. Máy đã đếm hộ ("2/3 việc đạt") và làm SÁNG nút nó
  // nghiêng về; nút kia mờ đi nhưng vẫn bấm được. Chủ dự án chốt đúng cách ấy: "nếu đủ rồi thì
  // nút thắng sáng, nút thua tối đi, ai muốn đổi thì cho chọn lại".
  // Gửi lên cả hai — người chọn gì (vx_) và máy gợi gì (vxgoi_) — để lần sau nhìn lại còn biết
  // cô đã đổi ý so với máy ở đâu. Ban giám hiệu (không canManage) chỉ thấy dấu đã chấm.
  const nutVX = (c: CamKetHop) => {
    const chon = vx[c.id] ?? c.verdict ?? null;
    if (!canManage) {
      return chon ? (
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
            chon === 'win' ? 'bg-success text-white' : 'bg-status-bad text-white'
          }`}
          aria-label={chon === 'win' ? t('verdictWin') : t('verdictLose')}
        >
          {chon === 'win' ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
        </span>
      ) : null;
    }
    return (
      <span className="flex shrink-0 gap-1.5">
        <input type="hidden" name={`vxgoi_${c.id}`} value={c.goiY} />
        {chon && <input type="hidden" name={`vx_${c.id}`} value={chon} />}
        {(['win', 'lose'] as const).map((gt) => {
          const dangChon = chon === gt;
          const mayGoi = c.goiY === gt;
          return (
            <button
              key={gt}
              type="button"
              onClick={() => setVx((p) => ({...p, [c.id]: gt}))}
              aria-pressed={dangChon}
              aria-label={gt === 'win' ? t('verdictWin') : t('verdictLose')}
              className={`grid h-9 w-11 cursor-pointer place-items-center rounded-[10px] border-[1.5px] font-extrabold transition-all ${
                dangChon
                  ? gt === 'win'
                    ? 'border-transparent bg-success text-white'
                    : 'border-transparent bg-status-bad text-white'
                  : mayGoi
                    ? 'border-navy/25 bg-white text-navy'
                    : 'border-navy/10 bg-white text-navy/35'
              }`}
            >
              {gt === 'win' ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
            </button>
          );
        })}
      </span>
    );
  };

  // Một cam kết: tên · các việc dưới nó (đã đếm tick) · V/X. Cùng một khối cho lớp và cho em.
  const theCamKet = (c: CamKetHop) => (
    <div key={c.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="min-w-0 flex-1 text-[13.5px] font-bold text-navy">{c.title}</span>
        {c.soLanSua > 0 && (
          <span className="shrink-0 rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
            {t('changedTimes', {n: c.soLanSua})}
          </span>
        )}
        <span className="shrink-0 text-[11.5px] font-bold text-grey-mid">
          {t('commitmentLeadsDone', {xong: c.viec.filter((x) => x.xong).length, tong: c.viec.length})}
        </span>
        {nutVX(c)}
      </div>
      {c.viec.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {c.viec.map((x) => (
            <li key={x.id} className="flex items-center gap-2 text-[12.5px]">
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                  x.xong ? 'bg-success text-white' : 'border-[1.5px] border-navy/20'
                }`}
                aria-hidden
              >
                {x.xong && <Check size={10} strokeWidth={3.5} />}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-navy">{x.title}</span>
              <span className="shrink-0 font-extrabold tabular-nums text-navy">
                {x.dat}/{x.target}
                {x.unit ? <span className="ml-1 font-semibold text-grey-mid">{x.unit}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Năm câu em tự viết — chỉ đọc. Trống thì gạch, không đặt câu giả vào miệng em.
  const cauTraLoi = (id: string) => {
    const tl = traLoi[id];
    const dong: [string, string][] = [
      [t('qKhoKhan'), tl?.khoKhan ?? ''],
      [t('qVuotQua'), tl?.vuotQua ?? ''],
      [t('qCachTotHon'), tl?.cachTotHon ?? ''],
      [t('emResults'), tl?.ketQua ?? ''],
      [t('emCommit'), tl?.camKet ?? ''],
    ];
    return (
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {dong.map(([nhan, gt]) => (
          <div key={nhan} className="min-w-0">
            <dt className="text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">{nhan}</dt>
            <dd className={`text-[12.5px] font-semibold ${gt ? 'text-navy' : 'text-grey-soft'}`}>
              {gt || '—'}
            </dd>
          </div>
        ))}
      </dl>
    );
  };

  return (
    <div className="flex flex-col gap-4">
    {/* ══ PHÒNG HỌP SỐNG ══ (0130)
        Chủ dự án: "khi giáo viên ấn họp, tất cả màn hình của các em đều hiện phòng họp, xong rồi
        các em ấn tham gia, gv sẽ biết ai đang tham gia".

        "Tham gia" chỉ là DẤU CÓ MẶT, không phải cửa: em vắng buổi họp vẫn điền được phần của mình
        sau đó, miễn tuần chưa chốt. Nên chỗ này đếm người, không chặn ai. */}
    {canManage && !daChot && (
      <section className="glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] p-4">
        {phongMo ? (
          <>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[11.5px] font-extrabold text-success-dark">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              {t('roomOpen')}
            </span>
            <span className="text-[12.5px] font-bold text-navy">
              {t('roomJoined', {n: soCoMat, total: tungEm.length})}
            </span>
            {/* Tên của những em CHƯA vào — đó mới là danh sách cô cần, để nhắc. */}
            {soCoMat < tungEm.length && (
              <span className="min-w-0 flex-1 text-[11.5px] font-semibold leading-relaxed text-grey-mid">
                {t('roomMissing', {
                  ten: tungEm
                    .filter((e) => !coMat[e.id])
                    .map((e) => e.ten)
                    .join(', '),
                })}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1" />
            <form action={moPhongHop} className="contents">
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="hop_start" value={hopStart} />
              <input type="hidden" name="hop_label" value={hopLabel} />
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('roomStart')}
              </SubmitButton>
            </form>
          </>
        )}
      </section>
    )}
    {nhapDaKhoiPhuc && (
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-gold-deep/30 bg-gold/[0.12] px-3 py-2.5">
        <RotateCcw size={14} strokeWidth={2.5} className="shrink-0 text-gold-deep" />
        <span className="min-w-0 flex-1 text-[12px] font-bold text-navy">{t('draftRestored')}</span>
        <button
          type="button"
          onClick={() => {
            boNhap();
            window.location.reload();
          }}
          className="cursor-pointer rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-navy transition-colors hover:border-navy"
        >
          {t('draftDiscard')}
        </button>
      </div>
    )}
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="hop_start" value={hopStart} />
      <input type="hidden" name="hop_label" value={hopLabel} />
      <input type="hidden" name="dich_label" value={dichLabel} />

      {/* ══ BƯỚC 1 — TUẦN VỪA RỒI ══ */}
      <section className="glass rounded-[20px] p-[18px]">
        {buoc(1, t('step1', {week: hopLabel}), hopRange)}

        {/* Cam kết của LỚP: cô đặt tuần trước, cô tick việc trong tuần, nay cô chấm. */}
        <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
          {t('classCommitments')}
        </h3>
        {camKetLop.length > 0 ? (
          <div className="flex flex-col gap-2">{camKetLop.map(theCamKet)}</div>
        ) : (
          <p className="rounded-[14px] border-[1.5px] border-dashed border-navy/15 p-3 text-center text-[12.5px] font-semibold text-grey-mid">
            {t('noClassCommitment', {week: hopLabel})}
          </p>
        )}

        {/* TỪNG EM: cam kết của em (việc, tick, V/X) + năm câu em tự viết. Một khối cho một em —
            không còn ba bảng nói ba số về cùng một người. */}
        <h3 className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">
          {t('perStudent')} · {t('perStudentCount', {n: tungEm.length})}
        </h3>
        <div className="flex flex-col gap-2.5">
          {tungEm.map((e) => {
            const ckDat = e.camKet.filter((c) => (vx[c.id] ?? c.verdict) === 'win').length;
            const viecTong = e.camKet.reduce((s, c) => s + c.viec.length, 0);
            const viecDat = e.camKet.reduce((s, c) => s + c.viec.filter((x) => x.xong).length, 0);
            return (
              <div key={e.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/student/${e.id}`}
                    className="inline-flex min-h-[24px] min-w-0 items-center truncate text-[13.5px] font-extrabold text-navy hover:underline"
                  >
                    {e.ten}
                  </Link>
                  {coMat[e.id] && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                      {t('roomJoined1')}
                    </span>
                  )}
                  {/* EM ĐANG GÕ. Ba chấm động đậy đúng chỗ cái tên, không phải một khung thông
                      báo ở góc màn — cô đang nhìn danh sách em, tín hiệu phải nằm trong danh sách
                      ấy. aria-live để trình đọc màn hình cũng nghe được, nhưng 'polite' thôi. */}
                  {dangGo(e.id) && (
                    <span
                      aria-live="polite"
                      className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
                    >
                      <PencilLine size={10} strokeWidth={2.5} />
                      {t('studentTyping')}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[11.5px] font-bold tabular-nums text-grey-mid">
                    {t('pdrCommitments')} {ckDat}/{e.camKet.length} · {t('pdrLeads')} {viecDat}/{viecTong}
                  </span>
                </div>

                {e.camKet.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">{e.camKet.map(theCamKet)}</div>
                ) : (
                  <p className="mt-2 text-[12px] font-semibold italic text-grey-mid">
                    {t('noStudentCommitment')}
                  </p>
                )}

                {cauTraLoi(e.id)}
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ BƯỚC 2 — CHIÊM NGHIỆM ══ Một đoạn của cả lớp. Không còn ô "Cam kết" chữ tự do ở đây:
          cam kết tuần tới là hai dòng có cấu trúc ở bước 3, viết thêm một câu văn là bản sao. */}
      <section className="glass rounded-[20px] p-[18px]">
        {buoc(2, t('step2'))}
        <textarea
          id="chiem-nghiem"
          name="chiem_nghiem"
          aria-label={t('step2')}
          {...oNhap('chiem_nghiem')}
          disabled={!canManage}
          rows={3}
          placeholder={t('reflectionPlaceholder')}
          className="w-full resize-y rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-colors focus:border-navy disabled:bg-navy/[0.03]"
        />
      </section>

      {/* ══ BƯỚC 3 — CAM KẾT TUẦN TỚI ══ */}
      {canManage && (
        <section className="glass rounded-[20px] p-[18px]">
          {buoc(3, t('step3', {week: dichLabel}), dichRange)}

          {/* CAM KẾT CHO TUẦN TỚI (0121) — tối đa 2, và đó là cả điểm của nó. Cam kết là một LỜI
              HỨA nên không có ô con số nào ở đây: con số nằm ở các việc dẫn dắt, và việc thì gắn ở
              trang lớp — nơi có sẵn lưới ngày để cô tick. */}
          <div className="flex flex-col gap-3">
            {err('viec') && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
                <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {err('viec')}
              </p>
            )}
            {namHienCo.length > 0 ? (
              [0, 1].map((n) => {
                const daCo = camKetDich[n];
                return (
                  <div key={n} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
                    <div className="grid gap-2.5 sm:grid-cols-[1.2fr_2fr]">
                      <Field label={tw('parentYear')} htmlFor={`ck-${n}-wig`}>
                        <select
                          id={`ck-${n}-wig`}
                          name={`ck_${n}_wig`}
                          defaultValue={daCo?.wigId ?? namHienCo[0]?.id}
                          className={selectCls}
                        >
                          {namHienCo.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label={t('commitmentNo', {n: n + 1})} htmlFor={`ck-${n}-title`}>
                        <input
                          id={`ck-${n}-title`}
                          name={`ck_${n}_title`}
                          {...oNhap(`ck_${n}_title`)}
                          value={v[`ck_${n}_title`] ?? daCo?.title ?? ''}
                          placeholder={t('commitmentPlaceholder')}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })
            ) : (
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
            )}
          </div>
        </section>
      )}

      {/* ══ MỘT NÚT: CUỐI BUỔI HỌP, LƯU LÀ CHỐT ══
          Bản 0108 từng tách đôi thành "Lưu tạm" và "Chốt". Chủ dự án gộp lại 13/08/2026: buổi họp
          chỉ có một thời điểm ghi, và đó là lúc họp xong. */}
      {canManage && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-[20px] bg-navy/[0.04] p-4">
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
          {xemTuanMoi && (
            <Link
              href={xemTuanMoi}
              className="ml-auto inline-flex min-h-[24px] items-center gap-1 text-[12.5px] font-extrabold text-navy underline"
            >
              {t('viewNewWeekGoal', {week: dichLabel})}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          )}
          {quayVe && (
            <Link
              href={quayVe}
              className={`${xemTuanMoi ? '' : 'ml-auto '}inline-flex min-h-[24px] items-center gap-1 text-[12.5px] font-extrabold text-navy underline`}
            >
              {t('backToWig')}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          )}
        </div>
      )}
    </form>

    {/* GỠ BIÊN BẢN — đường lùi cho một việc một chiều. Ghi nhận buổi họp là thứ khoá tick của tuần
        đó (0081). Form RIÊNG, không lồng trong form trên: HTML không cho lồng form, và gộp chung
        thì một cái nút xoá đứng cạnh nút Chốt là công thức để bấm nhầm. */}
    {canManage && daCoBienBan && <NutGoBienBan classId={classId} hopStart={hopStart} hopLabel={hopLabel} />}
    </div>
  );
}

function NutGoBienBan({classId, hopStart, hopLabel}: {classId: string; hopStart: string; hopLabel: string}) {
  const t = useTranslations('meeting');
  const [state, formAction] = useActionState(xoaBienBan, {ok: false});
  return (
    <form action={formAction} className="flex flex-wrap items-center justify-end gap-2 border-t border-navy/[0.08] pt-3">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="hop_start" value={hopStart} />
      <input type="hidden" name="hop_label" value={hopLabel} />
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
