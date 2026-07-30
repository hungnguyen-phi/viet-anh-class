-- 0063 — Album ảnh học tập / sự kiện theo LỚP + bucket RIÊNG TƯ cho ảnh học sinh.
--
-- Phụ huynh xin. Đây là tính năng RỦI RO NHẤT trong ba cái, vì nó là lần đầu app lưu KHUÔN MẶT
-- trẻ em. Mọi quyết định thiết kế dưới đây nghiêng về phía đóng.

set search_path = public;

create table if not exists class_albums (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes(id) on delete cascade,
  title       text not null check (btrim(title) <> ''),

  -- Ngày DIỄN RA sự kiện, không phải ngày tải lên: GVCN thường tải ảnh sau vài hôm, mà phụ
  -- huynh tìm theo "hôm hội thao". Mặc định giờ VN, cùng lý do như 0060/0019.
  event_date  date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,

  description text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table class_albums is
  'Album ảnh theo lớp. GVCN tạo và tải ảnh; HS trong lớp + PH có con trong lớp xem.';
comment on column class_albums.event_date is
  'Ngày sự kiện diễn ra (khác ngày tải lên) — phụ huynh tìm ảnh theo ngày diễn ra.';

drop trigger if exists trg_class_albums_touch on class_albums;
create trigger trg_class_albums_touch before update on class_albums
  for each row execute function touch_updated_at();

-- Lấy lớp của album, để policy của class_photos và của storage.objects không phải join thẳng
-- vào class_albums (join thẳng bị RLS chặn / gây đệ quy). Khuôn wig_class ở 0004.
create or replace function album_class(a uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select class_id from class_albums where id = a;
$$;
revoke all on function album_class(uuid) from public, anon;
grant execute on function album_class(uuid) to authenticated;

alter table class_albums enable row level security;

-- ĐỌC: đúng ba nhóm — HS đang học lớp đó, PH có con trong lớp, nhân sự đọc được lớp đó.
drop policy if exists rls_select_class_albums on class_albums;
create policy rls_select_class_albums on class_albums for select
  using (
    is_class_student(class_id)
    or is_parent_of_class(class_id)
    or staff_can_read_class(class_id)
  );

-- TẠO/SỬA/XOÁ: GVCN của chính lớp đó + admin. Hiệu trưởng đọc được nhưng KHÔNG đăng được —
-- người chụp và người chịu trách nhiệm về ảnh lớp là GVCN.
drop policy if exists rls_all_class_albums on class_albums;
create policy rls_all_class_albums on class_albums for all
  using (staff_can_manage_class(class_id))
  with check (staff_can_manage_class(class_id));

grant select, insert, update, delete on class_albums to authenticated;

-- Truy vấn chính: "album của lớp tôi, sự kiện mới nhất trước". class_id là cột đầu nên chỉ mục
-- ghép này đồng thời làm chỉ mục cho khoá ngoại class_id.
create index if not exists idx_class_albums_class on class_albums (class_id, event_date desc);

-- Khoá ngoại thứ hai, phải có chỉ mục riêng (cảnh báo advisor ở 0053).
create index if not exists idx_class_albums_created_by on class_albums (created_by);


create table if not exists class_photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references class_albums(id) on delete cascade,

  -- Đường dẫn TRONG bucket 'class-photos'. BẮT BUỘC theo quy ước '<class_id>/<album_id>/<tệp>'.
  -- Quy ước này không phải để cho gọn: policy ghi trên storage.objects đọc thư mục cấp 1 để biết
  -- ảnh thuộc lớp nào (y hệt can_manage_class_cover ở 0037). Đặt sai dạng thì DB từ chối ghi.
  storage_path text not null unique,

  caption      text,
  sort_order   int not null default 0,
  uploaded_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),

  -- Chặn tại DB thay vì tin vào client: client là thứ dễ sửa nhất trong hệ thống, mà đây lại là
  -- ràng buộc mà toàn bộ mô hình quyền của Storage dựa vào.
  constraint class_photos_path_shape check (
    storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/.+$'
  )
);

comment on table class_photos is
  'Một hàng = một tệp ảnh trong bucket riêng tư class-photos. Xoá hàng này là cắt quyền đọc tệp tương ứng.';
comment on column class_photos.storage_path is
  'Đường dẫn trong bucket, dạng <class_id>/<album_id>/<tệp>. Policy Storage dựa vào thư mục cấp 1 để xác định lớp.';

alter table class_photos enable row level security;

-- ĐỌC: theo lớp của ALBUM chứa ảnh. Đi qua album_class() chứ không join class_albums, để không
-- bị RLS của class_albums chặn và không gây đệ quy policy.
drop policy if exists rls_select_class_photos on class_photos;
create policy rls_select_class_photos on class_photos for select
  using (
    is_class_student(album_class(album_id))
    or is_parent_of_class(album_class(album_id))
    or staff_can_read_class(album_class(album_id))
  );

-- GHI: GVCN lớp đó + admin.
drop policy if exists rls_all_class_photos on class_photos;
create policy rls_all_class_photos on class_photos for all
  using (staff_can_manage_class(album_class(album_id)))
  with check (staff_can_manage_class(album_class(album_id)));

grant select, insert, update, delete on class_photos to authenticated;

-- Truy vấn chính: "mọi ảnh của album này, theo thứ tự GVCN đã xếp". album_id là cột đầu nên đây
-- cũng là chỉ mục cho khoá ngoại album_id.
create index if not exists idx_class_photos_album on class_photos (album_id, sort_order, created_at);

-- Khoá ngoại thứ hai.
create index if not exists idx_class_photos_uploaded_by on class_photos (uploaded_by);

-- storage_path đã có chỉ mục duy nhất tự động từ ràng buộc UNIQUE. Đừng bỏ ràng buộc đó để
-- "tiết kiệm": policy đọc trên storage.objects tra cứu bằng đúng cột này cho TỪNG tệp trong
-- album — 60 ảnh là 60 lượt tra. Có unique index thì mỗi lượt là một lần tìm khoá; không có thì
-- là 60 lần quét toàn bảng.


-- ══ BUCKET RIÊNG TƯ ════════════════════════════════════════════════════════
-- KHÁC CĂN BẢN với class-covers ở 0006: public = FALSE.
-- 0006 tạo bucket class-covers với public = true, nghĩa là BẤT KỲ AI có đường dẫn đều tải được
-- ảnh, không cần đăng nhập, không qua RLS. Với ảnh bìa lớp thì đó là lựa chọn có thể bàn.
-- Với ảnh có mặt học sinh thì KHÔNG, dứt khoát: một đường dẫn lọt ra ngoài là ảnh trẻ em nằm
-- trên Internet mở, không thu hồi được, và không có bản ghi nào cho biết ai đã tải.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'class-photos', 'class-photos', false,
  10485760,  -- 10 MB: ảnh điện thoại đủ nét; chặn luôn việc dùng bucket này làm kho video.
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;


-- ── Hàm phân quyền cho Storage ─────────────────────────────────────────────
-- Chiều GHI: đọc thư mục cấp 1 của đường dẫn ra class_id rồi kiểm quyền quản lý lớp.
-- plpgsql + block exception vì (storage.foldername(name))[1]::uuid sẽ NỔ nếu client đặt đường
-- dẫn không đúng dạng; ném lỗi ra ngoài policy là hỏng cả câu lệnh, nên bắt lại và trả false.
-- Đúng khuôn can_manage_class_cover đã vá ở 0037 — bản 0006 gốc chỉ kiểm bucket_id, tức là mọi
-- user đăng nhập đều ghi/đè/xoá được ảnh bìa của MỌI lớp. Không lặp lại lỗi đó ở đây.
create or replace function can_manage_class_photo(p_name text) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare v_class uuid;
begin
  begin
    v_class := (storage.foldername(p_name))[1]::uuid;
  exception when others then
    return false;  -- đường dẫn không đúng dạng '<uuid>/...' → từ chối
  end;
  return v_class is not null and staff_can_manage_class(v_class);
end $$;
revoke all on function can_manage_class_photo(text) from public, anon;
grant execute on function can_manage_class_photo(text) to authenticated;

-- Chiều ĐỌC: tra ngược từ tên tệp về hàng class_photos.
-- Vì sao không kiểm theo đường dẫn như chiều ghi: kiểm theo hàng thì XOÁ ẢNH TRONG APP LÀ CẮT
-- QUYỀN ĐỌC NGAY, không phụ thuộc vào việc app có nhớ gọi storage.remove() hay không. Tệp mồ côi
-- còn sót lại trong bucket sẽ không đọc được nữa — hỏng theo hướng ĐÓNG.
create or replace function can_read_class_photo(p_name text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from class_photos p
    join class_albums a on a.id = p.album_id
    where p.storage_path = p_name
      and (
        is_class_student(a.class_id)
        or is_parent_of_class(a.class_id)
        or staff_can_read_class(a.class_id)
      )
  );
$$;
revoke all on function can_read_class_photo(text) from public, anon;
grant execute on function can_read_class_photo(text) to authenticated;


-- ══ ĐỌC ẢNH BẰNG SIGNED URL — VÀ NÓ PHỨC TẠP HƠN THẬT ══════════════════════
-- Nói thẳng: bucket riêng tư ĐẮT HƠN bucket công khai về công sức, và đây là cái giá phải trả.
--
-- 1. getPublicUrl() KHÔNG DÙNG ĐƯỢC NỮA. Nó vẫn trả về một chuỗi trông như URL hợp lệ (hàm này
--    chỉ nối chuỗi, không hỏi server), nhưng mở ra sẽ 400. Đây là bẫy im lặng — code sao chép
--    từ ClassCoverUpload.tsx sang sẽ chạy không báo lỗi rồi hiện toàn ảnh vỡ.
--    Phải dùng createSignedUrl(path, ttl), và với cả album thì dùng createSignedUrls (số nhiều)
--    để ký cả loạt trong MỘT lượt gọi — không thì 60 ảnh là 60 vòng mạng.
--
-- 2. KHÔNG LƯU SIGNED URL VÀO DB. Nó có hạn dùng; lưu vào cột nào đó là hôm sau cả album chết.
--    URL phải được ký LẠI mỗi lần dựng trang, trong server component, bằng client mang phiên của
--    chính người dùng — chính lúc đó policy class_photos_read ở dưới mới có hiệu lực.
--
-- 3. SIGNED URL LÀ VÉ VÀO CỬA, KHÔNG PHẢI THẺ TÊN. Ai cầm được đường dẫn đó đều xem được ảnh
--    cho tới khi hết hạn, kể cả người chưa đăng nhập. RLS không đi theo cái link. Phụ huynh
--    chuyển tiếp vào nhóm Zalo là ảnh ra khỏi vành đai. Vì vậy: TTL ngắn (1 giờ là hợp lý), và
--    đừng đặt trang album sau CDN cache dùng chung.
--
-- 4. HẠN URL LÀM HỎNG TRANG MỞ LÂU. Trang để mở qua đêm rồi cuộn xuống sẽ thấy ảnh vỡ. Cần một
--    trong hai: TTL đủ dài hơn phiên xem thông thường, hoặc bắt sự kiện onError của <img> để
--    gọi router.refresh() ký lại.
--
-- 5. next/image cần cấu hình thêm. Signed URL trỏ tới host Supabase kèm query string — phải khai
--    remotePatterns trong next.config.ts, hoặc dùng <img> thường cho album.
--
-- Có đáng không: có. Cái phải đánh đổi là vài chục dòng code và một quy tắc phải nhớ. Cái nhận
-- lại là ảnh khuôn mặt học sinh không nằm trên đường dẫn công khai vĩnh viễn.

-- ĐỌC tệp: qua can_read_class_photo → tra hàng class_photos → theo lớp của album.
-- Chính policy này là thứ quyết định createSignedUrl() thành công hay bị từ chối, vì lệnh ký URL
-- chạy dưới phiên của người dùng và phải qua được RLS SELECT trên storage.objects.
drop policy if exists class_photos_read on storage.objects;
create policy class_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'class-photos' and can_read_class_photo(name));

-- KHÔNG có policy nào cho vai `anon`, cố ý. Bucket riêng tư + không policy cho anon = người chưa
-- đăng nhập không có bất kỳ đường nào chạm tới ảnh, kể cả khi đoán đúng đường dẫn.

-- GHI/ĐÈ/XOÁ tệp: chỉ GVCN của đúng lớp trong đường dẫn, + admin.
drop policy if exists class_photos_insert on storage.objects;
create policy class_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'class-photos' and can_manage_class_photo(name));

drop policy if exists class_photos_update on storage.objects;
create policy class_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'class-photos' and can_manage_class_photo(name))
  with check (bucket_id = 'class-photos' and can_manage_class_photo(name));

drop policy if exists class_photos_delete on storage.objects;
create policy class_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'class-photos' and can_manage_class_photo(name));

-- storage.objects đã được Supabase cấp GRANT sẵn cho authenticated → không cần grant thêm.
-- Nhưng LUẬT 1 vẫn áp cho ba bảng public mới (đã cấp ở từng mục trên): thiếu GRANT thì PostgREST
-- trả 42501 dù RLS đúng — 0015 và 0037 đều đã dính đúng lỗi này.

-- storage.objects đã có sẵn chỉ mục trên (bucket_id, name) do Supabase tạo — không thêm gì ở đây,
-- và KHÔNG nên tự thêm index vào schema storage (Supabase quản lý schema đó, migration của mình
-- có thể xung đột khi họ nâng cấp).
--
-- Chỗ cần index cho đường đọc ảnh nằm ở bảng của MÌNH, và đã có: class_photos.storage_path unique.
-- can_read_class_photo() tra bảng đó MỘT LẦN CHO MỖI TỆP — mở album 60 ảnh là 60 lượt tra trong
-- một câu createSignedUrls. Có unique index thì mỗi lượt là một index scan; bỏ ràng buộc unique
-- đi là biến thao tác mở album thành 60 lần quét toàn bảng.
