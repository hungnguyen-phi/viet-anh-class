import {getTranslations} from 'next-intl/server';
import {ChevronLeft, ChevronRight, CalendarDays, RotateCcw} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {shiftWeeks} from '@/lib/dates';

// Thanh chọn TUẦN của trang /wig — ← tuần trước · tuần đang xem · tuần sau →
//
// VÌ SAO PHẢI CÓ (sự cố 03/08/2026, lớp 7B1):
// Trang /wig lấy MỌI WIG scope='class' của lớp, không lọc ngày. Màn hình học sinh thì ngược lại:
// RPC class_lead_board (0073) chỉ trả WIG có khoảng ngày GIAO với tuần lịch hiện tại. Hai luật
// khác nhau trên cùng một dữ liệu, và không màn hình nào nói ra mình đang đứng ở tuần nào — nên
// GVCN nhìn thấy "Dành 30 phút đọc sách 0/30" của một WIG đã hết hạn từ hôm trước và tưởng lớp
// đang có việc, trong khi học sinh mở máy lên thì trống trơn. Không ai nhìn ra được vì con số
// hiển thị y hệt nhau ở cả hai trạng thái.
//
// Cách chữa là làm cho TUẦN trở thành thứ nhìn thấy được và đổi được: mọi khối trên trang bám
// vào một tuần duy nhất, và tuần ấy được ghi thẳng ra màn hình kèm dải ngày thật.
//
// Không cần JavaScript: ba liên kết đổi ?week= là đủ, trang vốn là server component. Tuần hiện
// tại KHÔNG đính tham số — URL thường ngày giữ nguyên như cũ, và ai gửi link "tuần này" cho đồng
// nghiệp thì bên kia mở ra vẫn là tuần của HỌ, không phải một tuần đông cứng của người gửi.
export async function WeekNav({
  monday,
  thisMonday,
  label,
  start,
  end,
  classParam,
  basePath = '/wig',
}: {
  // Thứ Hai của tuần đang xem, và của tuần chứa hôm nay (để biết đang ở quá khứ hay tương lai).
  monday: string;
  thisMonday: string;
  // Nhãn ISO ('W32-2026') và hai đầu mốc của tuần đang xem.
  label: string;
  start: string;
  end: string;
  classParam?: string;
  // Trang đang nhúng thanh này. Bấm ← → phải ở lại ĐÚNG màn đang đứng: thanh này nay dùng ở cả
  // /wig lẫn /wig/chi-tiet, và đóng cứng '/wig' thì từ màn chi tiết bấm mũi tên là văng về trang
  // ngoài — người dùng đọc thành "bấm sang tuần khác thì mất hết chi tiết".
  basePath?: '/wig' | '/wig/chi-tiet';
}) {
  const t = await getTranslations('wig');

  const href = (m: string) => ({
    pathname: basePath,
    query: {...(classParam ? {class: classParam} : {}), ...(m === thisMonday ? {} : {week: m})},
  });

  // So chuỗi ISO là so được thứ tự thời gian — 'YYYY-MM-DD' sắp xếp theo từ điển trùng với sắp
  // xếp theo ngày. Không phải dựng Date lên chỉ để hỏi cái nào trước.
  const khi = monday === thisMonday ? 'now' : monday < thisMonday ? 'past' : 'future';
  const badge = {
    now: {text: t('weekNow'), cls: 'border-gold-deep/40 bg-gold/20 text-gold-text'},
    past: {text: t('weekPast'), cls: 'border-navy/15 bg-navy/[0.06] text-grey-mid'},
    future: {text: t('weekFuture'), cls: 'border-navy/20 bg-navy/[0.06] text-navy'},
  }[khi];

  // 'YYYY-MM-DD' → '03/08'. Cắt chuỗi, không qua Date: chuỗi đã đúng lịch VN rồi.
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  // Cùng chiều cao ctl-h (44px) với mọi điều khiển khác — xem ghi chú ở components/ui/Field.
  const nut =
    'ctl-h inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy';

  return (
    <section className="glass rounded-[20px] p-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={href(shiftWeeks(monday, -1))} className={nut} aria-label={t('weekPrev')}>
          <ChevronLeft size={17} strokeWidth={2.5} />
          <span className="hidden sm:inline">{t('weekPrev')}</span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-navy">
              <CalendarDays size={15} strokeWidth={2.5} className="text-gold-deep" />
              {label}
            </span>
            <span
              className={`rounded-full border-[1.5px] px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide ${badge.cls}`}
            >
              {badge.text}
            </span>
          </div>
          <span className="mt-0.5 text-[11.5px] font-bold tabular-nums text-grey-mid">
            {dm(start)} → {dm(end)}
          </span>
        </div>

        <Link href={href(shiftWeeks(monday, 1))} className={nut} aria-label={t('weekNext')}>
          <span className="hidden sm:inline">{t('weekNext')}</span>
          <ChevronRight size={17} strokeWidth={2.5} />
        </Link>
      </div>

      {/* Đường về, chỉ hiện khi đã đi khỏi tuần này. Chiếm trọn một dòng riêng để không đẩy lệch
          cụm ← nhãn → ở trên — cụm đó phải đứng cân, nó là thứ mắt bám vào. */}
      {khi !== 'now' && (
        <div className="mt-2 flex justify-center">
          <Link
            href={href(thisMonday)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-navy/[0.06] px-3 py-1.5 text-[11.5px] font-extrabold text-navy transition-all hover:bg-navy/[0.12]"
          >
            <RotateCcw size={12} strokeWidth={2.5} />
            {t('weekBackToThis')}
          </Link>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] font-semibold italic leading-relaxed text-grey-mid">
        {t('weekNavHint')}
      </p>
    </section>
  );
}
