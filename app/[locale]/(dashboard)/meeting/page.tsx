import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from 'next/navigation';
import {ChevronLeft, ChevronRight, RotateCcw} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {Link} from '@/i18n/navigation';
import {isValidDayVN, isoWeekLabel, mondayOf, shiftWeeks, todayInVN, vnNoon} from '@/lib/dates';
import {layDuLieuHop} from '@/lib/hop-data';
import {PhongHop} from '@/components/wig/PhongHop';

// ════════════════════════════════════════════════════════════════════════════
// /meeting — BAN GIÁM HIỆU ĐỌC BIÊN BẢN HỌP WIG CỦA MỘT LỚP
// ════════════════════════════════════════════════════════════════════════════
//
// Giáo viên chủ nhiệm và quản trị viên KHÔNG dừng ở đây nữa: họ được đưa thẳng sang /wig/hop, nơi
// buổi họp thật sự diễn ra. Trước đây hai trang cùng vẽ một buổi họp bằng hai đoạn mã khác nhau,
// và chúng đã bắt đầu trôi khỏi nhau — bản trong /wig có ô "ngày chốt tick", bản ở đây không.
// Một màn hình sửa được thì chỉ nên có MỘT.
//
// Ban giám hiệu chỉ ĐỌC: RLS chặn mọi đường ghi của họ với wig_meeting_notes / wig_meetings, nên
// bày nút Lưu ra là bày một cái nút bấm vào sẽ báo lỗi.
export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; hop?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, hop: hopParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);

  if (profile.role !== 'principal') {
    const q = new URLSearchParams();
    if (classParam) q.set('class', classParam);
    if (hopParam) q.set('hop', hopParam);
    redirect(`/wig/hop${q.size > 0 ? `?${q.toString()}` : ''}`);
  }

  const t = await getTranslations('meeting');
  const tw = await getTranslations('wig');
  const supabase = await createClient();
  const {myClass, classes: accessible} = await getClassContext(supabase, profile, classParam);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  const thisMonday = mondayOf(todayInVN());
  const macDinh = shiftWeeks(thisMonday, -1);
  const hopMonday = isValidDayVN(hopParam) ? mondayOf(hopParam as string) : macDinh;
  const laTuanVuaXong = hopMonday === macDinh;

  // Chỉ còn MỘT việc phải chờ: bảng màu lĩnh vực (getAreaMeta) từng truyền xuống PhongHop, mà
  // khối ấy thôi dùng từ 16/08 — gọi tiếp là một vòng đi–về không ai đọc kết quả.
  const d = await layDuLieuHop(supabase, myClass.id, hopMonday, {
    year: tw('year'),
    month: tw('month'),
    week: tw('week'),
  });

  const dm = (x: string) => `${x.slice(8, 10)}/${x.slice(5, 7)}`;
  const linkHop = (m: string) => ({
    pathname: '/meeting' as const,
    query: {...(classParam ? {class: classParam} : {}), ...(m === macDinh ? {} : {hop: m})},
  });
  const nut =
    'grid h-9 w-9 place-items-center rounded-[10px] border-[1.5px] border-navy/20 bg-white text-navy transition-all hover:border-navy';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      {/* Nói thẳng đây là bản chỉ đọc. Không có câu này thì một màn hình đầy ô nhập bị khoá đọc
          thành "hỏng", chứ không đọc thành "phần này không phải việc của bạn". */}
      <p className="rounded-[14px] border-[1.5px] border-navy/10 bg-navy/[0.03] px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-grey-mid">
        {t('readOnlyNotice')}
      </p>

      <section className="glass flex flex-wrap items-center justify-center gap-2 rounded-[20px] p-3">
        <Link href={linkHop(shiftWeeks(hopMonday, -1))} className={nut} aria-label={t('prevWeek')}>
          <ChevronLeft size={16} strokeWidth={2.5} />
        </Link>
        <span className="text-[13px] font-extrabold text-navy">
          {t('summarising', {week: d.hop.label})}
        </span>
        <span className="text-[11.5px] font-bold tabular-nums text-grey-mid">
          {dm(d.hop.start)} → {dm(d.hop.end)}
        </span>
        <Link href={linkHop(shiftWeeks(hopMonday, 1))} className={nut} aria-label={t('nextWeek')}>
          <ChevronRight size={16} strokeWidth={2.5} />
        </Link>
        {!laTuanVuaXong && (
          <Link
            href={linkHop(macDinh)}
            className="inline-flex items-center gap-1 rounded-full bg-navy/[0.06] px-3 py-1.5 text-[11.5px] font-extrabold text-navy transition-all hover:bg-navy/[0.12]"
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            {t('backToLastWeek')}
          </Link>
        )}
      </section>

      <PhongHop
        classId={myClass.id}
        hopStart={d.hop.start}
        hopLabel={d.hop.label}
        hopRange={`${dm(d.hop.start)} → ${dm(d.hop.end)}`}
        dichLabel={d.dich.label}
        dichRange={`${dm(d.dich.start)} → ${dm(d.dich.end)}`}
        viecTuanQua={d.viecTuanQua}
        tungEm={d.tungEm}
        emHop={d.emHop}
        loiHuaTruoc={d.loiHuaTruoc}
        nhanTuanTruoc={isoWeekLabel(vnNoon(d.truocMonday))}
        chiemNghiemCu={d.chiemNghiemCu}
        camKetCu={d.camKetCu}
        daCoBienBan={d.daCoBienBan}
        daChot={d.daChot}
        phongMo={d.phongMo}
        camKetTuanQua={d.camKetTuanQua}
        camKetDich={d.camKetDich}
        bangPdr={d.bangPdr}
        namHienCo={d.namHienCo}
        canManage={false}
        quayVe={null}
      />
    </div>
  );
}
