import {getTranslations} from 'next-intl/server';
import {createClient} from '@/lib/supabase/server';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {btnIconDanger} from '@/components/ui/Field';
import {MeetingScoreboard} from '@/components/wig/MeetingScoreboard';
import {MeetingTable, LoiHuaTuanTruoc} from '@/components/wig/MeetingTable';
import {isoWeekLabel, vnNoon} from '@/lib/dates';
import {MeetingForm} from '@/app/[locale]/(dashboard)/meeting/MeetingForm';
import {deleteMeeting} from '@/app/[locale]/(dashboard)/meeting/actions';
import {setTickLockDow} from '@/app/[locale]/(dashboard)/wig/actions';

type Meeting = {
  id: string;
  week_label: string;
  results: string | null;
  commitments: string | null;
  next_actions: string | null;
  created_at: string;
};

// Họp WIG của LỚP — trước đây là một trang riêng /meeting (một tab riêng trên thanh nav).
// Nay nhúng vào /wig để WIG và nhịp họp nằm cùng chỗ, không phải nhảy trang; /meeting giữ lại
// dưới dạng redirect cho link cũ.
const DOW = [1, 2, 3, 4, 5, 6, 7];
const DOW_LABEL = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Thứ Hai của tuần trước. Tính bằng UTC trên chuỗi đã chuẩn hoá theo lịch VN — không quy đổi
// múi giờ thêm lần nào nữa, mỗi lần quy đổi là một cơ hội lệch 7 tiếng (xem lib/dates.ts).
function luiMotTuan(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

export async function ClassMeetingSection({
  classId,
  weekLabel,
  canManage,
  classParam,
  weekStart,
  weekEnd,
  weekParam,
  tuTrang = 'wig',
  tickLockDow,
}: {
  classId: string;
  weekLabel: string;
  // Trang đang nhúng khối này — để lưu xong quay về đúng chỗ (/wig hay /meeting).
  tuTrang?: 'wig' | 'meeting';
  // Hai đầu mốc của tuần đang xem — bảng điểm họp lọc theo NGÀY chứ không theo nhãn chữ.
  weekStart?: string;
  weekEnd?: string;
  canManage: boolean;
  classParam?: string;
  // Thứ Hai của tuần đang xem, rỗng nếu là tuần hiện tại (xem WeekNav). Chỉ để mang theo ?week=
  // khi server action redirect về /wig — không có thì lưu ngày chốt xong là bật về tuần này.
  weekParam?: string;
  // Ngày chốt tick của tuần (0046) — hiện ngay cạnh nhịp họp vì hai thứ đi liền nhau.
  tickLockDow: number;
}) {
  const t = await getTranslations('meeting');
  const supabase = await createClient();

  const {data} = await supabase
    .from('wig_meetings')
    .select('id, week_label, results, commitments, next_actions, created_at')
    .eq('class_id', classId)
    .is('student_id', null)
    .order('created_at', {ascending: false});
  const meetings = (data ?? []) as Meeting[];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-[15px] font-bold text-navy">{t('title')}</h2>

      {/* Ngày chốt tick: học sinh tự sửa tick cả tuần, tới ngày này thì khoá để họp đọc số đã chốt */}
      {canManage && (
        <form action={setTickLockDow} className="glass flex flex-wrap items-center gap-2 rounded-[16px] p-3.5">
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="week" value={weekParam ?? ''} />
          <span className="text-[12.5px] font-extrabold text-navy">{t('lockDow')}</span>
          <select
            name="tick_lock_dow"
                aria-label="Ngày chốt tick"
            defaultValue={String(tickLockDow)}
            className="cursor-pointer rounded-[10px] border-[1.5px] border-navy/15 bg-white px-2.5 py-2 text-[13px] font-semibold text-navy outline-none focus:border-navy"
          >
            {DOW.map((d) => (
              <option key={d} value={d}>
                {DOW_LABEL[d - 1]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 cursor-pointer rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12px] font-extrabold text-navy hover:border-navy"
          >
            {t('lockSave')}
          </button>
          <span className="min-w-[220px] flex-1 text-[11.5px] font-semibold italic text-grey-mid">
            {t('lockHint')}
          </span>
        </form>
      )}

      {/* PRD Màn 5: "cầm scoreboard mà họp" — WIG tuần/lead của lớp tuần này */}
      <MeetingScoreboard
        classId={classId}
        weekLabel={weekLabel}
        weekStart={weekStart}
        weekEnd={weekEnd}
      />

      {/* Nhịp 4DX mở đầu bằng "tuần trước hứa gì" — đặt TRƯỚC bảng để đọc theo đúng thứ tự ấy. */}
      {weekStart && (
        <LoiHuaTuanTruoc
          classId={classId}
          weekLabelTruoc={isoWeekLabel(vnNoon(luiMotTuan(weekStart)))}
        />
      )}

      {/* Bảng cầm mà họp: mỗi việc một dòng, có cột tuần trước để đối chiếu cam kết. */}
      {weekStart && (
        <MeetingTable
          classId={classId}
          weekStart={weekStart}
          weekParam={weekParam}
          canManage={canManage}
          tuTrang={tuTrang}
        />
      )}

      {canManage && (
        <div className="glass rounded-[20px] p-[18px]">
          {/* key=nhãn tuần → ép dựng lại khi bấm ← →. Bên trong là useState(defaultWeek), tức ô
              "Tuần" chỉ nhận giá trị ở lần dựng đầu tiên; không có key thì đổi tuần xong ô vẫn
              ghi tuần cũ và biên bản lưu vào nhầm tuần. */}
          <MeetingForm key={weekLabel} classId={classId} defaultWeek={weekLabel} />
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="rounded-[20px] border-[1.5px] border-dashed border-navy/15 bg-navy/[0.02] p-5 text-center text-[12.5px] font-semibold italic text-grey-mid">
          {t('noMeetings')}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetings.map((m) => (
            <div key={m.id} className="glass rounded-[20px] px-[18px] py-4">
              <div className="flex items-center gap-2">
                <div className="font-display text-[15px] font-bold text-navy">{m.week_label}</div>
                {/* Danh sách này là LỊCH SỬ (mọi tuần), nên phải chỉ ra cái nào thuộc tuần đang
                    xem — nếu không thì đổi tuần bằng ← → mà khối này không đổi gì, đọc thành
                    "biên bản không theo tuần". */}
                {m.week_label === weekLabel && (
                  <span className="rounded-full border-[1.5px] border-gold-deep/40 bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                    {t('viewing')}
                  </span>
                )}
                {canManage && (
                  <form action={deleteMeeting} className="ml-auto">
                    <input type="hidden" name="id" value={m.id} />
                    {classParam && <input type="hidden" name="class" value={classParam} />}
                    {/* Nút này nằm trong component dùng chung nên lúc bịt ?week= cho các form của
                        /wig nó bị sót. Thiếu ô này thì GVCN đang dọn tuần cũ, bấm ✕ một cái là
                        văng về tuần hiện tại — và ở trang khác nữa (xem deleteMeeting). */}
                    {weekParam && <input type="hidden" name="week" value={weekParam} />}
                    <ConfirmButton
                      message={t('confirmDeleteMeeting')}
                      label={t('deleteMeeting')}
                      className={btnIconDanger}
                    >
                      ✕
                    </ConfirmButton>
                  </form>
                )}
              </div>
              {m.results && (
                <p className="mt-1.5 text-[13px] font-semibold text-navy">
                  <span className="font-bold text-grey-mid">{t('reflection')}: </span>
                  {m.results}
                </p>
              )}
              {m.commitments && (
                <p className="mt-1 text-[13px] font-semibold text-navy">
                  <span className="font-bold text-grey-mid">{t('commitments')}: </span>
                  {m.commitments}
                </p>
              )}
              {m.next_actions && (
                <p className="mt-1 text-[13px] font-semibold text-navy">
                  <span className="font-bold text-grey-mid">{t('nextActions')}: </span>
                  {m.next_actions}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
