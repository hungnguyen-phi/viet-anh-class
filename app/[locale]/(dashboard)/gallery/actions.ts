'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Giữ ?class= (bộ chọn lớp) và ?album= (album đang mở) khi quay lại. Xoá một ảnh mà bị đá về
// danh sách album thì GVCN phải bấm vào lại album để xoá tấm tiếp theo.
function galleryFlash(classId: string, albumId: string | null, msg: string): never {
  const q = new URLSearchParams();
  if (classId) q.set('class', classId);
  if (albumId) q.set('album', albumId);
  const g = tachLoi(msg);
  q.set(g.laLoi ? 'flash_err' : 'flash', g.msg);
  redirect(`/gallery?${q.toString()}`);
}

// State cho useActionState → lỗi hiện cạnh ô, giữ nguyên nội dung đã gõ (không redirect).
export type AlbumState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldError?: string;
  values?: {title: string; event_date: string; description: string};
};

// Tạo album. Quyền: staff_can_manage_class = GVCN của chính lớp đó, hoặc admin (0063).
// HIỆU TRƯỞNG CỐ Ý KHÔNG CÓ trong danh sách: BGH đọc được ảnh của lớp trong cơ sở mình
// (staff_can_read_class) nhưng người chụp và người chịu trách nhiệm về ảnh trẻ là GVCN.
export async function createAlbum(_prev: AlbumState, formData: FormData): Promise<AlbumState> {
  const me = await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const eventDate = String(formData.get('event_date') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const values = {title, event_date: eventDate, description};

  if (!classId) return {ok: false, error: (friendlyError(null)), values};
  if (!title)
    return {ok: false, fieldError: 'title', error: 'Hãy đặt tên cho album.', values};
  if (!ISO_DATE.test(eventDate))
    return {
      ok: false,
      fieldError: 'event_date',
      error: 'Ngày sự kiện chưa hợp lệ.',
      values,
    };

  const supabase = await createClient();
  // .select() để phân biệt "RLS chặn vì mình không chủ nhiệm lớp này" với "đã tạo xong".
  const {data, error} = await supabase
    .from('class_albums')
    .insert({
      class_id: classId,
      title,
      // Ngày DIỄN RA sự kiện, không phải ngày tải ảnh — phụ huynh tìm theo "hôm hội thao" (0063).
      event_date: eventDate,
      description: description || null,
      created_by: me.id,
    })
    .select('id');

  if (error) return {ok: false, error: (friendlyError(error)), values};
  if (!data || data.length === 0)
    return {
      ok: false,
      error: 'Không tạo được album — bạn không phải giáo viên chủ nhiệm của lớp này.',
      values,
    };

  revalidatePath('/[locale]/gallery', 'page');
  return {ok: true, message: `Đã tạo album “${title}”. Bấm vào album để tải ảnh lên.`};
}

// Xoá MỘT ảnh.
//
// THỨ TỰ QUAN TRỌNG: xoá HÀNG class_photos trước, xoá TỆP sau. Policy đọc của Storage
// (can_read_class_photo) tra ngược từ tên tệp về hàng class_photos — mất hàng là ảnh hết đọc được
// NGAY, kể cả khi bước xoá tệp bên dưới hỏng giữa chừng. Làm ngược lại thì có một khoảng thời gian
// tệp đã mất nhưng hàng còn, ảnh vỡ mà quyền vẫn mở. Hỏng theo hướng ĐÓNG, đúng tinh thần 0063.
export async function deletePhoto(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  const albumId = String(formData.get('album_id') ?? '');
  const photoId = String(formData.get('photo_id') ?? '');
  if (!classId || !albumId || !photoId) galleryFlash(classId, albumId || null, 'Thiếu thông tin');

  const supabase = await createClient();
  const {data, error} = await supabase
    .from('class_photos')
    .delete()
    .eq('id', photoId)
    .select('storage_path');

  if (error) {
    revalidatePath('/[locale]/gallery', 'page');
    galleryFlash(classId, albumId, loi(friendlyError(error)));
  }
  if (!data || data.length === 0) {
    revalidatePath('/[locale]/gallery', 'page');
    galleryFlash(
      classId,
      albumId,
      'Không xoá được — ảnh không còn, hoặc bạn không có quyền với lớp này.',
    );
  }

  // Dọn tệp. Lỗi ở bước này KHÔNG làm thao tác thất bại: ảnh đã hết đọc được rồi, phần còn lại
  // chỉ là chỗ trống trong bucket.
  await supabase.storage.from('class-photos').remove([data[0].storage_path]);
  revalidatePath('/[locale]/gallery', 'page');
  galleryFlash(classId, albumId, 'Đã xoá ảnh');
}

// Xoá cả album. class_photos có `on delete cascade` nên các HÀNG ảnh tự đi theo — nhưng TỆP trong
// bucket thì không, Postgres không với tới Storage. Phải lấy danh sách đường dẫn TRƯỚC khi xoá
// album, nếu không là mất dấu vĩnh viễn và bucket đầy ảnh mồ côi không ai gỡ được.
export async function deleteAlbum(formData: FormData) {
  await requireRole(['teacher', 'admin']);
  const classId = String(formData.get('class_id') ?? '');
  const albumId = String(formData.get('album_id') ?? '');
  if (!classId || !albumId) galleryFlash(classId, null, 'Thiếu thông tin');

  const supabase = await createClient();
  const {data: photos} = await supabase
    .from('class_photos')
    .select('storage_path')
    .eq('album_id', albumId);

  const {data, error} = await supabase
    .from('class_albums')
    .delete()
    .eq('id', albumId)
    .select('title');

  if (error) {
    revalidatePath('/[locale]/gallery', 'page');
    galleryFlash(classId, albumId, loi(friendlyError(error)));
  }
  if (!data || data.length === 0) {
    revalidatePath('/[locale]/gallery', 'page');
    galleryFlash(
      classId,
      albumId,
      'Không xoá được — album không còn, hoặc bạn không phải giáo viên chủ nhiệm của lớp này.',
    );
  }

  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length > 0) await supabase.storage.from('class-photos').remove(paths);

  revalidatePath('/[locale]/gallery', 'page');
  // Về danh sách album (album vừa xoá không còn để mở).
  galleryFlash(classId, null, `Đã xoá album “${data[0].title}” cùng ${paths.length} ảnh`);
}
