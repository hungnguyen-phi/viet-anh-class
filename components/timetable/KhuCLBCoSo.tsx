import {getTranslations} from 'next-intl/server';
import {MapPin, Users} from 'lucide-react';
import {createClient} from '@/lib/supabase/server';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {xoaCLBCoSo} from '@/app/[locale]/(dashboard)/timetable/actions';
import {FormThemClbCoSo} from './FormThemClbCoSo';

// ════════════════════════════════════════════════════════════════════════════
// TKB CÂU LẠC BỘ THEO CƠ SỞ (0152) — lịch dùng chung, cả cơ sở XEM, BGH/Admin quản.
// ════════════════════════════════════════════════════════════════════════════
//
// CLB liên lớp: một em nhiều lớp cùng học "Bóng rổ", GVCN không quản membership. Nên đây là MỘT
// lịch chung của cơ sở đặt song song dưới TKB chính khoá — ai cũng thấy, em tự biết mình đăng ký
// gì rồi nhìn lịch mà đi. Chỉ Admin và BGH của cơ sở này thêm/xoá (RLS cc_manage).

const THU = [2, 3, 4, 5, 6, 7, 8];

export async function KhuCLBCoSo({
  campusId,
  canManage,
}: {
  campusId: string;
  /** Người xem có quản CLB không — Admin hoặc BGH của chính cơ sở này. */
  canManage: boolean;
}) {
  const t = await getTranslations('timetable');
  const supabase = await createClient();
  const {data} = await supabase
    .from('campus_clubs')
    .select('id, weekday, start_time, end_time, name, room, note')
    .eq('campus_id', campusId)
    .order('weekday')
    .order('start_time');
  const clbs = data ?? [];

  const dayLabel = (d: number) => (d === 8 ? t('sun') : d === 7 ? t('sat') : `${t('dayShort')}${d}`);
  const gio = (x: string) => String(x).slice(0, 5);
  const theoNgay = new Map<number, typeof clbs>();
  for (const c of clbs) theoNgay.set(c.weekday, [...(theoNgay.get(c.weekday) ?? []), c]);

  return (
    <section data-hd="tkb-clb" className="glass rounded-[20px] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="inline-flex items-center gap-1.5 font-display text-noi-dung font-bold text-navy">
          <Users size={14} strokeWidth={2} className="text-gold-deep" />
          {t('clubTitle')}
        </h2>
      </div>

      {clbs.length === 0 ? (
        <p className="text-than font-semibold text-grey-mid">{t('noClubs')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {THU.filter((d) => theoNgay.has(d)).map((d) => (
            <div key={d} className="flex flex-wrap items-center gap-2">
              <span className="w-9 shrink-0 text-chu-thich font-extrabold text-navy">{dayLabel(d)}</span>
              {theoNgay.get(d)!.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-navy/30 bg-navy/[0.06] py-1 pl-2.5 pr-1.5 text-chu-thich font-bold text-navy"
                >
                  {c.name}
                  <span className="text-chu-thich font-bold tabular-nums text-grey-mid">
                    {gio(c.start_time)}–{gio(c.end_time)}
                  </span>
                  {c.room && (
                    <span className="inline-flex items-center gap-0.5 text-chu-thich font-semibold text-grey-mid">
                      <MapPin size={12} strokeWidth={2.5} />
                      {c.room}
                    </span>
                  )}
                  {canManage && (
                    <form action={xoaCLBCoSo} className="contents">
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton
                        message={t('confirmDeleteClub', {name: c.name, day: dayLabel(d)})}
                        label={t('delete')}
                        className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-status-bad"
                      >
                        ✕
                      </ConfirmButton>
                    </form>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <FormThemClbCoSo
          campusId={campusId}
          days={THU.map((d) => ({value: d, label: dayLabel(d)}))}
          nhan={{
            day: t('clubDay'),
            name: t('clubName'),
            from: t('clubFrom'),
            to: t('clubTo'),
            room: t('room'),
            add: t('addClub'),
          }}
        />
      )}
    </section>
  );
}
