import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses, getMyClass} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {saveSlot, deleteSlot} from './actions';

const DAYS = [2, 3, 4, 5, 6, 7]; // T2..T7 (tuần học VN)
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

type Slot = {id: string; day_of_week: number; period_no: number; subject: string; room: string | null};

export default async function TimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, flash} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireProfile();
  const t = await getTranslations('timetable');
  const tc = await getTranslations('class');
  const supabase = await createClient();

  const [myClass, accessible] = await Promise.all([
    getMyClass(supabase, profile, classParam),
    getAccessibleClasses(supabase, profile),
  ]);
  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  const canManage = profile.role === 'teacher' || profile.role === 'admin';
  const {data} = await supabase
    .from('timetable_slots')
    .select('id, day_of_week, period_no, subject, room')
    .eq('class_id', myClass.id);
  const slots = (data ?? []) as Slot[];
  const byKey = new Map(slots.map((s) => [`${s.day_of_week}-${s.period_no}`, s]));
  const dayLabel = (d: number) => (d === 7 ? t('sat') : `${t('dayShort')}${d}`);

  const cellInput =
    'w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2 py-2.5 text-[12.5px] font-semibold text-navy outline-none focus:border-navy';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      {flash && (
        <div className="rounded-[12px] border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success-dark">
          {flash}
        </div>
      )}

      {/* Lưới TKB: hàng = tiết, cột = thứ */}
      <div className="glass overflow-x-auto rounded-[20px] p-2">
        <div className="min-w-[640px]">
          <div className="flex">
            <div className="w-14 shrink-0 px-2 py-2 text-[11px] font-extrabold uppercase text-grey-mid">
              {t('period')}
            </div>
            {DAYS.map((d) => (
              <div key={d} className="flex-1 px-2 py-2 text-center text-[12px] font-extrabold text-navy">
                {dayLabel(d)}
              </div>
            ))}
          </div>
          {PERIODS.map((p) => (
            <div key={p} className="flex border-t border-navy/[0.08]">
              <div className="grid w-14 shrink-0 place-items-center text-[13px] font-bold text-grey-mid">{p}</div>
              {DAYS.map((d) => {
                const s = byKey.get(`${d}-${p}`);
                return (
                  <div key={d} className="min-w-0 flex-1 p-1.5">
                    {s ? (
                      <div className="relative rounded-[10px] bg-navy/[0.05] px-2 py-1.5">
                        <div className="truncate text-[12.5px] font-bold text-navy">{s.subject}</div>
                        {s.room && <div className="truncate text-[10.5px] text-grey-mid">{s.room}</div>}
                        {canManage && (
                          <form action={deleteSlot} className="absolute right-1 top-1">
                            <input type="hidden" name="class_id" value={myClass.id} />
                            <input type="hidden" name="id" value={s.id} />
                            <button
                              type="submit"
                              aria-label={t('delete')}
                              className="grid h-4 w-4 cursor-pointer place-items-center rounded text-status-bad hover:text-status-bad"
                            >
                              ✕
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-[10px] py-1.5 text-center text-[11px] text-navy/15">·</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* GVCN/Admin: thêm hoặc sửa 1 ô */}
      {canManage && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2 font-display text-[15px] font-bold text-navy">{t('addSlot')}</div>
          <form action={saveSlot} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="class_id" value={myClass.id} />
            <select name="day_of_week" defaultValue="2" className={`${cellInput} w-24 cursor-pointer`}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d)}
                </option>
              ))}
            </select>
            <select name="period_no" defaultValue="1" className={`${cellInput} w-24 cursor-pointer`}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t('period')} {p}
                </option>
              ))}
            </select>
            <input name="subject" placeholder={t('subject')} className={`${cellInput} min-w-[140px] flex-1`} required />
            <input name="room" placeholder={t('room')} className={`${cellInput} w-28`} />
            <SubmitButton className="btn-gold h-11 cursor-pointer rounded-[10px] px-4 text-sm font-extrabold" wrapClass="contents">
              {t('save')}
            </SubmitButton>
          </form>
          <p className="mt-1.5 text-[11px] italic text-grey-mid">{t('hint')}</p>
        </div>
      )}
    </div>
  );
}
