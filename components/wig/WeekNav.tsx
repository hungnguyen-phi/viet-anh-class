import {getTranslations} from 'next-intl/server';
import {RotateCcw} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {shiftWeeks} from '@/lib/dates';
import {btnGhost} from '@/components/ui/Field';
import {NutChuyenTuan} from '@/components/wig/NutChuyenTuan';

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

  // DÙNG NÚT CHUẨN CỦA APP, không chép tay lại.
  //
  // Bản cũ tự dựng một chuỗi class gần giống `btnGhost` nhưng lệch cỡ chữ (12.5 thay vì 13) và
  // lệch padding (px-3 thay vì px-4) — đủ để hai nút này trông khác mọi nút khác trên cùng trang,
  // và chủ dự án nhìn ra ngay ("2 nút đó có màu khác đi"). Một bản chép tay của một style dùng
  // chung là một chỗ để nó trôi khỏi bản gốc, và nó đã trôi.
  const nut = `${btnGhost} shrink-0`;

  return (
    <div className="flex items-center gap-2">
      <Link href={href(shiftWeeks(monday, -1))} className={`${nut} h-10 w-10 !px-0`} aria-label={t('weekPrev')}>
        <NutChuyenTuan huong="truoc" nhan={t('weekPrev')} chiIcon />
      </Link>

      {/* MỘT DÒNG: nhãn · dải ngày · chip. Bản cũ là một thẻ glass ba tầng (nhãn, ngày, rồi
          "Về tuần này" xuống dòng riêng) cao bằng cả khối cam kết bên dưới — thanh tuần là thứ để
          liếc, không phải để đọc (17/08/2026, cùng kiểu với ChonTuanCuaEm bên màn em). */}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-center">
        <span className="font-display text-[16px] font-bold leading-none text-navy">{label}</span>
        <span className="text-[12.5px] font-bold tabular-nums text-grey-mid">
          {dm(start)} → {dm(end)}
        </span>
        {khi === 'now' ? (
          <span className={`rounded-full border-[1.5px] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badge.cls}`}>
            {badge.text}
          </span>
        ) : (
          <Link
            href={href(thisMonday)}
            className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 rounded-full border-[1.5px] border-navy/15 px-2 text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid transition-colors hover:border-navy"
          >
            <RotateCcw size={10} strokeWidth={2.5} />
            {badge.text} · {t('weekNow')}
          </Link>
        )}
      </div>

      <Link href={href(shiftWeeks(monday, 1))} className={`${nut} h-10 w-10 !px-0`} aria-label={t('weekNext')}>
        <NutChuyenTuan huong="sau" nhan={t('weekNext')} chiIcon />
      </Link>
    </div>
  );
}
