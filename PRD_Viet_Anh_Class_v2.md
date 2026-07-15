# PRD v2 — VIET ANH CLASS

**App lãnh đạo lớp học theo khung 4DX cho Trường Việt Anh**

Phiên bản: **v2.0 (build trên Claude Code + Supabase + Vercel)**
Người duyệt: Nguyễn Mạnh Dương · Ngày: 23/06/2026
Trạng thái: Bản chi tiết để bắt tay build

> **Thay đổi lớn so với v1:** Chuyển nền tảng từ *Google AI Studio + Firebase* sang *Next.js (Claude Code) + Supabase (Postgres + Auth + RLS) + Vercel*, đồng bộ công nghệ với app **AI Tutor Việt Anh** (cùng stack, **tách project Supabase và repo riêng**). Phạm vi triển khai đợt đầu: **một cơ sở đầy đủ** (tất cả lớp của 1 cơ sở), nhưng dữ liệu thiết kế sẵn multi-tenant để mở rộng 9 cơ sở.

---

## 0. Tóm tắt quyết định kiến trúc (chốt theo trao đổi)

| Hạng mục | Quyết định | Ghi chú |
| :--- | :--- | :--- |
| **Stack** | Next.js (App Router, TypeScript) + Supabase + Vercel | Cùng công nghệ AI Tutor để dùng chung kinh nghiệm/đội ngũ |
| **Quan hệ với AI Tutor** | Cùng stack, **tách project Supabase + repo riêng** | Độc lập dữ liệu, dễ phân quyền, giảm rủi ro chéo |
| **Đăng nhập GV/Admin/BGH** | Google OAuth, miền `@truongvietanh.com` | Tài khoản công vụ trường cấp |
| **Đăng nhập học sinh** | Google OAuth, miền `@student.truongvietanh.com` | Email học sinh trường cấp |
| **Đăng nhập phụ huynh** | Admin cấp quyền theo email phụ huynh cung cấp (mời + magic link/OTP) | Email cá nhân bất kỳ, KHÔNG phải Google công vụ |
| **Phạm vi đợt 1** | Một cơ sở đầy đủ | Schema multi-tenant sẵn, bật cơ sở khác sau |
| **Đồng bộ dữ liệu** | Realtime qua Supabase Realtime | Điểm danh, scoreboard cập nhật trực tiếp |
| **Giao diện** | Song ngữ Việt–Anh, responsive mobile + desktop | i18n bằng `next-intl` hoặc tương đương |

**Ý kiến của tôi (Claude):** Việc tách project Supabase riêng là lựa chọn đúng cho dữ liệu học sinh — nó cô lập rủi ro bảo mật và cho phép áp Row Level Security (RLS) riêng cho từng hệ thống. Điểm cần lưu ý nhất của toàn bộ dự án không phải là tính năng, mà là **mô hình phân quyền phụ huynh** (chỉ thấy con mình) và **giới hạn miền email khi đăng nhập** — đây là hai chỗ dễ rò rỉ dữ liệu nhất và tôi sẽ đặc tả kỹ ở Mục 7–9.

---

## 1. Tổng quan sản phẩm

**Tên:** Viet Anh Class
**Một câu mô tả:** App giúp mỗi lớp của Trường Việt Anh lãnh đạo việc học tập và rèn luyện để đạt mục tiêu (WIGs) của lớp và của trường, theo khung **4 Disciplines of Execution (4DX)**.

**Tầm nhìn:** Kết nối chuỗi **hành vi → thói quen → văn hoá → WIGs** của cả lớp và cả trường, biến việc quản lý lớp từ rời rạc (Excel) thành chính xác, nhẹ nhàng, nhất quán và đo được.

**Nguyên tắc 4DX áp dụng:**
1. **Discipline 1 — Tập trung WIG:** mỗi lớp & mỗi học sinh có WIG năm → tháng → tuần trên 4 lĩnh vực (Kiến thức, Kỹ năng, Tiếng Anh, Thể chất).
2. **Discipline 2 — Hành động trên Lead measures:** đo các hành vi dẫn dắt (buổi tutor, hành vi văn hoá, buổi tập…) thay vì chỉ đo kết quả.
3. **Discipline 3 — Bảng điểm hấp dẫn (Scoreboard):** thi đua toàn trường, ai cũng biết "đang thắng hay thua".
4. **Discipline 4 — Nhịp giải trình (Cadence):** họp WIG hằng tuần giữa Coach (GVCN) và Buddy (bạn đồng hành), có ghi chú.

---

## 2. Người dùng & vai trò

| Vai trò | Mô tả | Đăng nhập |
| :--- | :--- | :--- |
| **Admin** | Quản trị hệ thống toàn trường | Google `@truongvietanh.com` (cờ admin) |
| **BGH cơ sở** | Ban giám hiệu, xem toàn cơ sở mình phụ trách | Google `@truongvietanh.com` |
| **GVCN (Home Teacher)** | Giáo viên chủ nhiệm, quản lý lớp mình | Google `@truongvietanh.com` |
| **Học sinh** | Thành viên lớp, xem & cập nhật phần của mình | Google `@student.truongvietanh.com` |
| **Phụ huynh** | Chỉ xem báo cáo đã lọc về **con mình** | Email cá nhân do admin mời (magic link/OTP) |

**Vấn đề hiện tại:** quản lý bằng Excel rời rạc, dễ sai, tốn công, không realtime, không phân quyền được.
**Khi app thành công:** công việc chính xác, nhẹ nhàng, nhất quán; dữ liệu hành vi nối thẳng tới WIG và scoreboard.

---

## 3. Mục tiêu & thước đo thành công (KPIs của chính app)

Bổ sung chỉ số đo được để kiểm chứng "app chạy đúng":

1. **Tỷ lệ lớp điểm danh mỗi ngày ≥ 95%** (trong các ngày học).
2. **100% lớp pilot có đủ WIG 4 lĩnh vực** ở cả 3 cấp (năm/tháng/tuần).
3. **≥ 90% tuần được ghi nhận có họp WIG** (có biên bản trong app).
4. **Độ trễ cập nhật scoreboard < 3 giây** sau khi nhập liệu (realtime).
5. **Sự tương thích tuyến (alignment):** hành vi hằng ngày khớp lead measure, lead measure khớp WIG tuần/tháng/năm — đo bằng % lead measure có WIG cha hợp lệ.

---

## 4. Khung 4DX — Mô hình dữ liệu nội dung

App tổ chức **WIG năm → tháng → tuần**, cho **cả lớp** và **từng học sinh**, trên **4 lĩnh vực**. Ví dụ cấp lớp (năm học 2026–2027):

| Lĩnh vực | WIG năm | WIG tuần (lớp) |
| :--- | :--- | :--- |
| **Kiến thức** | 80% học sinh đạt xếp loại giỏi | 200 buổi tutor |
| **Kỹ năng** | Hoàn thành 95% hành vi xây dựng văn hoá | 100 hành vi văn hoá |
| **Tiếng Anh** | 95% học sinh tiến bộ AVQT 1 level | 50 buổi tutor tiếng Anh |
| **Thể chất** | 100% tiến bộ kiểm tra thể chất cuối năm | 100 buổi tập thể thao |

**Lead measures (hành vi dẫn dắt):**
1. Theo dõi quá trình thực hiện (đếm hành vi/buổi theo ngày-tuần).
2. Ghi chú kết quả & cập nhật nội dung họp WIG hằng tuần với Coach (GVCN) và Buddy.
3. Thi đua toàn trường tính điểm cả 4 hạng mục; trong đó **Kỹ năng** gồm: 5 Giá trị, 7 Thói quen, DEAR, Thể chất, Khác.

---

## 5. Tính năng & phạm vi MVP (phân kỳ)

### Giai đoạn 1 — MVP chạy được (Sprint 1–2)
1. Đăng nhập đa nhóm (Google domain-restricted + mời phụ huynh).
2. **Trang lớp** (ảnh đại diện lớp) — màn hình đầu tiên, kèm tổng quan WIG.
3. **Điểm danh hằng ngày** — tick vắng/trễ, lưu realtime theo ngày.
4. Khung dữ liệu sẵn sàng cho WIG & scoreboard.

### Giai đoạn 2 — Lõi 4DX (Sprint 3–4)
5. **Thiết lập WIG** năm/tháng/tuần cho lớp & từng học sinh, 4 lĩnh vực.
6. **Lead measures** & theo dõi tiến độ tương ứng từng WIG.
7. **Ghi chú họp WIG tuần** (Coach × Buddy).

### Giai đoạn 3 — Thi đua & phân quyền đầy đủ (Sprint 5–6)
8. **Scoreboard** toàn trường tính điểm 4 hạng mục.
9. **Phân quyền đầy đủ 5 nhóm** + RLS chặt.
10. **Báo cáo cho phụ huynh** (đã lọc, chỉ con mình) và **BGH** (toàn cơ sở).

---

## 6. Luồng chính & các màn hình

**Màn hình đầu tiên:** Trang lớp với ảnh đại diện + tổng quan WIG tuần.
**Luồng tiêu biểu:** GVCN/Attendance leader mở app → Trang lớp → Điểm danh → tick HS vắng/trễ → app lưu realtime → scoreboard cập nhật.

Các màn hình chính:
1. Đăng nhập (chọn nhóm/SSO Google + magic link phụ huynh).
2. Trang lớp (ảnh + tổng quan WIG).
3. Điểm danh.
4. WIG & Lead measure (cấp lớp / cấp cá nhân).
5. Scoreboard thi đua.
6. Ghi chú họp WIG tuần.
7. Báo cáo (phụ huynh / BGH).
8. Quản trị (Admin): cơ sở, lớp, người dùng, gán phụ huynh–học sinh.

### 6.1 Nhận diện thương hiệu (Brand tokens — bắt buộc dùng)

Nguồn: **Brand Guidelines Trường Việt Anh (phiên bản chiến lược 2026)** do anh Dương cung cấp.

| Token | Mã | Dùng cho |
| :--- | :--- | :--- |
| `--navy` (Xanh Navy, chủ đạo) | `#26275D` | Uy tín, chuyên nghiệp, học thuật — header, nav, footer, nút chính, heading nhấn, link, border |
| `--gold` (Vàng Gold, nhấn) | `#F9DD0E` | Năng động, sáng tạo, nổi bật — highlight, tab active, CTA; chữ trên nền gold dùng navy |
| `--white` / `--grey-light` | `#FFFFFF` / `#F5F5F5`, `#EDEDED` | Nền trang, white space |
| `--ink` (chữ) | `#1A1A1A` / `#333333` | Chữ tiêu đề / chữ nội dung |
| `--grey-mid` | `#666666` | Chữ phụ |
| `--success` (Emerald) | `#1E8A5A` | **Thắng / on-track / tick xanh ✓** |
| `--status-bad` (đỏ trầm) | `#C0392B` | **Thua / off-track / cross đỏ ✗** (chỉ tín hiệu trạng thái chức năng) |

Font: **heading Montserrat** (600–900); **body Be Vietnam Pro** (16–18px, line-height 1.6–1.8). Không skip cấp heading, không dùng font script.

Logo: trên web trường có `https://truongvietanh.com/logo-vietanh.webp` và `https://truongvietanh.com/logo-th-thcs-thpt.png`, **nhưng hotlink trực tiếp dễ bị vỡ** (hotlink protection/offline). Khi build app cần **tải file logo gốc** đặt vào `public/logo.svg` (hoặc png) và import nội bộ. Trong wireframe tôi dùng **logo SVG lá chắn vẽ inline** (luôn hiển thị) làm placeholder — anh gửi file logo chính thức để thay. Ưu tiên full-color; cho phép navy đơn sắc/trắng trên nền navy; giữ clear space; không bóp méo/đổ bóng.

Mascot: **đầu sư tử** (Lion — từ Lion Camps) vẽ dạng icon SVG (bờm vàng gold, mặt nâu, mắt/mũi navy) dùng nhẹ ở banner trạng thái thắng và màn đăng nhập để tạo cảm giác vui vẻ.

5 giá trị (hiển thị màn đăng nhập): **Tôn trọng & Tự trọng · Trách nhiệm · Tài giỏi · Chính trực · Yêu thương**.

**Lưu ý theo guideline:** brand palette tránh đỏ/cam/hồng/tím "sale". Trong app này đỏ & emerald **chỉ dùng làm tín hiệu trạng thái thắng/thua** (functional status), không dùng cho mục đích khuyến mãi — đây là ngoại lệ hợp lý vì scoreboard cần đọc nhanh.

### 6.1.1 Nguyên tắc "nhìn 3 giây biết thắng/thua" (cho mọi Scoreboard)

Mọi màn scoreboard (lớp & học sinh) phải truyền đạt tình hình trong ~3 giây:
- **Banner trạng thái lớn** ở đầu: nền emerald "🦁 ĐANG THẮNG" hoặc nền đỏ "CẦN BỨT PHÁ", kèm ✓/✗ to.
- **WIG năm**: donut % + nhãn ON/OFF TRACK + tick xanh/cross đỏ.
- **WIG tuần**: dãy pip thắng/thua (ô xanh ✓ / xám ✗) + số "thắng/tổng".
- **Lead measure**: thanh tiến độ màu (xanh khi ≥ mục tiêu nhịp, gold khi giữa, đỏ khi tụt).
- Dùng biểu đồ tối giản (donut, thanh ngang, pip) — không bảng số dày đặc ở phần tổng quan.

### 6.2 Đặc tả chi tiết 8 màn hình (chốt theo trao đổi 23/06)

1. **Đăng nhập** — ảnh học sinh Việt Anh tràn màn hình + dải 5 giá trị; ô login đơn giản (username + mật khẩu). Sau đăng nhập **tự định tuyến theo vai trò**: Admin→/admin · BGH→campus · GVCN→trang lớp · Học sinh→scoreboard cá nhân · Phụ huynh→báo cáo con.
2. **Trang lớp = Scoreboard của lớp** — hero ảnh lớp **làm nền mờ** + **thứ hạng thi đua** so với khối / cấp / campus / group. Các box: **WIG năm ×4 lĩnh vực** (dự báo *on track / off track*); **WIG tuần gần nhất ×4** (thắng/tổng); **Lead measure** (hoàn thành/tổng). Menu: Danh sách · Điểm danh · Meeting · Thời khoá biểu · 🔔 thông báo. **Điểm thi đua = trung bình số Lead measure hoàn thành / học sinh.**
3. **Điểm danh** — **chỉ GVCN hoặc người được GVCN phân công** được sửa; tự mở theo ngày hôm nay; **không sửa quá khứ** (chỉ Admin sửa ngày cũ).
4. **Scoreboard từng học sinh** — bố cục như scoreboard lớp; khác biệt: có **bảng Lead measure tick hằng ngày**, **không sửa được mục đã tick quá 24 giờ**.
5. **WIG Meeting của lớp** — LM (hoàn thành/tổng) · WIG tuần (thắng/tổng) · **Chiêm nghiệm** · **Thiết lập WIG & LM tuần sau**.
6. **WIG Meeting từng học sinh** (Coach × Buddy) — cùng cấu trúc màn 5.
7. **Báo cáo phụ huynh** — mặc định tuần gần nhất, **lọc theo tuần**: Tên HS · Vắng/Trễ · WIG (thắng/tổng) · LM (hoàn thành/tổng) · Chiêm nghiệm · WIG tuần sau · LM tuần sau. Read-only, **chỉ con mình**.
8. **Quản trị** — bộ lọc đa cấp **Campus → Lớp → GVCN → Học sinh**; quản lý người dùng, gán GVCN, mời phụ huynh, gán quyền.

> Wireframe cả **mobile + laptop** cho 8 màn hình: xem `Wireframes_Viet_Anh_Class.html`.

> **Ghi chú dữ liệu phát sinh từ spec mới (cần bổ sung khi build):** (a) bảng/role "Attendance leader" — GVCN phân công người được điểm danh; (b) quy tắc khoá sửa: điểm danh khoá theo ngày, lead tick khoá sau 24h (kiểm ở RLS/`WITH CHECK` + cột `logged_date`/`created_at`); (c) cột dự báo WIG năm *on/off track* (tính theo tiến độ thực tế so với mốc thời gian); (d) bảng xếp hạng cần các cấp: khối (`grade`), cấp học, campus, group (toàn hệ thống).

---

## 7. Phân quyền & ma trận truy cập

### 7.1 Mô hình đăng nhập (chi tiết)

| Nhóm | Cơ chế | Ràng buộc miền | Cách tạo tài khoản |
| :--- | :--- | :--- | :--- |
| Admin / BGH / GVCN | Google OAuth (Supabase Auth) | **Bắt buộc** `@truongvietanh.com` | Tự đăng nhập lần đầu → Admin gán vai trò |
| Học sinh | Google OAuth | **Bắt buộc** `@student.truongvietanh.com` | Tự đăng nhập → tự động vào lớp đã gán theo email |
| Phụ huynh | Email + Magic Link / OTP | Email cá nhân bất kỳ **đã được Admin mời** | Admin nhập email PH → hệ thống gửi lời mời → PH set mật khẩu/OTP |

**Giới hạn miền email — cách thực thi (3 lớp phòng vệ):**
1. **Auth Hook `before user created`** trên Supabase: từ chối tạo user nếu email không thuộc miền được phép (trừ phụ huynh đã được mời sẵn trong bảng `parent_invitations`).
2. **Database trigger** trên `auth.users`: kiểm tra lại miền và set `role` mặc định an toàn (`pending`) nếu không khớp.
3. **App guard (middleware Next.js):** chặn route nếu `profiles.role = 'pending'` hoặc miền sai, hiển thị màn hình "tài khoản chưa được cấp quyền".

> **Lưu ý kỹ thuật (quan trọng, tôi nói thẳng):** Supabase **không** có ô cấu hình "chỉ chấp nhận domain X" sẵn trong dashboard cho Google. Việc giới hạn miền phải tự làm bằng Auth Hook hoặc trigger như trên. Đừng chỉ kiểm tra ở phía client — luôn chặn ở tầng database/hook vì client có thể bị bỏ qua.

### 7.2 Ma trận truy cập dữ liệu

| Vai trò | Phạm vi xem | Phạm vi sửa |
| :--- | :--- | :--- |
| **Admin** | Tất cả cơ sở, tất cả bảng | Tất cả |
| **BGH cơ sở** | Mọi lớp/HS/scoreboard trong **cơ sở mình** | Cấu hình cơ sở, không sửa điểm danh thủ công của lớp (chỉ xem/duyệt) |
| **GVCN** | Toàn bộ dữ liệu **lớp mình** (HS, điểm danh, WIG, lead, họp WIG) | Điểm danh, WIG lớp, lead measure, biên bản họp |
| **Học sinh** | Dữ liệu **lớp mình** + WIG/lead **cá nhân mình** | Cập nhật tiến độ lead measure cá nhân, ghi chú Buddy |
| **Phụ huynh** | **CHỈ báo cáo đã lọc về con mình** | Không sửa gì (read-only) |

**Đặc tả "báo cáo đã lọc" của phụ huynh** — phụ huynh CHỈ thấy các trường sau của **con mình**: họ tên con, lớp, tổng quan điểm danh (số buổi vắng/trễ theo tuần/tháng), tiến độ WIG cá nhân theo 4 lĩnh vực, điểm thi đua cá nhân, nhận xét tổng hợp của GVCN. **KHÔNG** thấy: danh sách/dữ liệu học sinh khác, ghi chú nội bộ lớp, dữ liệu thô điểm danh của HS khác.

---

## 8. Kiến trúc kỹ thuật

```
[ Trình duyệt / Mobile ]
        │  (HTTPS)
        ▼
[ Next.js App Router @ Vercel ]
   ├─ Server Components / Route Handlers
   ├─ Middleware (auth guard + domain check)
   └─ @supabase/ssr client (cookie-based session)
        │
        ▼
[ Supabase (project riêng cho Viet Anh Class) ]
   ├─ Auth (Google OAuth + Email OTP/Magic Link)
   ├─ Postgres + Row Level Security (RLS)
   ├─ Realtime (điểm danh, scoreboard)
   ├─ Storage (ảnh đại diện lớp, avatar)
   └─ Edge Functions (gửi lời mời PH, tính điểm scoreboard, Auth Hook domain)
```

**Ràng buộc kỹ thuật:**
- Song ngữ Việt–Anh, có nút chuyển ngôn ngữ (i18n: `next-intl`).
- Responsive tốt trên điện thoại và máy tính.
- TypeScript end-to-end; sinh type từ schema bằng `supabase gen types typescript`.
- Toàn bộ truy cập dữ liệu **đi qua RLS** — không dùng `service_role` ở phía client.
- Triển khai CI/CD qua Vercel (preview deploy mỗi PR), migration DB bằng Supabase CLI.

---

## 9. Thiết kế cơ sở dữ liệu (Supabase / Postgres)

### 9.1 Sơ đồ quan hệ (tóm tắt)

```
campuses 1───* classes 1───* enrollments *───1 profiles(student)
                   │                              
classes 1───* attendance_records                 
classes 1───* wigs 1───* lead_measures 1───* lead_progress
wigs (scope: class | student) ── student_id (nullable)
classes 1───* wig_meetings
parent_links: profiles(parent) *───* profiles(student)
scoreboard_entries: campus/class/student × category × period
parent_invitations: email mời → khi đăng nhập gắn vào profiles(parent)
```

### 9.2 Bảng chính (DDL rút gọn)

```sql
-- Cơ sở (multi-tenant ready; đợt 1 chỉ bật 1 cơ sở)
create table campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Hồ sơ người dùng (1-1 với auth.users)
create type user_role as enum ('admin','principal','teacher','student','parent','pending');
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role user_role not null default 'pending',
  campus_id uuid references campuses(id),
  avatar_url text,
  locale text default 'vi',
  created_at timestamptz default now()
);

-- Lớp học
create table classes (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id),
  name text not null,
  grade text,
  school_year text not null,            -- '2026-2027'
  homeroom_teacher_id uuid references profiles(id),
  cover_image_url text,
  created_at timestamptz default now()
);

-- Ghi danh học sinh vào lớp
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  is_active boolean default true,
  unique (class_id, student_id)
);

-- Liên kết phụ huynh - học sinh (nhiều-nhiều)
create table parent_links (
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  relationship text,                    -- 'father','mother','guardian'
  primary key (parent_id, student_id)
);

-- Lời mời phụ huynh (để cho phép email ngoài miền)
create table parent_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  student_id uuid not null references profiles(id),
  invited_by uuid references profiles(id),
  status text default 'pending',        -- pending | accepted | revoked
  created_at timestamptz default now(),
  unique (email, student_id)
);

-- Điểm danh
create type attendance_status as enum ('present','absent','late','excused');
create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  status attendance_status not null default 'present',
  note text,
  marked_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (class_id, student_id, date)
);

-- WIG (cấp lớp hoặc cá nhân)
-- LĨNH VỰC cố định (4); TIÊU CHÍ cố định theo công thức:
--   "Hoàn thành [target_value] [unit] từ [start_date] đến [end_date]"
create type wig_area as enum ('knowledge','skills','english','physical');
create type wig_scope as enum ('class','student');
create type wig_period as enum ('year','month','week');
create table wigs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid references profiles(id),       -- null nếu scope='class'
  scope wig_scope not null,
  area wig_area not null,                          -- 4 lĩnh vực CỐ ĐỊNH
  period wig_period not null,
  period_label text,                              -- '2026-2027','2026-09','W38'
  parent_wig_id uuid references wigs(id),         -- liên kết năm→tháng→tuần
  -- Tiêu chí WIG cố định khuôn dạng: hoàn thành <target_value> <unit> trong khoảng ngày
  target_value numeric not null,                  -- số lượng cụ thể (vd 200)
  unit text not null,                             -- đơn vị (vd 'buổi tutor')
  start_date date not null,                       -- từ ngày
  end_date date not null,                         -- đến ngày
  -- title sinh tự động ở app: 'Hoàn thành 200 buổi tutor từ 01/09 đến 30/09'
  note text,
  created_at timestamptz default now(),
  check (end_date >= start_date)
);

-- Lead measures gắn vào 1 WIG
create table lead_measures (
  id uuid primary key default gen_random_uuid(),
  wig_id uuid not null references wigs(id) on delete cascade,
  title text not null,                            -- 'buổi tutor','hành vi văn hoá'
  target_value numeric not null,
  unit text,
  created_at timestamptz default now()
);

-- Tiến độ lead measure (ghi theo lần/ngày)
create table lead_progress (
  id uuid primary key default gen_random_uuid(),
  lead_measure_id uuid not null references lead_measures(id) on delete cascade,
  student_id uuid references profiles(id),        -- ai thực hiện (nếu cá nhân)
  value numeric not null default 1,
  logged_date date not null default current_date,
  logged_by uuid references profiles(id),
  note text,
  created_at timestamptz default now()
);

-- Biên bản họp WIG tuần
create table wig_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_id uuid references profiles(id),        -- nếu họp cá nhân Coach×Buddy
  week_label text not null,                        -- 'W38-2026'
  coach_id uuid references profiles(id),
  buddy_id uuid references profiles(id),
  commitments text,
  results text,
  next_actions text,
  created_at timestamptz default now()
);

-- Scoreboard thi đua (4 hạng mục)
create type score_category as enum ('knowledge','skills','english','physical');
create table scoreboard_entries (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id),
  class_id uuid references classes(id),
  student_id uuid references profiles(id),
  category score_category not null,
  sub_category text,                               -- '5 Giá trị','7 Thói quen','DEAR'...
  points numeric not null default 0,
  period_label text not null,                      -- 'W38-2026'
  source_ref uuid,                                 -- tham chiếu lead_progress nếu auto
  created_at timestamptz default now()
);
```

### 9.3 Hàm tiện ích phân quyền (helper functions)

```sql
-- Lấy role của user hiện tại (định nghĩa SECURITY DEFINER, tránh đệ quy RLS)
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_campus() returns uuid
language sql stable security definer set search_path = public as $$
  select campus_id from profiles where id = auth.uid();
$$;

-- User hiện tại có dạy lớp này không
create or replace function is_class_teacher(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from classes where id = c and homeroom_teacher_id = auth.uid());
$$;

-- User hiện tại có học lớp này không
create or replace function is_class_student(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from enrollments where class_id = c and student_id = auth.uid() and is_active);
$$;

-- Học sinh s có phải con của phụ huynh hiện tại không
create or replace function is_my_child(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from parent_links where parent_id = auth.uid() and student_id = s);
$$;
```

### 9.4 Chính sách RLS (mẫu cho các bảng nhạy cảm)

> Bật RLS cho **mọi** bảng: `alter table <t> enable row level security;`

```sql
-- ATTENDANCE: GVCN lớp sửa được; HS xem lớp mình; PH chỉ xem con mình; BGH xem trong cơ sở; Admin tất cả
create policy att_teacher_all on attendance_records
  for all using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));

create policy att_student_read on attendance_records
  for select using (is_class_student(class_id));

create policy att_parent_read on attendance_records
  for select using (is_my_child(student_id));

create policy att_principal_read on attendance_records
  for select using (
    auth_role() = 'principal'
    and exists(select 1 from classes c where c.id = class_id and c.campus_id = auth_campus())
  );

create policy att_admin_all on attendance_records
  for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- WIGS: GVCN quản lý WIG lớp; HS xem lớp + sửa WIG cá nhân mình; PH chỉ xem WIG con
create policy wig_teacher_all on wigs
  for all using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy wig_student_read on wigs
  for select using (is_class_student(class_id));
create policy wig_student_self_write on wigs
  for update using (scope='student' and student_id = auth.uid());
create policy wig_parent_read on wigs
  for select using (scope='student' and is_my_child(student_id));
create policy wig_admin_all on wigs
  for all using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- PROFILES: ai cũng đọc hồ sơ của chính mình; PH đọc hồ sơ con; GVCN/BGH/Admin đọc trong phạm vi
create policy prof_self on profiles for select using (id = auth.uid());
create policy prof_parent_child on profiles for select using (is_my_child(id));
create policy prof_admin_all on profiles
  for all using (auth_role() = 'admin') with check (auth_role() = 'admin');
```

> **Nguyên tắc vàng cho RLS phụ huynh:** mọi truy vấn của phụ huynh đều phải đi qua `is_my_child(student_id)`. Trước khi go-live, viết **test tự động**: đăng nhập bằng tài khoản phụ huynh A và khẳng định KHÔNG đọc được bất kỳ dòng nào có `student_id` không thuộc con của A (xem Mục 12).

---

## 10. Roadmap triển khai (6 sprint, ~12 tuần)

| Sprint | Mục tiêu | Đầu ra kiểm chứng được |
| :--- | :--- | :--- |
| **0 — Setup** | Tạo Supabase project riêng, repo Next.js, kết nối Vercel, i18n, layout song ngữ | App deploy được trên Vercel, đăng nhập Google miền `@truongvietanh.com` chạy |
| **1 — Auth & Trang lớp** | Auth 3 nhóm + Auth Hook domain + Trang lớp + Admin tạo lớp/HS | Đăng nhập đúng nhóm; tài khoản sai miền bị chặn; trang lớp hiển thị |
| **2 — Điểm danh realtime** | Điểm danh ngày + Supabase Realtime + lịch sử | 2 thiết bị thấy điểm danh cập nhật < 3s |
| **3 — WIG & Lead** | Thiết lập WIG năm/tháng/tuần (lớp & cá nhân) + lead measure + log tiến độ | Tạo đủ WIG 4 lĩnh vực, lead tự cộng tiến độ |
| **4 — Họp WIG & Scoreboard** | Biên bản họp tuần + scoreboard 4 hạng mục (auto từ lead_progress) | Scoreboard ra điểm đúng từ dữ liệu lead |
| **5 — Phân quyền & Báo cáo** | Hoàn thiện RLS 5 nhóm + mời phụ huynh + báo cáo lọc + báo cáo BGH | Test RLS phụ huynh PASS; PH chỉ thấy con mình |
| **6 — Hardening** | Rà soát bảo mật, audit log, seed dữ liệu giả, UAT 1 cơ sở | Đội IT trường review; go-live pilot 1 cơ sở |

---

## 11. Bộ prompt build sẵn cho Claude Code

> Cách dùng: mở Claude Code trong thư mục repo trống, dán **Prompt 0** trước, rồi lần lượt các prompt sau khi mỗi giai đoạn chạy ổn. Mỗi prompt là một đơn vị nhỏ để "vibe coding" không bị tắc.

### Prompt 0 — Khởi tạo dự án
```
Tạo một app web tên "Viet Anh Class" bằng Next.js (App Router, TypeScript),
Tailwind CSS, giao diện SONG NGỮ Việt–Anh có nút chuyển ngôn ngữ (dùng next-intl).
Backend dùng Supabase (đã có project riêng) qua thư viện @supabase/ssr với session
lưu bằng cookie. Triển khai trên Vercel. Thiết lập cấu trúc thư mục: app/(auth),
app/(dashboard), lib/supabase, components, messages/vi.json, messages/en.json.
Tạo .env.example với NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
Chưa cần tính năng — chỉ dựng khung chạy được và deploy được lên Vercel.
```

### Prompt 1 — CSDL & RLS
```
Dùng Supabase. Tạo migration SQL theo schema trong PRD v2 mục 9 (campuses, profiles,
classes, enrollments, parent_links, parent_invitations, attendance_records, wigs,
lead_measures, lead_progress, wig_meetings, scoreboard_entries) kèm các enum, helper
functions (auth_role, auth_campus, is_class_teacher, is_class_student, is_my_child)
và BẬT RLS cho mọi bảng với policy theo mục 9.4. Tạo trigger tự sinh profiles khi có
auth.users mới, set role='pending' nếu email không thuộc @truongvietanh.com hoặc
@student.truongvietanh.com và không có trong parent_invitations.
```

### Prompt 2 — Đăng nhập đa nhóm
```
Thêm đăng nhập: (1) Google OAuth qua Supabase cho giáo viên/admin/BGH (chỉ chấp nhận
@truongvietanh.com) và học sinh (@student.truongvietanh.com); (2) Magic Link/OTP cho
phụ huynh, chỉ những email đã có trong parent_invitations. Viết middleware Next.js chặn
mọi route nếu profiles.role='pending' và hiển thị trang "Tài khoản chưa được cấp quyền".
Thêm Supabase Auth Hook (before user created) hoặc Edge Function từ chối user sai miền.
```

### Prompt 3 — Trang lớp + Admin
```
Tạo Trang lớp là màn hình đầu sau đăng nhập: ảnh đại diện lớp (Supabase Storage),
tên lớp, GVCN, sĩ số, và ô tổng quan WIG tuần (rỗng nếu chưa có). Tạo khu Admin để
tạo cơ sở, tạo lớp, thêm học sinh vào lớp (enrollments), mời phụ huynh (ghi
parent_invitations + gửi email mời), và gán parent_links. Tôn trọng RLS.
```

### Prompt 4 — Điểm danh realtime
```
Thêm màn Điểm danh hằng ngày: danh sách học sinh của lớp, tick trạng thái
present/absent/late/excused, lưu vào attendance_records (unique class+student+date).
Dùng Supabase Realtime để 2 thiết bị cùng lớp thấy thay đổi tức thời. Thêm trang lịch
sử điểm danh theo tuần/tháng cho GVCN.
```

### Prompt 5 — WIG & Lead measure
```
Thêm thiết lập WIG: tạo WIG cấp lớp và cấp học sinh, 4 lĩnh vực (knowledge, skills,
english, physical), 3 cấp period (year/month/week) liên kết cha-con qua parent_wig_id.
Mỗi WIG gắn nhiều lead_measures có target. Cho phép log lead_progress theo ngày; tự
tính % tiến độ lead so với target và roll-up lên WIG cha.
```

### Prompt 6 — Họp WIG + Scoreboard
```
Thêm màn Ghi chú họp WIG tuần (coach × buddy: commitments, results, next_actions theo
week_label). Thêm Scoreboard thi đua toàn cơ sở tính điểm 4 hạng mục, trong đó Kỹ năng
gồm sub_category: 5 Giá trị, 7 Thói quen, DEAR, Thể chất, Khác. Điểm tự cộng từ
lead_progress qua Edge Function; hiển thị bảng xếp hạng lớp theo period_label, realtime.
```

### Prompt 7 — Báo cáo & hoàn thiện phân quyền
```
Thêm Báo cáo phụ huynh (read-only, CHỈ con mình qua is_my_child): điểm danh tổng hợp,
tiến độ WIG cá nhân 4 lĩnh vực, điểm thi đua cá nhân, nhận xét GVCN. Thêm Báo cáo BGH
xem toàn cơ sở. Viết test tự động kiểm chứng RLS: tài khoản phụ huynh KHÔNG đọc được
dữ liệu học sinh không phải con mình. Thêm bảng audit_log ghi truy cập báo cáo nhạy cảm.
```

---

## 12. An toàn dữ liệu (BẮT BUỘC — dữ liệu thật của học sinh)

⚠️ App chứa dữ liệu THẬT (điểm danh, đánh giá, tiến bộ) và mở cho phụ huynh + nhiều cấp lãnh đạo. Đây là nhóm cần làm chặt bảo mật & quyền riêng tư.

1. **Khi học/thử nghiệm:** chỉ dùng dữ liệu GIẢ (seed script), tuyệt đối không nhập thông tin thật của học sinh.
2. **Không bao giờ** để lộ `service_role key` ra client; mọi truy cập client dùng `anon key` + RLS.
3. **Test RLS bắt buộc trước go-live:** kịch bản phụ huynh A không thấy con người khác; học sinh không thấy lớp khác; GVCN không thấy lớp không phụ trách; BGH không thấy cơ sở khác.
4. **Audit log** cho truy cập báo cáo và thao tác Admin (gán parent_links, đổi vai trò).
5. **Vòng review chuyên môn:** trước khi đưa dữ liệu thật vào dùng chính thức, đội IT/kỹ thuật của trường rà soát phân quyền & RLS. Vibe coding rất hợp để dựng prototype/demo, nhưng với dữ liệu học sinh thật cần một vòng kiểm tra độc lập.
6. **Sao lưu & khôi phục:** bật Point-in-Time Recovery của Supabase; định kỳ export.

---

## 13. Ngoài phạm vi v1 (chắc chắn KHÔNG làm)

Thanh toán/học phí; chat/nhắn tin giữa phụ huynh–giáo viên; thông báo đẩy (push notification); tích hợp phần mềm quản lý trường hiện có; AI chấm/nhận xét tự động. Có thể cân nhắc ở phiên bản sau.

---

## 14. To-do list hành động cho anh Dương

1. **Xác nhận hạ tầng email học sinh:** trường đã thực sự cấp `@student.truongvietanh.com` cho học sinh chưa? Nếu chưa, cần kế hoạch cấp trước Sprint 1.
2. **Chốt người sở hữu Supabase project & Vercel:** ai giữ quyền owner/billing (đề xuất: tài khoản IT trường, không phải cá nhân).
3. **Chọn cơ sở pilot:** quyết định 1 cơ sở chạy đợt đầu và lập danh sách lớp.
4. **Chuẩn bị dữ liệu mẫu:** 1 lớp giả với ~25 học sinh giả + 2–3 phụ huynh giả để test RLS.
5. **Cử đầu mối IT review bảo mật:** chỉ định người rà soát RLS trước go-live.
6. **Duyệt bộ WIG chuẩn 4 lĩnh vực** để seed sẵn cho các lớp (đỡ GVCN nhập tay).
7. **Giao tôi bước tiếp theo:** anh muốn tôi (a) sinh luôn file SQL migration đầy đủ chạy được, (b) viết script seed dữ liệu giả, hay (c) dựng khung repo Next.js để bắt đầu code?

---

*Nguồn: PRD v1 "Viet Anh Class" (Google Doc nội bộ Trường Việt Anh) + 4 quyết định kiến trúc anh chốt ngày 23/06/2026. Các đặc tả Supabase/RLS/Next.js dựa trên thực hành chuẩn của nền tảng. Mọi mục đánh dấu "ý kiến của tôi" là khuyến nghị của Claude, anh chỉnh theo thực tế trường.*
