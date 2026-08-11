import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft, ChevronLeft, ChevronRight, RotateCcw} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {Link} from '@/i18n/navigation';
import {NutDoiTrang} from '@/components/ui/NutDoiTrang';
import {isValidDayVN, isoWeekLabel, mondayOf, todayInVN, shiftWeeks, vnNoon} from '@/lib/dates';
import {layDuLieuHop} from '@/lib/hop-data';
import {PhongHop} from '@/components/wig/PhongHop';

// ════════════════════════════════════════════════════════════════════════════
// /wig/hop — PHÒNG HỌP WIG
// ════════════════════════════════════════════════════════════════════════════
//
// TUẦN ĐANG TỔNG KẾT MẶC ĐỊNH LÀ TUẦN VỪA XONG, không phải tuần này. Chủ dự án chốt
// (2026-08-04): "tuần nào ra tuần đó, kiểu sẽ họp vào cuối tuần hoặc là T2, T3 tuần sau, nhưng
// vẫn phải dùng số liệu tuần trước để họp, không cần đưa số liệu tuần này vào".
//
// Bản đầu cho khối họp bám theo thanh ← → của trang WIG, nên sáng thứ Hai mở ra thấy 0/30 — tuần
// mới chưa ai tick — còn số thật cần bàn thì nằm ở chỗ khác. Nhìn ngược hẳn.
export default async function HopPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; week?: string; hop?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, week: weekParam, hop: hopParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin']);
  const t = await getTranslations('meeting');
  const tw = await getTranslations('wig');
  const supabase = await createClient();
  const {myClass} = await getClassContext(supabase, profile, classParam);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  const thisMonday = mondayOf(todayInVN());
  const macDinh = shiftWeeks(thisMonday, -1); // tuần vừa xong
  const hopMonday = isValidDayVN(hopParam) ? mondayOf(hopParam as string) : macDinh;
  const laTuanVuaXong = hopMonday === macDinh;

  const d = await layDuLieuHop(supabase, myClass.id, hopMonday, {
    year: tw('year'),
    month: tw('month'),
    week: tw('week'),
  });

  const dm = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  const linkHop = (m: string) => ({
    pathname: '/wig/hop' as const,
    query: {
      ...(classParam ? {class: classParam} : {}),
      ...(weekParam ? {week: weekParam} : {}),
      ...(m === macDinh ? {} : {hop: m}),
    },
  });
  const quayVe = {
    pathname: '/wig' as const,
    query: {...(classParam ? {class: classParam} : {}), ...(weekParam ? {week: weekParam} : {})},
  };
  const nut =
    'grid h-9 w-9 place-items-center rounded-[10px] border-[1.5px] border-navy/20 bg-white text-navy transition-all hover:border-navy';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={quayVe}
          className="inline-flex items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-2.5 py-2 text-[12px] font-extrabold text-navy transition-all hover:border-navy"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          {t('backToWig')}
        </Link>
        <h1 className="font-display text-[20px] font-bold text-navy">
          {t('roomTitle')} · {myClass.name}
        </h1>
        <span className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/20 px-2.5 py-1 text-[11px] font-extrabold text-gold-text">
          {d.hop.label} → {d.dich.label}
        </span>
      </div>

      {/* Chọn TUẦN ĐANG TỔNG KẾT. Riêng với thanh tuần của trang /wig: ở đó là "đang xem tuần
          nào", ở đây là "đang họp về tuần nào" — hai câu hỏi khác nhau, và trộn chung chính là
          thứ khiến sáng thứ Hai mở ra thấy toàn số 0. */}
      {/* NutDoiTrang chứ không phải <Link>: đổi tuần phải chạy lại cả loạt truy vấn của
          layDuLieuHop, và người thử 08/2026 báo "không bấm di chuyển tuần được" — thật ra là bấm
          được nhưng không có gì phản hồi trong lúc chờ. */}
      <section className="glass flex flex-wrap items-center justify-center gap-2 rounded-[20px] p-3">
        <NutDoiTrang href={linkHop(shiftWeeks(hopMonday, -1))} className={nut} ariaLabel={t('prevWeek')}>
          <ChevronLeft size={16} strokeWidth={2.5} />
        </NutDoiTrang>
        <span className="text-[13px] font-extrabold text-navy">
          {t('summarising', {week: d.hop.label})}
        </span>
        <span className="text-[11.5px] font-bold tabular-nums text-grey-mid">
          {dm(d.hop.start)} → {dm(d.hop.end)}
        </span>
        <NutDoiTrang href={linkHop(shiftWeeks(hopMonday, 1))} className={nut} ariaLabel={t('nextWeek')}>
          <ChevronRight size={16} strokeWidth={2.5} />
        </NutDoiTrang>
        {!laTuanVuaXong && (
          <NutDoiTrang
            href={linkHop(macDinh)}
            className="inline-flex items-center gap-1 rounded-full bg-navy/[0.06] px-3 py-1.5 text-[11.5px] font-extrabold text-navy transition-all hover:bg-navy/[0.12]"
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            {t('backToLastWeek')}
          </NutDoiTrang>
        )}
      </section>

      {/* key ép remount khi đổi tuần đang tổng kết. Thiếu nó thì đổi ?hop= giữ nguyên instance
          client, mà mọi ô chấm/ghi chú/cam kết khởi tạo bằng useState(() => …) chỉ chạy đúng một
          lần lúc mount — tiêu đề đổi tuần còn ruột form vẫn là tuần cũ, người thử đọc thành "bấm
          không ăn". Cùng mẫu với attendance/page.tsx. */}
      <PhongHop
        key={`${myClass.id}-${hopMonday}`}
        classId={myClass.id}
        hopStart={d.hop.start}
        hopLabel={d.hop.label}
        hopRange={`${dm(d.hop.start)} → ${dm(d.hop.end)}`}
        dichLabel={d.dich.label}
        dichRange={`${dm(d.dich.start)} → ${dm(d.dich.end)}`}
        viecTuanQua={d.viecTuanQua}
        tungEm={d.tungEm}
        loiHuaTruoc={d.loiHuaTruoc}
        nhanTuanTruoc={isoWeekLabel(vnNoon(d.truocMonday))}
        chiemNghiemCu={d.chiemNghiemCu}
        camKetCu={d.camKetCu}
        daCoBienBan={d.daCoBienBan}
        mocDich={d.mocDich}
        namHienCo={d.namHienCo}
        viecMau={d.viecMau}
        dayShort={tw.raw('dayShort') as string[]}
        canManage
        quayVe={quayVe}
        // Trỏ thẳng vào TUẦN MỚI trên trang WIG. Trước đây sau khi lưu chỉ có "Về trang WIG"
        // (tuần đang xem cũ) — người thử tạo xong mục tiêu tuần tới, bấm vào và thấy "nhảy về
        // trang wig" chứ không thấy mục tiêu mình vừa tạo.
        xemTuanMoi={{
          pathname: '/wig',
          query: {...(classParam ? {class: classParam} : {}), week: shiftWeeks(hopMonday, 1)},
        }}
      />
    </div>
  );
}
