// Chạy migration 0100 KÈM phép kiểm trong MỘT giao dịch rồi ROLLBACK — không ghi gì lên CSDL.
//
//   node scripts/kiem-0100.mjs
//
// Vì sao cần file này thay vì `npm run sql` hai lần: phép kiểm muốn so tiến độ TRƯỚC và SAU
// migration, mà "trước" thì phải chụp khi hàm cũ còn đang chạy. Chạy hai lần rời nhau thì lần đầu
// đã ghi thật lên CSDL rồi — mất chỗ để mà rollback.
//
// Thứ tự ở đây: mở giao dịch → chụp ảnh → áp migration → chạy phép kiểm → rollback.
import {readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const MIG = 'supabase/migrations/0100_moi_em_mot_khoang_cach.sql';
const TEST = 'scripts/test-moi-em-mot-khoang-cach.sql';
const TMP = 'scripts/.tmp-kiem-0100.sql';

const anhTruoc = `
create temporary table anh_truoc as
select w.id, w.period, w.period_label, w.target_value, private.wig_actual(w.id) as actual
from wigs w;
`;

// Bỏ 'begin;' của file kiểm — cả ba mảnh phải nằm trong CÙNG một giao dịch, và giao dịch ấy mở ở
// đây. 'rollback;' cuối file kiểm được giữ nguyên, nó là cái đóng lại.
const test = readFileSync(TEST, 'utf8').replace(/^begin;\s*$/m, '');

writeFileSync(
  TMP,
  ['begin;', anhTruoc, readFileSync(MIG, 'utf8'), test].join('\n'),
);

try {
  execFileSync('npm', ['run', 'sql', '--', TMP], {stdio: 'inherit', shell: true});
} finally {
  try {
    unlinkSync(TMP);
  } catch {
    // Giữ file lại để đọc khi có lỗi lạ cũng không sao.
  }
}
