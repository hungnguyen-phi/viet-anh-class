'use client';

import {useActionState, useEffect, useRef, useState, type ChangeEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle2, Minus, PencilLine, Plus, RotateCcw, Trash2, X} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {Link} from '@/i18n/navigation';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, inputCls, selectCls, btnGold, btnGhost, labelCls} from '@/components/ui/Field';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {ketThucBuoiHop, xoaBienBan} from '@/app/[locale]/(dashboard)/wig/hop/actions';
import {areaLabel, type Area, type AreaMeta} from '@/lib/areas';
import {nhipCuaMoc} from '@/lib/wig-nhip';
import {kieuDonVi} from '@/lib/don-vi';

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

// MỘT EM TRONG BUỔI HỌP — việc tuần này của em, và biên bản riêng của em.
//
// Sinh ra ở 0108 (lát 4+5) cho hai việc chủ dự án chốt 13/08/2026:
//   · "mỗi tuần con làm gì" đổi thành "TUẦN NÀY con làm gì", và tuần sau buổi họp hỏi lại — mặc
//     định giữ nguyên câu cũ, đổi thì em chọn khác;
//   · họp WIG của LỚP phải làm được mọi việc của họp Coach × Buddy, để GVCN vắng hoặc bận thì
//     buổi họp vẫn ghi được biên bản cho từng em.
export type EmHop = {
  id: string;
  ten: string;
  /** Mục tiêu năm (học tập) của em — chỗ treo việc. null = em chưa đặt mục tiêu. */
  wigId: string | null;
  /** Việc đang có. null = chưa có việc nào, gõ tên vào là tạo mới. */
  leadId: string | null;
  viecTitle: string;
  viecUnit: string | null;
  viecDays: number[];
  ketQua: string;
  camKet: string;
};
export type WigOption = {id: string; title: string};
export type ViecMau = {
  title: string;
  target: string;
  unit: string;
  upt: string;
  days: number[];
  // Lĩnh vực việc này thuộc về — để khớp đúng khối mốc tuần tới (0106).
  area: string;
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
  emHop,
  loiHuaTruoc,
  nhanTuanTruoc,
  chiemNghiemCu,
  camKetCu,
  mocDich,
  namHienCo,
  viecMau,
  areaMeta,
  locale,
  dayShort,
  canManage,
  daCoBienBan,
  daChot,
  quayVe,
  xemTuanMoi = null,
}: {
  classId: string;
  hopStart: string;
  hopLabel: string;
  hopRange: string;
  dichLabel: string;
  dichRange: string;
  viecTuanQua: ViecTuanQua[];
  tungEm: EmTrongTuan[];
  emHop: EmHop[];
  loiHuaTruoc: string | null;
  nhanTuanTruoc: string;
  chiemNghiemCu: string;
  camKetCu: string;
  // Mốc tuần đích, mỗi lĩnh vực một cái — app đã rải sẵn từ mục tiêu năm. Buổi họp chỉnh chỉ tiêu
  // của mốc, KHÔNG tạo mục tiêu mới.
  mocDich: {id: string; area: string; title: string; target: number; unit: string}[];
  // Chỉ dùng khi mocDich rỗng: bù đúng một mốc cho tuần này.
  namHienCo: WigOption[];
  viecMau: ViecMau[];
  // Tên + màu 4 lĩnh vực, cho nhãn màu trên mỗi khối mốc (0106).
  areaMeta: Record<Area, AreaMeta>;
  locale: string;
  dayShort: string[];
  canManage: boolean;
  // Tuần này đã có biên bản chưa — quyết định có bày nút gỡ hay không. Bày nút gỡ khi chưa có gì
  // để gỡ là mời người ta bấm một nút chỉ biết báo lỗi.
  daCoBienBan: boolean;
  // Đã bấm CHỐT chưa (0108). Khác "đã có biên bản": lưu tạm cũng sinh biên bản, nhưng chỉ chốt mới
  // khoá tick và khoá ô số đo của tuần.
  daChot: boolean;
  // Đường về trang WIG. null với ban giám hiệu — họ KHÔNG vào được /wig, nên vẽ một liên kết tới
  // đó là vẽ một cái cửa dẫn thẳng tới màn hình "bạn không có quyền".
  quayVe: {pathname: '/wig'; query: Record<string, string>} | null;
  // Trang WIG mở sẵn TUẦN MỚI — đích đến sau khi lưu, nơi mục tiêu tuần vừa tạo nằm. Cùng luật
  // null với quayVe.
  xemTuanMoi?: {pathname: '/wig'; query: Record<string, string>} | null;
}) {
  const t = useTranslations('meeting');
  const tw = useTranslations('wig');
  const tg = useTranslations('goal');
  // Dòng việc nào cho em TỰ ĐIỀN SỐ mỗi ngày. Đơn vị đo lại thì luôn bật, không hỏi.
  const [nhapSo, setNhapSo] = useState<Record<string, boolean>>({});
  const nhapSoCuaDong = (k: string) => Boolean(nhapSo[k]);
  const [state, formAction] = useActionState(ketThucBuoiHop, {ok: false});

  // ── MỘT KHO GIÁ TRỊ CHO TẤT CẢ Ô ─────────────────────────────────────────────────────────
  const [v, setV] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {
      chiem_nghiem: chiemNghiemCu,
      cam_ket: camKetCu,
      bu_nam: namHienCo[0]?.id ?? '',
    };
    // MỖI LĨNH VỰC MỘT CHỈ TIÊU — 0106. Trước đây chỉ ô đầu tiên (moc_id/moc_target) được điền,
    // ba lĩnh vực còn lại im lặng suốt phòng họp. Nay mỗi mốc trong mocDich giữ đúng ô của nó.
    for (const m of mocDich) o[`moc_target_${m.id}`] = String(m.target);
    for (const r of viecTuanQua) {
      o[`verdict_${r.id}`] = r.verdict ?? '';
      o[`note_${r.id}`] = r.note;
    }
    // Ô của TỪNG EM. Điền sẵn câu cũ: "mặc định như cũ, có đổi thì chọn khác" — nên mở buổi họp ra
    // là mọi ô đã đúng, cô chỉ chạm vào những em thật sự đổi.
    for (const e of emHop) {
      o[`em_${e.id}_viec`] = e.viecTitle;
      o[`em_${e.id}_ketqua`] = e.ketQua;
      o[`em_${e.id}_camket`] = e.camKet;
    }
    return o;
  });
  // Thứ trong tuần của từng em — mảng nên không nhét chung vào kho chuỗi ở trên.
  const [emThu, setEmThu] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(emHop.map((e) => [e.id, e.viecDays])),
  );
  const doiThuEm = (id: string, d: number) =>
    setEmThu((p) => {
      const cu = p[id] ?? [];
      return {...p, [id]: cu.includes(d) ? cu.filter((x) => x !== d) : [...cu, d].sort()};
    });
  const set = (k: string, val: string) => setV((p) => ({...p, [k]: val}));
  // Ô NÀO ĐANG CÓ CON TRỎ — để lượt cập nhật realtime không giật chữ khỏi tay người đang gõ.
  const oDangGo = useRef<string | null>(null);
  const oNhap = (k: string) => ({
    value: v[k] ?? '',
    onFocus: () => {
      oDangGo.current = k;
    },
    onBlur: () => {
      if (oDangGo.current === k) oDangGo.current = null;
    },
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
      const cu = JSON.parse(raw) as {v?: Record<string, string>; emThu?: Record<string, number[]>};
      if (!cu?.v) return;
      setV((p) => ({...p, ...cu.v}));
      if (cu.emThu) setEmThu((p) => ({...p, ...cu.emThu}));
      setNhapDaKhoiPhuc(true);
    } catch {
      // Nháp hỏng thì bỏ qua — không có gì để cứu, và không được làm hỏng cả trang vì nó.
    }
  }, [khoaNhap]);
  useEffect(() => {
    if (!daDocNhap.current) return;
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(khoaNhap, JSON.stringify({v, emThu}));
      } catch {
        // Hết chỗ hoặc chế độ riêng tư — nháp là thứ có thì tốt, không có thì thôi.
      }
    }, 500);
    return () => clearTimeout(id);
  }, [khoaNhap, v, emThu]);
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
  // Từ 0111, mỗi em tự điền hai ô của mình ngay trong phòng họp (/student/hop). Chữ ấy đi vào
  // cùng bảng `wig_meetings`, nên chỗ này chỉ cần nghe thay đổi của bảng là bảng "Từng em" tự
  // cập nhật — cô không phải tải lại trang giữa buổi họp.
  //
  // ĐI QUA postgres_changes chứ không qua kênh broadcast: broadcast của Supabase mặc định ai
  // đăng nhập cũng vào được nếu đoán trúng tên kênh, mà đây là chữ của trẻ con. postgres_changes
  // thì Realtime áp đúng RLS của bảng.
  const [dangGoLuc, setDangGoLuc] = useState<Record<string, number>>({});
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
            week_label: string | null;
            results: string | null;
            commitments: string | null;
            hs_go_luc: string | null;
          } | null;
          if (!r?.student_id || r.week_label !== hopLabel) return;
          // GÓI TIN VỪA TỚI LÀ ĐỦ ĐỂ NÓI "vừa có người gõ" — không dò thêm cột nào.
          //
          // Hai lần hụt trước đó ở đúng chỗ này: bản đầu đọc `hs_go_luc` rồi Date.parse() nó,
          // mà Postgres trả "2026-08-13 10:52:14+00" (dấu cách, không phải chữ T) nên parse ra
          // NaN và phép so luôn sai; bản sau lấy giờ máy nhưng vẫn CHỜ có `hs_go_luc` trong gói,
          // mà gói của Realtime không phải lúc nào cũng mang đủ cột. Chữ trong ô thì hiện đúng
          // cả hai lần — mỗi cái chấm động đậy là không.
          // Nay: có tin về dòng của em nào thì em ấy vừa gõ. Chấm hết.
          setDangGoLuc((p) => ({...p, [r.student_id!]: Date.now()}));
          // KHÔNG giật chữ khỏi tay cô. Ô nào cô đang đặt con trỏ vào thì giữ nguyên chữ của cô;
          // hai người gõ cùng một ô là chuyện của buổi họp, không phải chuyện máy phải tự xử.
          setV((p) => {
            const kq = `em_${r.student_id}_ketqua`;
            const ck = `em_${r.student_id}_camket`;
            const moi = {...p};
            if (oDangGo.current !== kq) moi[kq] = r.results ?? '';
            if (oDangGo.current !== ck) moi[ck] = r.commitments ?? '';
            return moi;
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kenh);
    };
  }, [canManage, classId, hopStart, hopLabel]);
  // 6 giây: đủ dài để một em gõ chậm không bị nhấp nháy, đủ ngắn để cô không tưởng em còn đang gõ.
  const dangGo = (id: string) => nhip - (dangGoLuc[id] ?? 0) < 6000;

  // ── DÒNG VIỆC CHO TUẦN TỚI ───────────────────────────────────────────────────────────────
  // Mang sẵn việc của tuần vừa rồi sang: 4DX bảo thước đo dẫn dắt phải bền, đổi mỗi tuần thì
  // không đo được gì. Nhưng vẫn sửa và xoá được — mang sẵn là gợi ý, không phải ép.
  //
  // MỖI DÒNG GIỮ `area` — 0106: một mảng phẳng duy nhất cho cả bốn lĩnh vực, lọc theo lĩnh vực
  // lúc vẽ từng khối mốc. Một mảng, không phải bốn state riêng: xoá/thêm dòng không phải viết
  // bốn lần logic giống hệt nhau.
  const [dong, setDong] = useState<{k: string; area: string; days: number[]}[]>(() =>
    viecMau.map((m, i) => ({k: `m${i}`, area: m.area, days: m.days})),
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
  const themDong = (area: string) => {
    const k = `n${demMoi}`;
    setDemMoi((n) => n + 1);
    setDong((p) => [...p, {k, area, days: [1, 2, 3, 4, 5]}]);
    setViecVal((p) => ({...p, [`viec_${k}_upt`]: '1'}));
  };
  const xoaDong = (k: string) => setDong((p) => p.filter((r) => r.k !== k));

  const err = (f: string) => (state.fieldError === f ? state.error : null);

  // ── NHỊP: mốc tuần CẦN bao nhiêu, việc đang giao CHO được bao nhiêu ────────────────────────
  //
  // Công thức đã dọn về lib/wig-nhip.ts (0106) để màn này và ViecTuan dùng CHUNG một nguồn. Bản
  // cũ ở đây còn quên nhân unit_per_tick trong khi wig_actual có nhân — hai vế lệch thang; nay
  // hệ số được truyền vào cùng mục tiêu.
  //
  // TÍNH RIÊNG CHO TỪNG LĨNH VỰC: bốn mốc độc lập, hụt nhịp của Thể chất không lẫn vào Kiến thức.
  const siSo = tungEm.length;
  const tinhNhip = (m: {id: string; area: string; target: number}) =>
    nhipCuaMoc({
      mocCan: Number(v[`moc_target_${m.id}`]) || m.target,
      siSo,
      viec: dong
        .filter((r) => r.area === m.area)
        .map((r) => ({
          target: Number(viecVal[`viec_${r.k}_target`]) || 0,
          upt: Number(viecVal[`viec_${r.k}_upt`]) || 1,
        })),
    });

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

  // Chốt xong là nháp hết việc — giữ lại thì lần sau mở buổi họp ra nó đè lên số liệu thật.
  useEffect(() => {
    if (state.ok) boNhap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <div className="flex flex-col gap-4">
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

      {/* ══ BƯỚC 1 ══ */}
      <section className="glass rounded-[20px] p-[18px]">
        {buoc(1, t('step1', {week: hopLabel}), t('step1Hint', {range: hopRange}))}

        {/* Nhịp 4DX mở đầu bằng "tuần trước hứa gì" — đặt TRƯỚC bảng để đọc theo đúng thứ tự ấy.
            Tuần trước KHÔNG có cam kết thì vẫn hiện khung, ghi rõ là chưa có: ẩn hẳn đi thì người
            mới dùng tưởng thiếu tính năng — người thử 08/2026 báo đúng chữ "không thấy câu cam
            kết". */}
        <div className="mb-3 flex flex-wrap items-start gap-2 rounded-[14px] border-[1.5px] border-gold-deep/25 bg-gold/[0.12] px-3.5 py-2.5">
          <ArrowRight size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 text-gold-deep" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-gold-text">
              {t('promisedLastWeek', {week: nhanTuanTruoc})}
            </span>
            {loiHuaTruoc ? (
              <p className="mt-0.5 text-[12.5px] font-semibold leading-relaxed text-navy">{loiHuaTruoc}</p>
            ) : (
              <p className="mt-0.5 text-[12.5px] font-semibold italic leading-relaxed text-grey-mid">
                {t('noPromiseLastWeek')}
              </p>
            )}
          </div>
        </div>

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

          {/* MỐC TUẦN ĐÍCH — app đã rải sẵn từ mục tiêu năm; buổi họp CHỈNH chứ không TẠO.
              Trong 4DX mục tiêu đặt một lần cho cả kỳ, buổi họp chỉ báo cáo → nhìn bảng điểm →
              dọn đường. Trước đây khối này tạo một WIG tuần MỚI mỗi tuần, nên số mục tiêu phình
              theo thời gian và mỗi cái có thể lệch đơn vị với cha nó.

              MỘT KHỐI CHO MỖI LĨNH VỰC (0106) — trước đây một ô <select> chỉ cho chỉnh MỘT mốc
              mỗi lần họp; ba lĩnh vực còn lại không có cách nào được đụng tới trong phòng họp,
              và việc của chúng không bao giờ cập nhật qua đây. Chủ dự án bắt đúng chỗ này. */}
          <div className="flex flex-col gap-3">
            {err('viec') && (
              <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-status-bad/[0.08] px-2.5 py-2 text-[12px] font-bold text-status-bad">
                <AlertCircle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                {err('viec')}
              </p>
            )}
            {mocDich.length > 0 ? (
              mocDich.map((m) => {
                const meta = areaMeta[m.area as Area];
                const {mocCan, tongViecCho, thieuNhip} = tinhNhip(m);
                const rows = dong.filter((r) => r.area === m.area);
                return (
                  <div key={m.id} className="rounded-[16px] border-[1.5px] border-navy/10 p-3.5">
                    <div className="mb-2.5 flex flex-wrap items-baseline gap-2">
                      <span
                        className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                        style={{background: meta.soft, color: meta.hex}}
                      >
                        {areaLabel(meta, locale)}
                      </span>
                      <span className="text-[13px] font-bold text-navy">{m.title}</span>
                    </div>

                    <Field
                      label={t('milestoneTarget')}
                      htmlFor={`moc-target-${m.id}`}
                      error={err(`moc_target_${m.id}`)}
                      className="max-w-[180px]"
                    >
                      <input
                        id={`moc-target-${m.id}`}
                        name={`moc_target_${m.id}`}
                        type="number"
                        step="any"
                        min="0.01"
                        inputMode="decimal"
                        {...oNhap(`moc_target_${m.id}`)}
                        className={ctlWithBorder(state.fieldError === `moc_target_${m.id}`)}
                      />
                    </Field>

                    <div className="mt-3">
                      <span className={labelCls}>{tw('workToTick')}</span>
                      <div className="flex flex-col gap-2">
                        {rows.map((r) => (
                          <div key={r.k} className="rounded-[12px] border-[1.5px] border-navy/10 p-2.5">
                            <input type="hidden" name={`viec_${r.k}_moc`} value={m.id} />
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
                              {/* Đơn vị đo lại (điểm, kg) hoặc "mỗi lần một khác" thì KHÔNG có
                                  hệ số quy đổi: em gõ thẳng con số của mình (0114). */}
                              {nhapSoCuaDong(r.k) ? (
                                <div className="flex items-end text-[11.5px] font-bold text-grey-mid">
                                  {t('emTuDienSo')}
                                </div>
                              ) : (
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
                              )}
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
                            {(
                              <label className="mt-2 flex cursor-pointer items-start gap-2 text-[12px] font-bold text-navy">
                                <input
                                  type="checkbox"
                                  name={`viec_${r.k}_nhap`}
                                  value="1"
                                  checked={nhapSoCuaDong(r.k)}
                                  onChange={(e) => setNhapSo((p) => ({...p, [r.k]: e.target.checked}))}
                                  className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--color-navy)]"
                                />
                                {tg('eachTimeVaries')}
                              </label>
                            )}
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
                          onClick={() => themDong(m.area)}
                          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed border-navy/25 px-3 py-2.5 text-[12.5px] font-extrabold text-navy/60 transition-all hover:border-navy/50 hover:bg-navy/[0.03] hover:text-navy"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                          {tw('addWork')}
                        </button>
                      </div>
                      {/* CẢNH BÁO LỆCH NHỊP — Kỷ luật 3 ở dạng cụ thể nhất, và là thứ đáng giá
                          nhất của cả đợt sửa. Nay tính riêng cho TỪNG lĩnh vực. */}
                      {thieuNhip > 0 && (
                        <p className="mt-2 inline-flex items-start gap-1.5 rounded-[10px] bg-gold/[0.14] px-2.5 py-2 text-[11.5px] font-bold text-navy">
                          <AlertTriangle size={13} strokeWidth={2.5} className="mt-px shrink-0" />
                          {t('paceWarn', {can: mocCan, cho: tongViecCho, thieu: thieuNhip})}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : namHienCo.length > 0 ? (
              /* Mốc thiếu — cô khai mục tiêu năm sau khi tuần này đã trôi qua, nên nhịp không phủ
                 tới. BÙ đúng một mốc, không đẻ mục tiêu mới. Trường hợp hiếm, giữ nguyên một khối
                 dùng chung — chưa cần tách theo lĩnh vực vì lúc này CHƯA lĩnh vực nào có mốc cả. */
              <div className="rounded-[14px] border-[1.5px] border-gold/50 bg-gold/[0.08] p-3">
                <p className="mb-2.5 text-[11.5px] font-semibold leading-relaxed text-navy">
                  {t('milestoneMissing', {week: dichLabel})}
                </p>
                <input type="hidden" name="bu_moc" value="1" />
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[2fr_1fr]">
                  <Field label={tw('parentYear')} htmlFor="bu-nam" className="col-span-2 sm:col-span-1">
                    <select id="bu-nam" name="bu_nam" {...oNhap('bu_nam')} className={selectCls}>
                      {namHienCo.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('milestoneTarget')} htmlFor="bu-target" error={err('moc_target')}>
                    <input
                      id="bu-target"
                      name="moc_target"
                      type="number"
                      step="any"
                      min="0.01"
                      inputMode="decimal"
                      {...oNhap('moc_target')}
                      className={ctlWithBorder(state.fieldError === 'moc_target')}
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <span className={labelCls}>{tw('workToTick')}</span>
                  <div className="flex flex-col gap-2">
                    {dong.map((r) => (
                      <div key={r.k} className="rounded-[12px] border-[1.5px] border-navy/10 bg-white p-2.5">
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
                      onClick={() => themDong('')}
                      className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border-[1.5px] border-dashed border-navy/25 bg-white px-3 py-2.5 text-[12.5px] font-extrabold text-navy/60 transition-all hover:border-navy/50 hover:text-navy"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      {tw('addWork')}
                    </button>
                  </div>
                </div>
              </div>
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

      {/* ══ TỪNG EM — việc tuần này, và biên bản riêng ══
          0108 lát 4+5. Hai việc chủ dự án chốt 13/08/2026, và chúng thuộc về cùng một chỗ:

            · "mỗi tuần con làm gì" đổi thành "TUẦN NÀY con làm gì", tuần sau buổi họp HỎI LẠI. Ô
              điền sẵn câu cũ — không đổi thì cứ để nguyên, đổi thì gõ đè. Nên mở buổi họp ra là
              mọi ô đã đúng, cô chỉ chạm vào những em thật sự đổi.
            · Họp lớp làm được mọi việc của họp Coach × Buddy, để GVCN vắng hoặc bận thì buổi họp
              vẫn ghi được biên bản cho từng em. Cùng bảng `wig_meetings`, chỉ khác `student_id`.

          ĐÓNG SẴN trong <details>: ba mươi em × bốn ô là một bức tường, mà phần lớn buổi họp chỉ
          đụng tới vài em. Mở ra là việc của người chủ trì, không phải mặc định của trang. */}
      {canManage && emHop.length > 0 && (
        <details className="glass rounded-[20px] p-4">
          <summary className="cursor-pointer select-none font-display text-[15px] font-bold text-navy">
            {t('perStudent')}{' '}
            <span className="text-[11.5px] font-semibold text-grey-mid">
              {t('perStudentCount', {n: emHop.length})}
            </span>
          </summary>

          <div className="mt-3 flex flex-col gap-2.5">
            {emHop.map((e) => (
              <div key={e.id} className="rounded-[14px] border-[1.5px] border-navy/10 p-3">
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[13.5px] font-extrabold text-navy">{e.ten}</span>
                  {/* Em chưa đặt mục tiêu thì KHÔNG có chỗ treo việc. Nói ra ngay cạnh tên, đừng
                      để cô gõ xong mới biết chữ vừa gõ không đi đâu cả. */}
                  {!e.wigId && (
                    <span className="text-[11px] font-bold text-status-bad">{t('noGoalYet')}</span>
                  )}
                  {/* EM ĐANG GÕ. Ba chấm động đậy đúng chỗ cái tên, không phải một khung thông
                      báo ở góc màn — cô đang nhìn danh sách em, tín hiệu phải nằm trong danh sách
                      ấy. aria-live để trình đọc màn hình cũng nghe được, nhưng 'polite' thôi:
                      đây không phải chuyện cắt ngang. */}
                  {dangGo(e.id) && (
                    <span
                      aria-live="polite"
                      className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
                    >
                      <PencilLine size={10} strokeWidth={2.5} />
                      {t('studentTyping')}
                    </span>
                  )}
                </div>

                {/* Tên đi cùng để câu báo lỗi gọi được đúng em ("Việc của Nguyễn Văn A chưa
                    chọn thứ nào"). Máy chủ không có tên trong tay ở tầng này. */}
                <input type="hidden" name={`em_${e.id}_ten`} value={e.ten} />
                <input type="hidden" name={`em_${e.id}_wig`} value={e.wigId ?? ''} />
                <input type="hidden" name={`em_${e.id}_lead`} value={e.leadId ?? ''} />
                {(emThu[e.id] ?? []).map((d) => (
                  <input key={d} type="hidden" name={`em_${e.id}_days`} value={d} />
                ))}

                {e.wigId && (
                  <>
                    <Field label={t('thisWeekWork')} htmlFor={`em-${e.id}-viec`}>
                      <input
                        id={`em-${e.id}-viec`}
                        name={`em_${e.id}_viec`}
                        {...oNhap(`em_${e.id}_viec`)}
                        className={inputCls}
                      />
                    </Field>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {DOW.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => doiThuEm(e.id, d)}
                          aria-pressed={(emThu[e.id] ?? []).includes(d)}
                          aria-label={`${e.ten} — ${dayShort[d - 1]}`}
                          className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[9px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                            (emThu[e.id] ?? []).includes(d)
                              ? 'border-transparent bg-gold text-navy'
                              : 'border-navy/15 bg-white text-navy/60 hover:border-navy'
                          }`}
                        >
                          {dayShort[d - 1]}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* aria-label KÈM TÊN EM. Nhãn nhìn bằng mắt chỉ ghi "Tuần rồi", và cả trang có
                    hai ô như thế cho MỖI em — nghe bằng trình đọc màn hình thì ba mươi ô đều tên
                    là "Tuần rồi", không biết đang ở ô của ai. Mấy nút thứ ngay trên đã kèm tên
                    từ lâu; hai ô này bị bỏ sót. */}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label={t('emResults')} htmlFor={`em-${e.id}-kq`}>
                    <input
                      id={`em-${e.id}-kq`}
                      name={`em_${e.id}_ketqua`}
                      aria-label={`${e.ten} — ${t('emResults')}`}
                      {...oNhap(`em_${e.id}_ketqua`)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t('emCommit')} htmlFor={`em-${e.id}-ck`}>
                    <input
                      id={`em-${e.id}-ck`}
                      name={`em_${e.id}_camket`}
                      aria-label={`${e.ten} — ${t('emCommit')}`}
                      {...oNhap(`em_${e.id}_camket`)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ══ MỘT NÚT: CUỐI BUỔI HỌP, LƯU LÀ CHỐT ══
          Bản 0108 từng tách đôi thành "Lưu tạm" và "Chốt". Chủ dự án gộp lại 13/08/2026: buổi họp
          chỉ có một thời điểm ghi, và đó là lúc họp xong. Hai nút cạnh nhau chỉ tạo ra câu hỏi
          "bấm cái nào" cho một việc mỗi tuần làm một lần.
          Cột `chot_at` ở CSDL vẫn giữ nguyên và vẫn là thứ khoá tuần — nay nút này luôn đóng dấu
          nó. Giữ cột thay vì quay lại luật cũ ("có dòng nào là khoá") vì luật cũ khoá cả những
          dòng biên bản sinh ra từ đường khác, và vì gỡ biên bản cần một chỗ để gỡ dấu. */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-navy/[0.04] p-4">
          <span className="min-w-0 flex-1 text-[11.5px] font-semibold leading-relaxed text-grey-mid">
            {daChot ? t('closedHint', {week: hopLabel}) : t('finishHint', {week: hopLabel})}
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
          {/* Link ĐẦU trỏ vào tuần mới — nơi mục tiêu vừa tạo nằm. Trước đây chỉ có "Về trang
              WIG" (tuần đang xem cũ): người thử bấm vào và thấy "nhảy về trang wig" chứ không
              thấy thứ mình vừa tạo. */}
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
