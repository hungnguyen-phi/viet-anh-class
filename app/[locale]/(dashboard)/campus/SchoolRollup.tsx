import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

export type RollupRow = {
  class_id: string;
  class_name: string;
  school_year: string;
  grade_id: string | null;
  grade_name: string;
  grade_sort: number;
  score: number;
  att_today: number;
  student_count: number;
};

// Bảng thi đua TOÀN TRƯỜNG, gom theo Khối.
//
// Thay cho bảng phẳng cũ (liệt kê lớp không phân cấp) và thay cho việc BGH phải vào các trang
// cấp lớp để xem từng lớp một. Mỗi khối có dòng tổng riêng, cuối bảng có dòng toàn trường —
// đó mới là con số một hiệu trưởng cần nhìn.
//
// Toàn bộ dữ liệu đến từ MỘT lượt gọi campus_rollup(); gom nhóm làm ở đây bằng JS thuần nên
// không phát sinh truy vấn theo lớp (N+1).
export async function SchoolRollup({rows}: {rows: RollupRow[]}) {
  const t = await getTranslations('campusReport');

  // Giữ nguyên thứ tự do SQL trả về (grade_sort, rồi tên lớp) — Map bảo toàn thứ tự chèn.
  const byGrade = new Map<string, RollupRow[]>();
  for (const r of rows) {
    const key = r.grade_name;
    const list = byGrade.get(key);
    if (list) list.push(r);
    else byGrade.set(key, [r]);
  }

  const sum = (list: RollupRow[], pick: (r: RollupRow) => number) =>
    list.reduce((acc, r) => acc + pick(r), 0);
  // Điểm của một nhóm là TRUNG BÌNH các lớp, không phải tổng: tổng sẽ khiến khối đông lớp
  // luôn "thắng" khối ít lớp, so sánh thành vô nghĩa.
  const avgScore = (list: RollupRow[]) =>
    list.length ? Math.round(sum(list, (r) => Number(r.score)) / list.length) : 0;

  const colClass = {flex: 1.4};
  // Cột số CĂN GIỮA (trước đây căn phải). Ban giám hiệu phản ánh ở vòng 2: sĩ số một chữ số
// bị dạt hẳn sang mép, nhìn lệch so với dòng trên dưới nên khó dò theo hàng.
const colNum = {flex: 1};

  return (
    <div className="glass overflow-x-auto rounded-[20px]">
      {/* Header */}
      <div className="flex min-w-[620px] items-center gap-2 bg-navy/[0.03] px-[18px] py-2.5">
        <span className="text-[11px] font-extrabold uppercase text-grey-mid" style={colClass}>
          {t('class')}
        </span>
        <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
          {t('students')}
        </span>
        <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
          {t('score')}
        </span>
        <span className="text-center text-[11px] font-extrabold uppercase text-grey-mid" style={colNum}>
          {t('attToday')}
        </span>
      </div>

      {[...byGrade.entries()].map(([gradeName, list]) => (
        <div key={gradeName}>
          {/* Dòng khối */}
          <div className="flex min-w-[620px] items-center gap-2 border-t-[1.5px] border-navy/12 bg-navy/[0.05] px-[18px] py-2">
            <span className="font-display text-[13.5px] font-bold text-navy" style={colClass}>
              {gradeName}
              <span className="ml-1.5 text-[11px] font-semibold text-grey-mid">
                · {list.length} {t('classesShort')}
              </span>
            </span>
            <span className="text-center text-[12.5px] font-bold text-navy" style={colNum}>
              {sum(list, (r) => Number(r.student_count))}
            </span>
            <span className="text-center font-display text-[14px] font-bold text-navy" style={colNum}>
              {avgScore(list)}
            </span>
            <span className="text-center text-[12.5px] font-bold text-navy" style={colNum}>
              {sum(list, (r) => Number(r.att_today))}
            </span>
          </div>

          {/* Các lớp trong khối */}
          {list.map((r) => (
            <Link
              key={r.class_id}
              href={{pathname: '/', query: {class: r.class_id}}}
              className="flex min-w-[620px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5 transition-colors hover:bg-navy/[0.03]"
            >
              <span className="pl-3 text-[13.5px] font-bold text-navy" style={colClass}>
                {r.class_name}
              </span>
              <span className="text-center text-[12.5px] font-semibold text-grey-mid" style={colNum}>
                {r.student_count}
              </span>
              <span className="text-center font-display text-[15px] text-navy" style={colNum}>
                {Number(r.score)}
              </span>
              <span className="text-center text-[12.5px] font-semibold text-grey-mid" style={colNum}>
                {r.att_today}/{r.student_count}
              </span>
            </Link>
          ))}
        </div>
      ))}

      {/* Dòng toàn trường */}
      <div className="flex min-w-[620px] items-center gap-2 border-t-[1.5px] border-navy/20 bg-gold/[0.10] px-[18px] py-2.5">
        <span className="font-display text-[13.5px] font-extrabold text-navy" style={colClass}>
          {t('wholeSchool')}
          <span className="ml-1.5 text-[11px] font-semibold text-grey-mid">
            · {rows.length} {t('classesShort')}
          </span>
        </span>
        <span className="text-center text-[13px] font-extrabold text-navy" style={colNum}>
          {sum(rows, (r) => Number(r.student_count))}
        </span>
        <span className="text-center font-display text-[15px] font-extrabold text-navy" style={colNum}>
          {avgScore(rows)}
        </span>
        <span className="text-center text-[13px] font-extrabold text-navy" style={colNum}>
          {sum(rows, (r) => Number(r.att_today))}/{sum(rows, (r) => Number(r.student_count))}
        </span>
      </div>
    </div>
  );
}
