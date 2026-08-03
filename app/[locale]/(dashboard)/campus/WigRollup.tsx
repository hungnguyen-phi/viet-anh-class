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

  const colClass = {flex: 1.5};
  const colTeacher = {flex: 1.2};
  const colNum = {flex: 1};

  return (
    <section className="glass overflow-hidden rounded-[20px]">
      <div className="flex flex-wrap items-baseline gap-x-2 px-[18px] pb-1 pt-4">
        <span className="font-display text-[15px] font-bold text-navy">{t('wigTitle')}</span>
        <span className="text-[11.5px] font-semibold text-grey-mid">{t('wigHint')}</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[680px] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5">
          <span className="text-[11px] font-extrabold uppercase text-grey-mid" style={colClass}>
            {t('class')}
          </span>
          <span className="text-[11px] font-extrabold uppercase text-grey-mid" style={colTeacher}>
            {t('wigTeacher')}
          </span>
          <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
            {t('wigWon')}
          </span>
          <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
            {t('wigAvg')}
          </span>
          <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
            {t('wigStudents')}
          </span>
          <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
            {t('wigTicks')}
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
          return (
            <Link
              key={r.class_id}
              href={{pathname: canOpenWig ? '/wig' : '/meeting', query: {class: r.class_id}}}
              className="flex min-w-[680px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-navy/[0.03]"
            >
              <span className="text-[13.5px] font-bold text-navy" style={colClass}>
                {r.class_name}
                <span className="ml-1.5 text-[11px] font-semibold text-grey-mid">{r.grade_name}</span>
              </span>
              <span className="truncate text-[12.5px] font-semibold text-grey-mid" style={colTeacher}>
                {r.teacher_name ?? t('wigNoTeacher')}
              </span>

              <span className="flex items-center justify-center gap-1" style={colNum}>
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

              <span className="flex items-center justify-center" style={colNum}>
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
                // Đỏ = có học sinh mà KHÔNG em nào tick. Lớp chưa có em nào (0/0) thì để trung
                // tính: tô đỏ một lớp trống là báo động giả, và báo động giả làm mờ báo động thật.
                className={`text-center text-[12.5px] font-bold tabular-nums ${
                  size > 0 && ticking === 0 ? 'text-status-bad' : 'text-navy'
                }`}
                style={colNum}
              >
                {ticking}/{size}
              </span>
              <span className="text-center text-[12.5px] font-semibold tabular-nums text-grey-mid" style={colNum}>
                {Number(r.tick_count)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
