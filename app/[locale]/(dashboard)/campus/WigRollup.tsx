import {getTranslations} from 'next-intl/server';
import {Check, X} from 'lucide-react';
import {Link} from '@/i18n/navigation';

export type WigRollupRow = {
  class_id: string;
  class_name: string;
  grade_name: string;
  grade_sort: number;
  teacher_name: string | null;
  wigs_total: number | string;
  wigs_won: number | string;
  avg_pct: number | string;
  tick_students: number | string;
  tick_count: number | string;
  student_count: number | string;
  // MỤC TIÊU CỦA EM (0106). muc_tieu_em = số mục tiêu năm đã duyệt của học sinh trong lớp;
  // muc_tieu_em_tu_dat = trong đó bao nhiêu do CHÍNH EM đặt (set_by='student').
  muc_tieu_em: number | string;
  muc_tieu_em_tu_dat: number | string;
};

// Nhịp WIG toàn trường: tuần này lớp nào thắng mấy WIG, ai chủ nhiệm, bao nhiêu em thật sự tick.
//
// Trước 0073 ban giám hiệu không có màn hình nào trả lời được câu ấy — /campus chỉ có điểm thi
// đua và điểm danh, còn thắng/thua thì phải vào từng trang /wig của từng lớp. Mà cả con số ấy
// hồi đó cũng là do GVCN tự gõ, nên có xem cũng không nói lên điều gì.
//
// Cột "Em đã tick" đứng cạnh cột "Thắng" là có chủ ý: một lớp thắng đủ 4 WIG mà chỉ 3/30 em có
// tick thì đó không phải một lớp đang chạy tốt, đó là một lớp đặt mục tiêu quá thấp.
export async function WigRollup({
  rows,
  canOpenWig = true,
}: {
  rows: WigRollupRow[];
  // /wig chỉ cho vai teacher/admin (requireRole ở wig/page.tsx); hiệu trưởng vào là bị đá về
  // đúng /campus này — nhấp một cái rồi quay lại chỗ cũ, không báo gì. Mà bảng này dựng ra CHO
  // hiệu trưởng, và những con số đỏ trong đây chính là thứ mời người ta bấm vào.
  // Với họ, trỏ sang /meeting: đó là màn hình 4DX của lớp mà vai principal đọc được.
  canOpenWig?: boolean;
}) {
  const t = await getTranslations('campusReport');

  if (rows.length === 0) {
    return (
      <section className="glass rounded-[20px] p-[18px]">
        <div className="font-display text-[15px] font-bold text-navy">{t('wigTitle')}</div>
        <p className="mt-1.5 text-[12.5px] font-semibold text-grey-mid">{t('wigNoData')}</p>
      </section>
    );
  }

  // HAI BỐ CỤC, MỘT CÂY DOM — cùng cách đã dùng cho bảng "đã khai sẵn" ở màn Quản trị.
  //
  // Bảng này cần 680px. Trên máy 360px, audit mobile 2026-08-06 cho thấy hiệu trưởng chỉ đọc
  // được hai cột đầu (Lớp, GVCN) — còn Thắng, Trung bình, Em đã tick, Lượt tick đều nằm ngoài
  // màn hình. Tức là bốn con số mà cả bảng dựng ra để trả lời thì phải cuộn ngang mới thấy, còn
  // thứ hiện sẵn lại là hai cột nhãn.
  //
  // Dưới 640px: mỗi dòng thành một thẻ hai tầng — tầng trên lớp + GVCN, tầng dưới bốn con số kèm
  // nhãn ngắn (nhãn chỉ hiện ở dạng thẻ, vì ở dạng bảng đã có hàng tiêu đề). Từ 640px: y nguyên
  // bảng sáu cột như cũ, nhờ `sm:contents` làm cái bọc tầng dưới biến mất.
  // Từ 640px trở lên là LƯỚI SÁU CỘT khai một lần, hàng tiêu đề và mọi dòng dùng chung.
  //
  // Trước đây mỗi ô tự co bằng flex với `sm:basis-auto`, tức là bề rộng cột chạy theo NỘI DUNG
  // của chính dòng ấy: ô tiêu đề ghi "LỚP" còn ô dữ liệu ghi "10A1 Khối 10", nên cột đầu của
  // dòng rộng hơn cột đầu của tiêu đề 44px và cả năm cột sau xô lệch theo. Lưới thì cột do khai
  // báo quyết định. minmax(0,…fr) — không phải `1.5fr` trần — để nội dung dài không đẩy cột ra.
  const luoiSm =
    'sm:grid sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]';
  const colClass = 'min-w-0 basis-full sm:basis-auto';
  const colTeacher = 'min-w-0 flex-1';
  const colNum = 'min-w-0 flex-1';
  const tangSo = 'flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:contents';
  const nhanNho = 'text-[10px] font-extrabold uppercase tracking-wide text-grey-mid sm:hidden';

  return (
    <section className="glass overflow-hidden rounded-[20px]">
      <div className="flex flex-wrap items-baseline gap-x-2 px-[18px] pb-1 pt-4">
        <span className="font-display text-[15px] font-bold text-navy">{t('wigTitle')}</span>
        <span className="text-[11.5px] font-semibold text-grey-mid">{t('wigHint')}</span>
      </div>

      <div className="sm:overflow-x-auto">
        {/* Hàng tiêu đề chỉ có nghĩa khi còn là bảng; ở dạng thẻ, mỗi con số tự mang nhãn. */}
        <div className={`hidden min-w-[800px] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5 ${luoiSm}`}>
          <span className={`text-[11px] font-extrabold uppercase text-grey-mid ${colClass}`}>
            {t('class')}
          </span>
          <span className={`text-[11px] font-extrabold uppercase text-grey-mid ${colTeacher}`}>
            {t('wigTeacher')}
          </span>
          <span className={`text-center text-[11px] font-extrabold uppercase text-grey-mid ${colNum}`}>
            {t('wigWon')}
          </span>
          <span className={`text-center text-[11px] font-extrabold uppercase text-grey-mid ${colNum}`}>
            {t('wigAvg')}
          </span>
          <span className={`text-center text-[11px] font-extrabold uppercase text-grey-mid ${colNum}`}>
            {t('wigStudents')}
          </span>
          <span className={`text-center text-[11px] font-extrabold uppercase text-grey-mid ${colNum}`}>
            {t('wigTicks')}
          </span>
          <span className={`text-center text-[11px] font-extrabold uppercase text-grey-mid ${colNum}`}>
            {t('wigSelfSet')}
          </span>
        </div>

        {rows.map((r) => {
          const total = Number(r.wigs_total);
          const won = Number(r.wigs_won);
          const pct = Math.round(Number(r.avg_pct) * 100);
          const ticking = Number(r.tick_students);
          const size = Number(r.student_count);
          // Lớp chưa đặt WIG tuần: không phải thua, mà là chưa vào cuộc — phải phân biệt, nếu
          // không thì nhìn bảng tưởng cả khối đang thua.
          const idle = total === 0;
          const soEm = Number(r.muc_tieu_em);
          const tuDat = Number(r.muc_tieu_em_tu_dat);
          const tyLeTuDat = soEm > 0 ? Math.round((tuDat / soEm) * 100) : 0;
          return (
            <Link
              key={r.class_id}
              href={{pathname: canOpenWig ? '/wig' : '/meeting', query: {class: r.class_id}}}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-navy/[0.03] sm:min-w-[800px] sm:items-center sm:gap-2 ${luoiSm}`}
            >
              <span className={`text-[13.5px] font-bold text-navy ${colClass}`}>
                {r.class_name}
                <span className="ml-1.5 text-[11px] font-semibold text-grey-mid">{r.grade_name}</span>
              </span>
              <span className={`truncate text-[12.5px] font-semibold text-grey-mid ${colTeacher}`}>
                {r.teacher_name ?? t('wigNoTeacher')}
              </span>

              <span className={tangSo}>
              <span className={`flex items-center justify-center gap-1 ${colNum}`}>
                <span className={nhanNho}>{t('wigWon')}</span>
                {idle ? (
                  <span className="text-[12px] font-semibold text-grey-soft">—</span>
                ) : (
                  <>
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
                      style={{
                        background: won > 0 ? 'var(--color-success)' : 'rgba(192,57,43,0.12)',
                        color: won > 0 ? '#fff' : 'var(--color-status-bad)',
                      }}
                    >
                      {won > 0 ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                    </span>
                    <span className="font-display text-[14px] font-bold text-navy">
                      {won}
                      <span className="text-[11.5px] text-grey-mid">/{total}</span>
                    </span>
                  </>
                )}
              </span>

              <span className={`flex items-center justify-center gap-1 ${colNum}`}>
                <span className={nhanNho}>{t('wigAvg')}</span>
                {idle ? (
                  <span className="text-[12px] font-semibold text-grey-soft">—</span>
                ) : (
                  <span className="flex w-full max-w-[72px] items-center gap-1.5">
                    <span className="h-[7px] flex-1 overflow-hidden rounded-[4px] bg-navy/[0.08]">
                      <span
                        className="block h-full rounded-[4px]"
                        style={{
                          width: `${pct}%`,
                          background:
                            pct >= 100 ? 'var(--color-success)' : 'linear-gradient(to right,#ffe94d,#f9dd0e)',
                        }}
                      />
                    </span>
                    <span className="w-8 text-right text-[11.5px] font-bold tabular-nums text-grey-mid">
                      {pct}%
                    </span>
                  </span>
                )}
              </span>

              <span
                // Đỏ = có học sinh, LỚP CÓ VIỆC ĐỂ TICK, mà không em nào tick.
                //
                // Vế giữa (`!idle`) là vế bị thiếu. Lớp chưa đặt mục tiêu tuần thì các em KHÔNG
                // CÓ GÌ để tick — hai cột bên trái đã thừa nhận điều đó bằng dấu "—", nhưng cột
                // này vẫn tô đỏ "0/24". Hiệu trưởng đọc bảng thấy một hàng đỏ và nhắc giáo viên
                // về chuyện học sinh lười tick, trong khi việc thật cần làm là đặt mục tiêu.
                // Báo động giả ngay trên bảng dựng ra để báo động.
                className={`flex items-center justify-center gap-1 text-center text-[12.5px] font-bold tabular-nums ${colNum} ${
                  !idle && size > 0 && ticking === 0 ? 'text-status-bad' : 'text-navy'
                }`}
                title={idle ? t('wigIdleTick') : undefined}
              >
                <span className={nhanNho}>{t('wigStudents')}</span>
                {idle ? <span className="font-semibold text-grey-soft">—</span> : `${ticking}/${size}`}
              </span>
              <span
                className={`flex items-center justify-center gap-1 text-center text-[12.5px] font-semibold tabular-nums text-grey-mid ${colNum}`}
              >
                <span className={nhanNho}>{t('wigTicks')}</span>
                {Number(r.tick_count)}
              </span>

              {/* AI CẦM BÚT — chỉ số cảnh báo sớm của cả mô hình (§4, §10.2).
                  Cô đặt hộ cả lớp thì mọi cột bên trái vẫn xanh: WIG đủ, tick đều, thi đua chạy
                  — mà thứ chương trình dựng ra để tạo thì không có. Ngưỡng 70% và công thức chép
                  đúng TuongWig (màn GVCN) để hai màn không bao giờ nói hai con số khác nhau.
                  Chưa em nào có mục tiêu thì "—", KHÔNG phải 0%: mẫu số 0 không nói lên gì, mà
                  một số 0 đỏ chót lại giục hiệu trưởng đi nhắc sai chuyện. */}
              <span
                className={`flex items-center justify-center gap-1 text-center text-[12.5px] font-bold tabular-nums ${colNum} ${
                  soEm === 0 ? 'text-grey-soft' : tyLeTuDat >= 70 ? 'text-success-dark' : 'text-status-bad'
                }`}
              >
                <span className={nhanNho}>{t('wigSelfSet')}</span>
                {soEm === 0 ? (
                  <span className="font-semibold">—</span>
                ) : (
                  <>
                    {tyLeTuDat}%
                    <span className="text-[11px] font-semibold text-grey-mid">
                      ({tuDat}/{soEm})
                    </span>
                  </>
                )}
              </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
