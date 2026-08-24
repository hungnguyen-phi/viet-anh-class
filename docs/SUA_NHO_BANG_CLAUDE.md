# Sửa ý nhỏ trong Việt Anh Class bằng Claude

Dành cho người **không phải lập trình viên** muốn tự đổi những thứ nhỏ trong app — chữ trên nút,
nhãn một ô, thứ tự vài mục — mà không phải chờ ai.

App đang chạy thật ở https://class.vietanh.org. Có 700 học sinh và giáo viên đang dùng. Bản hướng
dẫn này dựng sẵn hàng rào để một cú gõ nhầm không lên tới họ.

---

## 1. Cài một lần (khoảng 20 phút)

| Cần | Lấy ở đâu |
|---|---|
| Node.js 22 | https://nodejs.org — bản LTS |
| Git | https://git-scm.com |
| GitHub CLI (`gh`) | https://cli.github.com |
| Claude Code | https://claude.com/claude-code |

Rồi mở Terminal (Windows: Git Bash) và gõ từng dòng:

```bash
gh auth login                                   # đăng nhập GitHub, chọn HTTPS
git clone https://github.com/hungnguyen-phi/viet-anh-class.git
cd viet-anh-class
npm install                                     # tự bật luôn hàng rào chặn đẩy nhầm
cp .env.example .env.local
```

Mở `.env.local` bằng Notepad và **chỉ điền đúng hai dòng** (xin chủ dự án, alex@truongvietanh.com):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Hai giá trị này vốn đã công khai — chúng nằm sẵn trong mã JavaScript của bản chạy thật, ai mở app
bằng trình duyệt cũng đọc được. Thứ giữ dữ liệu an toàn là luật quyền ở cơ sở dữ liệu, không phải
việc giấu hai dòng này.

**Các dòng còn lại trong `.env.local` cứ để nguyên, đừng xin.** `SUPABASE_SERVICE_ROLE_KEY` bỏ qua
toàn bộ luật quyền — cầm nó là đọc và sửa được dữ liệu của cả trường; `DATABASE_URL` thì ghi thẳng
vào cơ sở dữ liệu. Không có chúng, đúng ba chỗ trong app sẽ báo lỗi **ở máy anh** (check-in cảm xúc,
ghi chú Sư Tử, một nhánh của yêu cầu sửa) — phần còn lại chạy bình thường, và đổi lại là một cú gõ
nhầm không thể chạm tới dữ liệu thật.

Xong, chạy thử app ở máy mình:

```bash
npm run dev
```

Mở http://localhost:3000 (hoặc port ghi trên màn hình). Đây là **bản ở máy anh** — sửa gì cũng chỉ
mình anh thấy, không ai bị ảnh hưởng.

## 2. Mỗi lần sửa: bốn bước

```bash
cd viet-anh-class
git checkout main && git pull                   # ① lấy bản mới nhất
git checkout -b sua-nho/doi-chu-nut-duyet       # ② tạo nhánh riêng, tên tuỳ ý
claude                                          # ③ mở Claude rồi nói việc cần làm
```

Sau khi Claude sửa xong và anh đã xem ở `localhost` thấy ưng:

```bash
git push -u origin sua-nho/doi-chu-nut-duyet    # ④ đẩy nhánh lên
gh pr create --fill                             #    rồi mở PR
```

Chủ dự án xem và bấm merge — bản mới tự lên production sau khoảng 6 phút.

> Nếu lỡ gõ `git push origin main`, máy sẽ **chặn lại** và nhắc đúng câu lệnh nên dùng. Hàng rào ấy
> tự bật lúc `npm install`, không phải nhớ gì thêm.

## 3. Nói với Claude thế nào

Claude đã đọc sẵn `CLAUDE.md` — luật của dự án — nên không cần dặn lại chuyện màu mè, kiểm thử.
Việc của anh là nói **đúng chỗ và đúng ý**.

**Nói được:**

> Trên màn hình của học sinh, chữ "Gửi giáo viên xem" đổi thành "Gửi cô xem" — nhớ cả bản tiếng Anh.

> Trong bảng "Học sinh tuần này" ở trang WIG, cột "Việc đạt" đang đứng cuối, chuyển lên ngay sau cột
> tên học sinh.

> Nút Duyệt bấm xong không thấy gì, thêm dấu hiệu cho biết đã nhận.

**Nên tránh:**

> Làm app đẹp hơn đi. → Không rõ đẹp là gì; và giao diện đã chốt, Claude sẽ phải hỏi lại.

> Sửa file StudentScoreboard.tsx dòng 780. → Không cần biết tên file. Cứ tả **màn hình nào, chữ nào**;
> Claude tự tìm.

Sau khi Claude nói đã xong: **tự mở `localhost` và nhìn tận mắt.** "Đã sửa xong" không phải bằng
chứng — luật của dự án là nhìn thấy rồi mới tin.

(Máy anh không có khoá quản trị nên Claude không tự chụp màn hộ được. Cứ tự bấm vào màn hình đó,
đúng như một giáo viên hay học sinh sẽ bấm.)

## 4. Ba thứ đừng tự làm

1. **Đừng đụng dữ liệu lớp thật.** Các lớp `10A1`, `11A1`, `12A1`, `Marketing` là học sinh thật.
   Muốn thử thì bảo Claude dùng lớp `Test`.
2. **Đừng chạy lệnh đụng cơ sở dữ liệu** (`npm run sql -- ...`) nếu chưa hỏi chủ dự án. Lệnh đó ghi
   thẳng lên CSDL đang chạy.
3. **Đừng đổi màu, font, bố cục trang đăng nhập.** Đã chốt từ đầu; đổi một chỗ là lệch cả hệ.

## 5. Khi kẹt

| Gặp gì | Làm gì |
|---|---|
| Chạy `npm run dev` báo lỗi | Dán nguyên câu lỗi cho Claude, bảo "sửa giúp tôi" |
| Đăng nhập ở `localhost` xong bị văng sang class.vietanh.org | Nhờ chủ dự án thêm `http://localhost:3000/**` vào Supabase → Authentication → Redirect URLs |
| Check-in cảm xúc / ghi chú Sư Tử báo lỗi ở máy | Bình thường — máy anh cố tình không có khoá quản trị. Trên bản thật vẫn chạy |
| Sửa hỏng, muốn quay lại từ đầu | `git checkout main` rồi tạo nhánh mới — nhánh cũ bỏ đó, không sao |
| Không biết mình đang ở nhánh nào | `git status` — dòng đầu ghi tên nhánh |
| Đã merge nhưng app chưa đổi | Chờ ~6 phút, rồi mở https://class.vietanh.org/api/health xem `commit` đã là bản mới chưa |

Còn lại: hỏi chủ dự án. Không có câu hỏi nào là thừa so với một bản deploy hỏng giữa giờ học.
