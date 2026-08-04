import {getTranslations} from 'next-intl/server';
import {ChevronLeft, ChevronRight, RotateCcw} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {btnIconDanger} from '@/components/ui/Field';
import {MeetingScoreboard} from '@/components/wig/MeetingScoreboard';
import {MeetingTable, LoiHuaTuanTruoc} from '@/components/wig/MeetingTable';
import {isoWeekLabel, vnNoon} from '@/lib/dates';
import {MeetingForm} from '@/app/[locale]/(dashboard)/meeting/MeetingForm';
import {deleteMeeting} from '@/app/[locale]/(dashboard)/meeting/actions';

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
function tienMotTuan(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
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
  hopParam,
  laTuanVuaXong = true,
  tuTrang = 'wig',
}: {
  classId: string;
  weekLabel: string;
  // Thứ Hai của tuần đang TỔNG KẾT, rỗng nếu là tuần vừa xong (mặc định). Chỉ để dựng liên kết.
  hopParam?: string;
  // Đang tổng kết đúng tuần vừa kết thúc hay đã đi lạc sang tuần khác.
  laTuanVuaXong?: boolean;
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
}) {
  const t = await getTranslations('meeting');
  const supabase = await createClient();

  // Liên kết đổi tuần họp: giữ nguyên ?class và ?week (tuần đang xem của trang), chỉ đổi ?hop.
  // Khối này chỉ nhúng ở /wig — trang /meeting không có thanh chọn nên `weekStart` bên đó là tuần
  // hiện tại và không dựng ra liên kết nào (xem điều kiện `weekStart &&` ở dưới).
  const linkHop = (m: string) => ({
    pathname: '/wig' as const,
    query: {
      ...(classParam ? {class: classParam} : {}),
      ...(weekParam ? {week: weekParam} : {}),
      ...(m ? {hop: m} : {}),
    },
  });

  const {data} = await supabase
    .from('wig_meetings')
    .select('id, week_label, results, commitments, next_actions, created_at')
    .eq('class_id', classId)
    .is('student_id', null)
    .order('created_at', {ascending: false});
  const meetings = (data ?? []) as Meeting[];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-[15px] font-bold text-navy">{t('title')}</h2>
        {weekStart && (
          <>
            {/* Thanh chọn TUẦN ĐANG TỔNG KẾT — riêng với thanh ← → của trang. Buổi họp bàn về
                tuần vừa xong, còn thanh trên dùng để soạn mục tiêu cho tuần tới; hai việc thường
                làm cùng một buổi nhưng nhìn vào hai tuần khác nhau. */}
            <Link
              href={linkHop(luiMotTuan(weekStart))}
              className="grid h-7 w-7 place-items-center rounded-[9px] border-[1.5px] border-navy/20 bg-white text-navy transition-all hover:border-navy"
              aria-label={t('prevWeek')}
            >
              <ChevronLeft size={15} strokeWidth={2.5} />
            </Link>
            <span className="text-[12.5px] font-extrabold text-navy">
              {t('summarising', {week: weekLabel})}
            </span>
            <span className="text-[11.5px] font-semibold tabular-nums text-grey-mid">
              {weekStart.slice(8, 10)}/{weekStart.slice(5, 7)} → {weekEnd?.slice(8, 10)}/
              {weekEnd?.slice(5, 7)}
            </span>
            <Link
              href={linkHop(tienMotTuan(weekStart))}
              className="grid h-7 w-7 place-items-center rounded-[9px] border-[1.5px] border-navy/20 bg-white text-navy transition-all hover:border-navy"
              aria-label={t('nextWeek')}
            >
              <ChevronRight size={15} strokeWidth={2.5} />
            </Link>
            {!laTuanVuaXong && (
              <Link
                href={linkHop('')}
                className="inline-flex items-center gap-1 rounded-full bg-navy/[0.06] px-2.5 py-1 text-[11px] font-extrabold text-navy transition-all hover:bg-navy/[0.12]"
              >
                <RotateCcw size={11} strokeWidth={2.5} />
                {t('backToLastWeek')}
              </Link>
            )}
          </>
        )}
      </div>

      {/* Ô "Chốt tick tuần vào [thứ]" ĐÃ BỎ (0081).
          Nó bắt giáo viên đoán trước ngày họp rồi khai vào một ô cấu hình, và đoán sai thì hoặc
          khoá sớm khi lớp chưa họp, hoặc vẫn mở khi đã họp xong. Nay mốc chốt gắn với việc THẬT
          SỰ XẢY RA: ghi nhận buổi họp cho tuần nào thì tick tuần ấy khoá lại. Không phải khai gì. */}

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
          weekStartTruoc={luiMotTuan(weekStart)}
          weekLabelTruoc={isoWeekLabel(vnNoon(luiMotTuan(weekStart)))}
        />
      )}

      {/* Bảng cầm mà họp: mỗi việc một dòng, có cột tuần trước để đối chiếu cam kết. */}
      {weekStart && (
        <MeetingTable
          classId={classId}
          weekStart={weekStart}
          weekLabel={weekLabel}
          weekParam={weekParam}
          hopParam={hopParam}
          canManage={canManage}
          tuTrang={tuTrang}
        />
      )}

      {canManage && (
        <div className="glass rounded-[20px] p-[18px]">
          {/* key=nhãn tuần → ép dựng lại khi bấm ← →. Bên trong là useState(defaultWeek), tức ô
              "Tuần" chỉ nhận giá trị ở lần dựng đầu tiên; không có key thì đổi tuần xong ô vẫn
              ghi tuần cũ và biên bản lưu vào nhầm tuần. */}
          <MeetingForm
            key={weekLabel}
            classId={classId}
            defaultWeek={weekLabel}
            weekStart={weekStart}
          />
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
