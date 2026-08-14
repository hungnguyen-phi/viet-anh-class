'use client';

import {useOptimistic, useState, useTransition} from 'react';
import {useRouter} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import {Check, Flame, Loader2, Lock} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';

export type TickerLead = {
  id: string;
  title: string;
  target: number;
  unit: string | null;
  // 'class' = việc CHUNG của lớp — mỗi lượt tick của mọi bạn cộng vào cùng một bộ đếm, và chính
  // bộ đếm đó quyết định WIG tuần của lớp thắng hay thua (0073).
  // 'mine'  = việc riêng của em, chỉ tính cho WIG cá nhân.
  kind: 'class' | 'mine';
  // Những NGÀY trong tuần này mà việc này được tick — đã lọc theo `active_weekdays` của lead
  // measure, nên bảng không còn bày ra T7/CN cho một việc chỉ làm ngày đi học.
  days: string[];
  // Ngày chính em đã tick.
  myDates: string[];
  // 0076 — một lượt tick đáng bao nhiêu ĐƠN VỊ của mục tiêu. Mặc định 1.
  //
  // Phải có ở đây vì `target` tính theo ĐƠN VỊ (vd 150 phút) còn `myDates` đếm theo LẦN (5 tối).
  // Không quy đổi thì thanh tiến độ đọc ra "5/150" — em đọc thành gần như chưa làm gì, trong khi
  // thật ra đã xong. Việc CHUNG không vướng chuyện này vì `classTotal` đến từ class_lead_board,
  // nơi hệ số đã được nhân sẵn trong SQL.
  unitPerTick: number;
  // Chỉ có ở việc chung: tổng cả lớp đã góp, và bao nhiêu bạn đã góp.
  classTotal: number | null;
  contributors: number | null;
  classSize: number | null;
  // 0098 — MỖI EM MỘT BỘ ĐẾM. `myTotal` là tổng của CHÍNH EM (đã nhân hệ số) và là thứ thanh
  // tiến độ đo từ nay; `studentsDone` là số bạn đã đạt đủ, nay chỉ còn dùng để đếm ra "còn chờ
  // mấy bạn nữa" khi em đã xong phần mình.
  myTotal: number | null;
  studentsDone: number | null;
  // 0110 — Ô NGÀY LÀ Ô ĐIỀN SỐ, không phải một chạm.
  //
  // Đơn vị đếm được bằng một lượt (ngày, buổi, tiết, lần) thì một chạm là đủ và là thứ phải giữ:
  // đây là việc em làm MỖI NGÀY, thêm một bước gõ vào đúng chỗ ấy là thêm ma sát vào chỗ ít chịu
  // được ma sát nhất. Đơn vị không đếm được bằng một lượt (giờ, bài, trang, lead) thì một chạm nói
  // dối: em học 3 giờ hôm nay và 1 giờ hôm sau, tick đều ra 1-1. Chủ dự án chốt 13/08/2026.
  nhapLuong: boolean;
  /** Lượng của từng ngày em đã ghi. Chỉ dùng khi `nhapLuong`. */
  myValues: Record<string, number>;
};

type Action = {leadId: string; date: string; on: boolean};

// Bảng tick hằng ngày của học sinh.
//
// Viết lại 2026-08-02 (0073) vì hai lý do:
//
// 1. NGUỒN SỐ LIỆU. Trước đây bảng này chỉ chứa việc của WIG CÁ NHÂN, còn WIG của lớp thì giáo
//    viên tự bấm "Ghi +" để cộng số. Nay em tick thẳng vào việc chung của lớp, nên cái em bấm ở
//    đây CHÍNH LÀ con số quyết định lớp thắng hay thua tuần này — và bảng phải nói được điều đó,
//    nếu không thì em vẫn tưởng mình đang tự chấm điểm cho riêng mình.
//
// 2. ĐÂY LÀ VIỆC HẰNG NGÀY. Bản cũ đưa ra một dải 7 ô T2…CN như nhau cho mọi việc, không phân
//    biệt hôm nay là ô nào, và mỗi lần bấm phải chờ trọn một vòng máy chủ mới thấy ô đổi màu.
//    Bản này: khối "Hôm nay" nằm trên cùng để việc thường ngày chỉ còn MỘT chạm, ô đổi màu ngay
//    lập tức (useOptimistic), và có chuỗi ngày liên tiếp 🔥 để em thấy công mình đang dài ra.
//
// Luật khoá vẫn nguyên: RLS (0046/0048/0073) là chốt cuối — trong tuần, không quá hôm nay, tuần
// chưa chốt, và đúng thứ mà việc đó áp dụng. Giao diện chỉ phản ánh lại cho khỏi bấm vô ích.
export function LeadTicker({
  leads,
  studentId,
  canTick,
  nguoiGhi,
  today,
  tickOpen,
}: {
  leads: TickerLead[];
  studentId: string;
  canTick: boolean;
  // AI ĐANG BẤM — không phải lúc nào cũng là chính em.
  //
  // Chủ dự án chốt 10/08/2026: "ai cũng có điện thoại, vẫn có gv tick hộ". Trước bản này giao
  // diện chỉ có đường GỠ tick (removeLeadEntry) — cô gỡ được nhưng không thêm được, dù RLS
  // (rls_all_lead_progress) đã cho GVCN toàn quyền với lớp mình từ lâu. Thiếu đúng một đường trên
  // màn hình.
  //
  // `student_id` luôn là EM (công thuộc về em, mọi bảng đếm theo cột này); `logged_by` là người
  // bấm. Tách hai cột chính là thứ cho phép tick hộ mà không làm sai một con số nào.
  nguoiGhi: string;
  // Hôm nay theo GIỜ VN.
  today: string;
  // Tuần còn cho sửa không (theo ngày chốt của lớp).
  tickOpen: boolean;
}) {
  const t = useTranslations('student');
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());
  // `isPending` của useTransition KHÔNG dùng nữa: nó gộp mọi lượt đang bay thành một cờ chung,
  // mà chính cờ chung ấy là thứ khoá cả dải và làm rơi cú chạm thứ hai. Trạng thái "đang ghi" nay
  // theo TỪNG Ô (xem `oDangGhi` ngay dưới) — vẫn đủ để ô đang bay đóng băng và xoay theo đúng luật
  // "nút nào tự chạy việc thì phải ghi nhận, đóng băng và xoay, đừng im lặng tải".
  const [, startTransition] = useTransition();
  // NHỮNG Ô ĐANG ĐƯỢC GHI — một tập, không phải một ô.
  //
  // Bản trước khoá CẢ DẢI trong lúc một lượt tick đang bay ("bấm chồng lên một lượt chưa xong là
  // hai lệnh đá nhau"). Lý do ấy chỉ đúng với CÙNG MỘT ô: hai ngày khác nhau là hai dòng khác
  // nhau trong lead_progress, không có gì để đá nhau cả. Cái giá của việc khoá cả dải thì rất
  // thật — bạn nào dồn cuối tuần, chạm T2 rồi chạm T4 ngay, cú thứ hai rơi vào một nút vừa bị
  // disabled: không lỗi, không xoay, không dấu vết, và bảng chỉ ghi một ngày. Đã dựng lại đúng
  // cảnh ấy trên production 13/08/2026 và mất thật một lượt.
  // Nay chỉ khoá đúng ô đang bay; các ô còn lại chạm được ngay.
  const [oDangGhi, setODangGhi] = useState<ReadonlySet<string>>(() => new Set());
  const dangGhiO = (leadId: string, date: string) => oDangGhi.has(`${leadId}|${date}`);
  const danhDauGhi = (k: string, dang: boolean) =>
    setODangGhi((p) => {
      const s = new Set(p);
      if (dang) s.add(k);
      else s.delete(k);
      return s;
    });

  // Đổi màu NGAY khi bấm, không chờ máy chủ. Với một việc làm mỗi ngày thì độ trễ 200–400 ms mỗi
  // lượt là thứ cảm nhận được — và cảm giác "bấm mà không thấy gì" khiến người ta bấm lại lần nữa.
  // useOptimistic tự hoàn tác nếu transition kết thúc mà dữ liệu thật không đổi.
  const [view, apply] = useOptimistic(leads, (state: TickerLead[], a: Action) =>
    state.map((l) => {
      if (l.id !== a.leadId) return l;
      const set = new Set(l.myDates);
      if (a.on) set.add(a.date);
      else set.delete(a.date);
      // Nhích đúng bằng hệ số, không phải 1: các con số này tính theo ĐƠN VỊ của mục tiêu (SQL
      // đã nhân sẵn), nên cộng 1 vào đó là lệch ngay lúc bấm rồi lại nhảy về khi dữ liệu thật tới.
      const buoc = a.on ? l.unitPerTick : -l.unitPerTick;
      const moi = l.myTotal === null ? null : l.myTotal + buoc;
      // Vừa bấm mà em đủ (hoặc vừa bỏ tick mà tụt xuống dưới mục tiêu) thì dòng "n bạn đã đủ"
      // phải đổi theo ngay — nếu không, em đạt đủ 3/3 mà cả lớp vẫn ghi 0/2, đọc như tick hụt.
      const duTruoc = l.myTotal !== null && l.target > 0 && l.myTotal >= l.target;
      const duSau = moi !== null && l.target > 0 && moi >= l.target;
      return {
        ...l,
        myDates: [...set].sort(),
        myTotal: moi,
        classTotal: l.classTotal === null ? null : l.classTotal + buoc,
        studentsDone:
          l.studentsDone === null ? null : l.studentsDone + (duSau ? 1 : 0) - (duTruoc ? 1 : 0),
      };
    }),
  );

  const dayShort = t.raw('dayShort') as string[];
  const isoDow = (d: string) => {
    const n = new Date(`${d}T00:00:00Z`).getUTCDay();
    return n === 0 ? 7 : n;
  };

  // GHI LƯỢNG — cho việc đếm theo số (nhapLuong).
  //
  // KHÔNG cập nhật lạc quan ở đây, khác hẳn `toggle`. Lý do của useOptimistic là "bấm mà không
  // thấy gì thì người ta bấm lại"; còn đây em GÕ một con số rồi rời ô, nên đã có phản hồi thị giác
  // sẵn trong chính ô ấy. Đoán trước một con số do người gõ còn dễ nhảy số hơn là chờ.
  //
  // Ô để TRỐNG = xoá dòng của hôm đó, đúng nghĩa "hôm nay không làm". Không ghi 0: một dòng value=0
  // vướng `lead_progress_value_pos`, và "có ghi nhận nhưng bằng 0" khác "không có ghi nhận".
  function ghiLuong(lead: TickerLead, date: string, raw: string) {
    if (!canTick || !tickOpen || date > today || dangGhiO(lead.id, date)) return;
    const cu = lead.myValues[date];
    // Ô SỐ ĐỂ TRỐNG KHÔNG CÒN NGHĨA LÀ "XOÁ" (14/08/2026).
    //
    // Trước đây bỏ trống = xoá dòng của ngày ấy, vì ô số là thứ DUY NHẤT trên ô ngày. Nay ngày đã
    // có nút tick riêng: tick nói "hôm nay có làm", ô số chỉ nói "được bao nhiêu". Nên xoá số thì
    // lượt làm vẫn còn, chỉ quay về 1 — muốn bỏ hẳn thì bỏ tick.
    const val = raw.trim() === '' ? 1 : Number(raw);
    if (!Number.isFinite(val) || val <= 0) {
      setErr(t('luongPhaiDuong'));
      return;
    }
    if ((cu ?? null) === val) return;
    setErr(null);
    const oKey = `${lead.id}|${date}`;
    danhDauGhi(oKey, true);
    startTransition(async () => {
      {
        // Một dòng mỗi (việc, em, ngày) — uq_lead_progress_daily. Ghi lại cùng ngày là SỬA.
        const {error} = await supabase.from('lead_progress').upsert(
          {
            lead_measure_id: lead.id,
            student_id: studentId,
            logged_by: nguoiGhi,
            value: val,
            logged_date: date,
          },
          {onConflict: 'lead_measure_id,student_id,logged_date'},
        );
        if (error) {
          // Trigger chan_luong_vo_ly (0110) chặn số lớn hơn cả chỉ tiêu một tuần — nói đúng chuyện
          // đó thay vì câu lỗi chung, vì đây là lỗi người gõ sửa được ngay.
          danhDauGhi(oKey, false);
          setErr(error.code === '23514' ? t('luongQuaLon', {n: lead.target}) : t('tickError'));
          return;
        }
      }
      danhDauGhi(oKey, false);
      router.refresh();
    });
  }

  function toggle(lead: TickerLead, date: string) {
    if (!canTick || !tickOpen || date > today || dangGhiO(lead.id, date)) return;
    const on = !lead.myDates.includes(date);
    setErr(null);
    const oKey = `${lead.id}|${date}`;
    danhDauGhi(oKey, true);
    startTransition(async () => {
      apply({leadId: lead.id, date, on});
      if (on) {
        const {error} = await supabase.from('lead_progress').insert({
          lead_measure_id: lead.id,
          student_id: studentId,
          logged_by: nguoiGhi,
          value: 1,
          logged_date: date,
        });
        // 23505 = đã có tick ngày đó (chỉ mục duy nhất 1 lượt/ngày) → coi như xong.
        if (error && error.code !== '23505') {
          danhDauGhi(oKey, false);
          setErr(t('tickError'));
          return;
        }
      } else {
        // Xoá theo (việc, em, ngày) chứ không theo id dòng: chỉ mục uq_lead_progress_daily bảo
        // đảm nhiều nhất một dòng, nên không cần mang id của từng dòng xuống trình duyệt.
        const {error} = await supabase
          .from('lead_progress')
          .delete()
          .eq('lead_measure_id', lead.id)
          .eq('student_id', studentId)
          .eq('logged_date', date);
        if (error) {
          danhDauGhi(oKey, false);
          setErr(t('undoError'));
          return;
        }
      }
      danhDauGhi(oKey, false);
      router.refresh();
    });
  }

  // Chuỗi ngày liên tiếp tính ngược từ ngày áp dụng gần nhất (không tính ngày chưa tới).
  const streakOf = (l: TickerLead) => {
    const past = l.days.filter((d) => d <= today);
    const set = new Set(l.myDates);
    let n = 0;
    for (let i = past.length - 1; i >= 0; i--) {
      if (!set.has(past[i])) break;
      n += 1;
    }
    return n;
  };

  const classLeads = view.filter((l) => l.kind === 'class');
  const myLeads = view.filter((l) => l.kind === 'mine');
  // Việc của HÔM NAY — chỉ những việc mà hôm nay đúng là thứ áp dụng.
  const todayLeads = view.filter((l) => l.days.includes(today));
  const todayLeft = todayLeads.filter((l) => !l.myDates.includes(today));

  // ---- Một việc: tiến độ + dải ngày ----
  const leadCard = (l: TickerLead) => {
    // THƯỚC ĐO LÀ CỦA CHÍNH EM (0098), không phải tổng cả lớp.
    //
    // Trước đây thanh này đo tổng tick của mọi bạn so với mục tiêu, nên Claudia tick một lượt
    // thấy 1/3, Alex tick một lượt thì màn của Claudia nhảy lên 2/3 — công của bạn hiện trên
    // thẻ của mình. Nay mục tiêu là "mỗi em 3 bài": em nào cũng phải tự đi hết quãng của mình.
    //
    // Quy về đơn vị của mục tiêu: 5 tối × 30 phút = 150 phút, không phải 5. Câu "em góp N lượt"
    // bên dưới vẫn đếm theo LẦN BẤM (myDates.length) — em nhìn 3 ô vàng mà đọc "em góp 90 lượt"
    // thì con số không còn nói về thứ em vừa làm nữa.
    const mine = l.myTotal ?? l.myDates.length * l.unitPerTick;
    const pct = l.target > 0 ? Math.min(1, mine / l.target) : 0;
    const done = l.target > 0 && mine >= l.target;
    const streak = streakOf(l);
    const left = Math.max(0, l.target - mine);
    // Còn mấy bạn nữa thì cả lớp mới thắng việc này.
    const banConThieu = Math.max(0, (l.classSize ?? 0) - (l.studentsDone ?? 0));

    return (
      <div key={l.id} className="rounded-[16px] border-[1.5px] border-navy/10 bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-navy">
            {l.title}
          </span>
          {streak >= 2 && (
            <span
              title={t('streakHint')}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-extrabold text-navy"
            >
              <Flame size={12} strokeWidth={2.5} />
              {streak}
            </span>
          )}
          {done && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
              <Check size={11} strokeWidth={3} />
              {t('doneTag')}
            </span>
          )}
          <span className="shrink-0 text-[12.5px] font-extrabold tabular-nums text-grey-mid">
            {/* Ghi rõ "Em:" ở việc chung — cùng một thẻ mà có hai con số (của em và của lớp),
                không gắn nhãn thì lại đọc nhầm y như bản cũ. */}
            {l.kind === 'class' ? `${t('mineLabel')}: ` : ''}
            {Math.min(mine, l.target)}/{l.target} {l.unit ?? ''}
          </span>
        </div>

        <div className="mt-2 h-[10px] w-full overflow-hidden rounded-[5px] bg-navy/[0.08]">
          <div
            className="h-full rounded-[5px] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              width: `${Math.round(pct * 100)}%`,
              background: done ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
            }}
          />
        </div>

        {/* CHỈ CÒN VIỆC CÒN PHẢI LÀM, không còn bản tường thuật.
            Bỏ "0/3 bạn đã đủ · em góp 2 lượt": con số "em góp" chính là con số đã in to ngay trên
            thanh ("Em: 2/5"), còn "0/3 bạn đã đủ" thì em không làm gì được với nó. Cái duy nhất
            khiến em bấm tiếp là phần CÒN THIẾU — nên chỉ giữ đúng dòng ấy: chưa đủ thì nói phần
            của em, em đủ rồi mà lớp chưa thắng thì nói còn chờ mấy bạn. */}
        {((!done && left > 0) || (done && l.kind === 'class' && banConThieu > 0)) && (
          <p className="mt-1.5 text-[11.5px] font-bold text-navy/70">
            {!done && left > 0
              ? t('remainingMine', {n: left})
              : t('remainingFriends', {n: banConThieu})}
          </p>
        )}

        {/* Dải ngày — chỉ những thứ mà việc này áp dụng. Ô 44px: đây là màn của học sinh, và
            các em bấm bằng ngón tay trên máy tính bảng (WCAG 2.5.5 mức AAA). */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {l.days.map((d) => {
            const ticked = l.myDates.includes(d);
            const future = d > today;
            const isToday = d === today;
            // Chỉ khoá ĐÚNG ô đang bay — hai ngày khác nhau là hai dòng khác nhau, chạm song song
            // được. Khoá cả dải chính là lỗi làm rơi cú chạm thứ hai (xem `oDangGhi`).
            const dangBay = dangGhiO(l.id, d);
            const disabled = !canTick || !tickOpen || future || dangBay;

            // ── Ô ĐIỀN SỐ (0110) ──
            // Nhãn thứ nằm TRÊN ô, không thay chỗ ô: em phải thấy cả "thứ mấy" lẫn "bao nhiêu"
            // cùng lúc. Ghi khi rời ô (onBlur) chứ không theo từng phím — gõ "12" mà ghi ngay ở
            // phím đầu là ghi mất một dòng value=1 rồi sửa, và trigger chặn số vô lý sẽ nổ giữa
            // chừng lúc em còn đang gõ dở.
            // ── Ô CÓ SỐ: TICK TRƯỚC, SỐ SAU ──
            //
            // Chủ dự án chốt 14/08/2026: "có thể ngày đó ko nhập cũng được, nhưng phải tick có
            // làm". Bản 0110 làm ô ngày thành một ô số TRẦN — không có tick, nên không có cách
            // nào nói "hôm nay em có làm mà chưa kịp đếm", và bỏ trống thì mất luôn dòng.
            // Nay giữ nguyên nút tick 44px như mọi việc khác, và treo một ô số nhỏ bên dưới,
            // chỉ mở khi ô đã được tick. Tick = có làm (tính 1); gõ số = làm được bao nhiêu.
            if (l.nhapLuong)
              return (
                <div key={d} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggle(l, d)}
                    disabled={disabled}
                    title={`${dayShort[isoDow(d) - 1]} ${d.slice(5)}`}
                    aria-label={`${l.title} — ${dayShort[isoDow(d) - 1]} ${d.slice(5)}`}
                    aria-pressed={ticked}
                    className={`relative grid h-11 w-11 place-items-center rounded-[12px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                      ticked
                        ? `border-transparent bg-gold text-navy shadow-[var(--shadow-gold)]${disabled ? ' opacity-45' : ''}`
                        : disabled
                          ? 'border-navy/10 bg-navy/[0.03] text-grey-mid'
                          : 'border-navy/15 bg-white text-grey-mid'
                    } ${isToday && !ticked ? 'border-navy ring-2 ring-navy/15' : ''} ${
                      disabled ? 'cursor-default' : 'cursor-pointer hover:border-navy active:scale-95'
                    }`}
                  >
                    {dayShort[isoDow(d) - 1]}
                    {ticked && (
                      <span className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-navy text-white">
                        <Check size={11} strokeWidth={3.5} />
                      </span>
                    )}
                  </button>
                  <span className="relative inline-grid place-items-center">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      defaultValue={l.myValues[d] && l.myValues[d] !== 1 ? l.myValues[d] : ''}
                      disabled={disabled || !ticked}
                      onBlur={(e) => ghiLuong(l, d, e.target.value)}
                      placeholder={l.unit ?? ''}
                      aria-label={`${l.title} — ${dayShort[isoDow(d) - 1]} ${d.slice(5)} — ${t('luongOLabel')}`}
                      aria-busy={dangBay}
                      className={`h-8 w-11 rounded-[9px] border-[1.5px] text-center text-[11.5px] font-extrabold tabular-nums transition-all ${
                        ticked ? 'border-navy/20 bg-white text-navy' : 'border-navy/10 bg-navy/[0.03] text-grey-mid'
                      } ${disabled || !ticked ? 'cursor-default opacity-60' : ''} ${
                        dangBay ? 'text-transparent' : ''
                      }`}
                    />
                    {dangBay && (
                      <Loader2
                        size={13}
                        strokeWidth={2.5}
                        className="pointer-events-none absolute animate-spin text-navy"
                      />
                    )}
                  </span>
                </div>
              );

            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle(l, d)}
                disabled={disabled}
                title={`${dayShort[isoDow(d) - 1]} ${d.slice(5)}`}
                aria-label={`${l.title} — ${dayShort[isoDow(d) - 1]} ${d.slice(5)}`}
                aria-pressed={ticked}
                // MỜ ĐI THÌ MỜ CÁI Ô, ĐỪNG MỜ CHỮ.
                //
                // Bản cũ chồng `opacity-45` lên cả nút, mà chữ vốn đã là `text-navy/60` — nhân
                // hai lớp mờ vào nhau thì "T6" của ngày chưa tới chỉ còn 3.96:1, dưới ngưỡng AA
                // 4.5 (đo ở 360px ngày 14/08/2026). Em nhìn không ra hôm đó là thứ mấy.
                // Nay ô chưa bấm được dùng nền xám nhạt + chữ grey-mid đặc (6.50:1): vẫn đọc ra
                // là "chưa tới lượt", mà đọc ĐƯỢC. Ô đã tick thì giữ nguyên lớp mờ cũ — chữ sẫm
                // trên nền vàng vẫn rõ, và đó là dấu duy nhất cho biết tuần đã khoá.
                className={`relative grid h-11 w-11 place-items-center rounded-[12px] border-[1.5px] text-[11.5px] font-extrabold transition-all ${
                  ticked
                    ? `border-transparent bg-gold text-navy shadow-[var(--shadow-gold)]${disabled ? ' opacity-45' : ''}`
                    : disabled
                      ? 'border-navy/10 bg-navy/[0.03] text-grey-mid'
                      : // grey-mid (#575c7d, 6.50:1) chứ không navy/60 (3.96:1 — trượt AA).
                        // Đây là ô NGÀY THƯỜNG, chưa bấm, không khoá gì cả — tôi tưởng con số
                        // 3.96 đến từ ô bị mờ nên sửa nhầm chỗ một lần rồi (14/08/2026). Chữ mờ
                        // trong dự án này có sẵn một token đạt chuẩn; navy/60 là màu tự chế.
                        'border-navy/15 bg-white text-grey-mid'
                } ${isToday && !ticked ? 'border-navy ring-2 ring-navy/15' : ''} ${
                  disabled ? 'cursor-default' : 'cursor-pointer hover:border-navy active:scale-95'
                }`}
              >
                {/* Ô đã tick vẫn GIỮ tên thứ, dấu ✓ là huy hiệu góc. Bản đầu thay hẳn tên thứ
                    bằng dấu ✓ — nhìn dải "✓ ✓ T6 T7 CN" thì không đọc ra hai ô vàng là thứ mấy,
                    mà tick bù đúng ngày lại chính là việc hay làm nhất ở dải này. */}
                {dayShort[isoDow(d) - 1]}
                {ticked && (
                  <span className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-navy text-white">
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── BẤM HỤT THÌ PHẢI NÓI NGAY TẠI CHỖ ────────────────────────────────────────────────
          Câu báo lỗi và câu "tuần này đã chốt" trước đây đều nằm ở CUỐI khối, dưới ba bốn thẻ
          phải cuộn. Em bấm một ô, ô không đổi màu, và lời giải thích thì ở ngoài màn hình — em
          chỉ biết là bấm không ăn. Đưa lên đầu, ngay trên chính mấy cái ô ấy.
          role="alert" để trình đọc màn hình đọc ra ngay, không đợi em tự dò tới. */}
      {err && (
        <p
          role="alert"
          className="rounded-[12px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-3 py-2 text-[12.5px] font-bold leading-relaxed text-status-bad"
        >
          {err}
        </p>
      )}
      {canTick && !tickOpen && (
        <p className="inline-flex items-start gap-1.5 rounded-[12px] bg-navy/[0.05] px-3 py-2 text-[12px] font-semibold leading-relaxed text-grey-mid">
          <Lock size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {t('tickWeekLocked')}
        </p>
      )}

      {/* ---- HÔM NAY: việc thường ngày, một chạm ---- */}
      {canTick && todayLeads.length > 0 && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] font-bold text-navy">{t('todayTitle')}</span>
            <span className="rounded-full bg-navy/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-grey-mid">
              {dayShort[isoDow(today) - 1]} · {today.slice(5)}
            </span>
            {todayLeft.length === 0 && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/[0.12] px-2.5 py-1 text-[11px] font-extrabold text-success-dark">
                <Check size={12} strokeWidth={3} />
                {t('todayAllDone')}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {todayLeads.map((l) => {
              const ticked = l.myDates.includes(today);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l, today)}
                  disabled={!tickOpen}
                  aria-pressed={ticked}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-2.5 text-left transition-all ${
                    ticked
                      ? 'border-transparent bg-gold/25'
                      : 'border-navy/15 bg-white hover:border-navy'
                  } ${tickOpen ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default opacity-60'}`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all ${
                      ticked ? 'border-transparent bg-gold text-navy' : 'border-navy/20 text-transparent'
                    }`}
                  >
                    <Check size={17} strokeWidth={3.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold text-navy">{l.title}</span>
                    <span className="block text-[11.5px] font-semibold text-grey-mid">
                      {l.kind === 'class' ? t('classWork') : t('myWork')}
                    </span>
                  </span>
                  {ticked && (
                    <span className="shrink-0 text-[11.5px] font-extrabold text-navy/70">
                      {t('tickedToday')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- MỘT BẢNG TICK, HAI NHÃN ----
           Trước đây đây là HAI khối rời có hai tiêu đề riêng: "việc chung của lớp" và "việc riêng
           của em". Chủ dự án gọi đúng tên vấn đề — em mở app ra thấy hai bảng chồng nhau và không
           biết dòng nào của dòng nào. Mỗi thẻ vốn đã mang sẵn nhãn "của lớp"/"của con", nên gộp
           lại là đủ để phân biệt mà không cần chia đôi màn hình.
           Việc CHUNG đứng trước: đó là thứ quyết định lớp thắng hay thua tuần này.

           KHÔNG CÒN TIÊU ĐỀ Ở ĐÂY. Khối này luôn được StudentScoreboard bọc trong một section đã
           có sẵn nhãn "Lead Measure" ngay bên trên (LeadTicker không dùng ở đâu khác), nên tiêu đề
           riêng chỉ là dòng chữ thứ hai nói lại cùng một thứ. */}
      {view.length > 0 && (
        <section className="flex flex-col gap-2">
          {classLeads.map(leadCard)}
          {myLeads.map(leadCard)}
        </section>
      )}

      {/* Câu "trong tuần tick / bỏ tick / tick bù thoải mái, họp WIG là khoá" đã bỏ: nó tả một
          luật mà em KHÔNG cần biết trước — lúc chưa khoá thì bấm là ăn, lúc khoá rồi thì đã có
          câu `tickWeekLocked` ở đầu khối nói đúng chuyện đang xảy ra. Hai câu BÁO HỎNG vẫn ở đầu. */}
    </div>
  );
}
