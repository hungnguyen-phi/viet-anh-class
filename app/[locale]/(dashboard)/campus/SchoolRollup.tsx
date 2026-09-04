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
  // 0084 — số mục tiêu NĂM của lớp. 0 nghĩa là lớp chưa vào cuộc, khác hẳn "đã đặt mà điểm 0".
  wig_count: number;
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

  // BỐN CỘT KHAI MỘT LẦN, MỌI DÒNG DÙNG CHUNG.
  //
  // Bản cũ để mỗi ô tự co giãn bằng flex. Nhìn thì tưởng như nhau, nhưng ô tên lớp có thêm
  // `pl-3` để thụt vào, mà với `flex-basis: 0%` thì phần đệm ấy được tính vào kích thước cơ sở
  // của ô — cột tên lớp phình thêm 9px và ba cột số bên phải co lại 3px mỗi cột. Hệ quả: dòng
  // LỚP lệch khỏi dòng KHỐI và khỏi hàng tiêu đề, đúng như chủ dự án thấy ("số không nằm thẳng
  // trên cột"). Lưới thì chiều rộng cột do khai báo quyết định, nội dung bên trong ô — đệm,
  // chữ dài, icon — không kéo cột đi đâu được nữa.
  //
  // minmax(0, …fr) chứ không phải 1.4fr trần: `1.4fr` ngầm là `minmax(auto, 1.4fr)`, tức là vẫn
  // để nội dung dài đẩy cột rộng ra. Đúng cái bẫy vừa gỡ.
  const luoi = 'grid min-w-[620px] items-center gap-2 px-[18px]';
  const cot = {
    gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)',
  } as const;

  return (
    <div className="glass overflow-x-auto rounded-[20px]">
      {/* Header */}
      <div className={`${luoi} bg-navy/[0.03] py-2.5`} style={cot}>
        <span className="min-w-0 truncate text-nhan font-extrabold uppercase text-grey-mid">
          {t('class')}
        </span>
        <span className="text-center text-nhan font-extrabold uppercase text-grey-mid">
          {t('students')}
        </span>
        <span className="text-center text-nhan font-extrabold uppercase text-grey-mid">
          {t('score')}
        </span>
        <span className="text-center text-nhan font-extrabold uppercase text-grey-mid">
          {t('attToday')}
        </span>
      </div>

      {[...byGrade.entries()].map(([gradeName, list]) => (
        <div key={gradeName}>
          {/* Dòng khối */}
          <div className={`${luoi} border-t-[1.5px] border-navy/12 bg-navy/[0.05] py-2`} style={cot}>
            <span className="min-w-0 truncate font-display text-noi-dung font-bold text-navy">
              {gradeName}
              <span className="ml-1.5 text-chu-thich font-semibold text-grey-mid">
                · {list.length} {t('classesShort')}
              </span>
            </span>
            <span className="text-center text-than font-bold text-navy">
              {sum(list, (r) => Number(r.student_count))}
            </span>
            <span className="text-center font-display text-noi-dung font-bold text-navy">
              {avgScore(list)}
            </span>
            <span className="text-center text-than font-bold text-navy">
              {sum(list, (r) => Number(r.att_today))}
            </span>
          </div>

          {/* Các lớp trong khối */}
          {list.map((r) => (
            <Link
              key={r.class_id}
              href={{pathname: '/', query: {class: r.class_id}}}
              className={`${luoi} border-t border-navy/[0.08] py-2.5 transition-colors hover:bg-navy/[0.03]`}
              style={cot}
            >
              <span className="min-w-0 truncate pl-3 text-noi-dung font-bold text-navy">
                {r.class_name}
              </span>
              <span className="text-center text-than font-semibold text-grey-mid">
                {r.student_count}
              </span>
              {/* CHƯA ĐẶT MỤC TIÊU ≠ ĐẶT RỒI MÀ ĐIỂM 0.
                  Bản cũ hiện số 0 cho cả hai, mà hai chuyện ấy đòi hai lời nhắc khác hẳn nhau:
                  một bên là "ngồi xuống đặt mục tiêu đi", bên kia là "xem vì sao chưa chạy".
                  Bảng WIG ngay bên dưới trên cùng trang này đã phân biệt được bằng dấu "—";
                  bảng trên thì chưa — đúng kiểu chẩn đúng ở một chỗ rồi quên chỗ còn lại. */}
              <span
                className="text-center font-display text-doc text-navy"
                title={Number(r.wig_count) === 0 ? t('noWigYet') : undefined}
              >
                {Number(r.wig_count) === 0 ? (
                  <span className="text-than font-semibold text-grey-soft">—</span>
                ) : (
                  Number(r.score)
                )}
              </span>
              {/* "0/24" đọc thành "cả lớp nghỉ học", trong khi sự thật là chưa ai mở điểm danh.
                  Nói thẳng bằng chữ thì không đọc nhầm được. */}
              <span className="text-center text-than font-semibold text-grey-mid">
                {Number(r.att_today) === 0 ? (
                  <span className="text-grey-soft">{t('attNotYet')}</span>
                ) : (
                  `${r.att_today}/${r.student_count}`
                )}
              </span>
            </Link>
          ))}
        </div>
      ))}

      {/* Dòng toàn trường */}
      <div className={`${luoi} border-t-[1.5px] border-navy/20 bg-gold/[0.10] py-2.5`} style={cot}>
        <span className="min-w-0 truncate font-display text-noi-dung font-extrabold text-navy">
          {t('wholeSchool')}
          <span className="ml-1.5 text-chu-thich font-semibold text-grey-mid">
            · {rows.length} {t('classesShort')}
          </span>
        </span>
        <span className="text-center text-than font-extrabold text-navy">
          {sum(rows, (r) => Number(r.student_count))}
        </span>
        <span className="text-center font-display text-doc font-extrabold text-navy">
          {avgScore(rows)}
        </span>
        <span className="text-center text-than font-extrabold text-navy">
          {sum(rows, (r) => Number(r.att_today))}/{sum(rows, (r) => Number(r.student_count))}
        </span>
      </div>
    </div>
  );
}
