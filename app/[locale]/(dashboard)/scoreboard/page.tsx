import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {AREAS, areaLabel, areaIcon} from '@/lib/areas';
import {getAreaMeta} from '@/lib/area-config';
import {Link} from '@/i18n/navigation';
import {ArrowRight} from 'lucide-react';

// Bảng điểm thi đua 4 HẠNG MỤC (Discipline 3). Điểm = tổng lead_progress theo lĩnh vực;
// hạng mục Kỹ năng tách sub-category (5 Giá trị/7 Thói quen/DEAR/Thể chất/Khác) nếu có.
// Màu/icon/nhãn môn lấy từ area_config (fallback = giá trị cũ ⇒ parity).

type Row = {category: string; sub_category: string | null; points: number; lead_count: number};

export default async function ScoreboardPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  const t = await getTranslations('scoreboard');
  const tArea = await getTranslations('class');
  const supabase = await createClient();

  const [{myClass, classes: accessible}, areaMetaFromCache] = await Promise.all([
    getClassContext(supabase, profile, classParam),
    getAreaMeta(),
  ]);
  const areaMeta = areaMetaFromCache;
  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{tArea('noClass')}</p>
      </div>
    );
  }

  const {data} = await supabase.rpc('class_scoreboard', {p_class: myClass.id});
  const rows = (data ?? []) as Row[];
  const byCat = new Map<string, {points: number; leads: number; subs: {name: string; points: number}[]}>();
  for (const a of AREAS) byCat.set(a, {points: 0, leads: 0, subs: []});
  for (const r of rows) {
    const c = byCat.get(r.category);
    if (!c) continue;
    c.points += Number(r.points);
    c.leads += Number(r.lead_count);
    if (r.sub_category) c.subs.push({name: r.sub_category, points: Number(r.points)});
  }
  const totalPoints = AREAS.reduce((s, a) => s + (byCat.get(a)?.points ?? 0), 0);
  // Hiệu trưởng chỉ XEM; đường dẫn tới /wig là màn hình của giáo viên chủ nhiệm, bày cho họ là
  // bày một cái cửa mở ra màn "không có quyền".
  const canManage = profile.role === 'teacher' || profile.role === 'admin';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      <div className="glass rounded-[20px] p-4">
        <div className="text-[12px] font-extrabold uppercase tracking-wide text-grey-mid">{t('total')}</div>
        <div className="font-display text-[30px] font-bold text-navy">{totalPoints}</div>
        <p className="max-w-[640px] text-[11.5px] font-semibold italic leading-relaxed text-grey-mid">
          {t('hint')}
        </p>
      </div>

      {/* TRỐNG THÌ PHẢI NÓI VÌ SAO TRỐNG.
          Toàn trường hôm nay mọi lớp đều 0, và bản cũ chỉ bày ra năm con số 0 không một chữ giải
          thích, không một nút bấm. Người mở ra đọc thành "app hỏng" hoặc "lớp mình tệ", trong khi
          sự thật chỉ là chưa có lượt tick nào được ghi. Hai chuyện khác hẳn nhau. */}
      {totalPoints === 0 && (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/20 p-5 text-center">
          <p className="text-[13px] font-bold text-navy">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1.5 max-w-[520px] text-[12px] font-semibold leading-relaxed text-grey-mid">
            {t('emptyHow')}
          </p>
          {canManage && (
            <Link
              href={{pathname: '/wig', query: classParam ? {class: classParam} : {}}}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[12px] border-[1.5px] border-navy/20 bg-white px-4 py-2 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy"
            >
              {t('emptyGo')}
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map((a) => {
          const c = byCat.get(a)!;
          const s = areaMeta[a];
          const Icon = areaIcon(s);
          return (
            <div key={a} className="glass glass-hover rounded-[20px] p-4">
              <div className="flex items-center gap-[7px] text-[13.5px] font-extrabold text-navy">
                <span
                  className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg"
                  style={{background: s.soft, color: s.hex}}
                >
                  <Icon size={15} strokeWidth={2.5} />
                </span>
                {areaLabel(s, locale)}
              </div>
              <div className="mt-3 font-display text-[26px] font-bold" style={{color: s.hex}}>
                {c.points}
              </div>
              <div className="text-[11.5px] font-semibold text-grey-mid">{t('leadCount', {n: c.leads})}</div>
              {c.subs.length > 0 && (
                <ul className="mt-2.5 flex flex-col gap-1 border-t border-navy/[0.08] pt-2">
                  {c.subs
                    .sort((x, y) => y.points - x.points)
                    .map((sub) => (
                      <li key={sub.name} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="min-w-0 truncate font-semibold text-txt">{sub.name}</span>
                        <b className="shrink-0 font-bold text-navy">{sub.points}</b>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
