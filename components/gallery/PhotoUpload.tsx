'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ImageUp, Loader2, AlertCircle} from 'lucide-react';
import {useRouter} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/client';
import {Field, inputCls} from '@/components/ui/Field';
import {thuNhoAnh, tenTepSauNen, CO_ANH_ALBUM} from '@/lib/anh';

// Khớp ĐÚNG cấu hình bucket trong 0063. Chặn ở client không phải để bảo mật (client là thứ dễ sửa
// nhất trong hệ thống) mà để GVCN biết ngay tấm nào không hợp lệ, thay vì chờ tải xong 8 MB rồi
// nhận một lỗi tiếng Anh từ Storage.
const GIOI_HAN_BYTE = 10 * 1024 * 1024;
const KIEU_CHO_PHEP = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// Tải ảnh vào album. Khác ClassCoverUpload ở hai điểm SỐNG CÒN:
//  1. Bucket 'class-photos' RIÊNG TƯ → không có getPublicUrl, không lưu URL vào bảng nào. Chỉ lưu
//     ĐƯỜNG DẪN; trang album tự ký URL mỗi lần dựng.
//  2. Đường dẫn BẮT BUỘC '<class_id>/<album_id>/<tệp>'. DB có check constraint chặn dạng sai, và
//     policy ghi của Storage đọc thư mục cấp 1 để biết ảnh thuộc lớp nào. Đặt sai là bị từ chối.
export function PhotoUpload({
  classId,
  albumId,
  uploaderId,
  startOrder,
}: {
  classId: string;
  albumId: string;
  uploaderId: string;
  // Thứ tự bắt đầu = (sort_order lớn nhất trong album) + 1, tính ở SERVER. Ảnh mới xếp sau ảnh cũ
  // thay vì chen lên đầu.
  startOrder: number;
}) {
  const t = useTranslations('gallery');
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [caption, setCaption] = useState('');
  const [tienDo, setTienDo] = useState<{i: number; n: number} | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [xong, setXong] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    setLoi(null);
    setXong(null);
    let dat = 0;
    const hong: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setTienDo({i: i + 1, n: files.length});

      if (file.size > GIOI_HAN_BYTE) {
        hong.push(t('errTooBig', {file: file.name}));
        continue;
      }
      if (file.type && !KIEU_CHO_PHEP.includes(file.type)) {
        hong.push(t('errNotImage', {file: file.name}));
        continue;
      }

      // Thu nhỏ + nén NGAY TRÊN MÁY NGƯỜI GỬI trước khi tải lên.
      //
      // Không có bước này thì một album 12 ảnh × 4 MB là 48 MB, mà chỗ hiện chúng chỉ là 12 ô
      // thumbnail nhỏ trong lưới. Mỗi phụ huynh mở album phải kéo về ngần ấy, qua đúng đường
      // truyền vốn đã chậm — và họ mở đi mở lại. Người gửi chỉ chờ thêm vài trăm mili giây.
      const nho = await thuNhoAnh(file, CO_ANH_ALBUM);
      const daNen = nho !== file;

      // Tên tệp: bỏ dấu tiếng Việt và ký tự lạ (Storage chỉ nhận một tập ký tự hẹp), thêm mốc thời
      // gian + số thứ tự vì storage_path là UNIQUE — tải hai lần cùng một tấm sẽ đụng khoá.
      const tenSach = tenTepSauNen(file.name, daNen).slice(-60);
      const path = `${classId}/${albumId}/${Date.now()}-${i}-${tenSach}`;

      // Ảnh chụp bằng iPhone: nhiều trình duyệt trả file.type RỖNG cho .heic. Để trống thì Storage
      // gán application/octet-stream, mà bucket chỉ nhận 4 kiểu ảnh (0063) → bị từ chối, GVCN chỉ
      // thấy "không tải lên được" mà không hiểu vì sao. Suy kiểu từ đuôi tệp cho đúng trường hợp này.
      // Nén được thì kiểu luôn là image/webp — bucket có nhận webp (0063).
      const kieu = daNen
        ? 'image/webp'
        : file.type || (/\.heic$/i.test(file.name) ? 'image/heic' : undefined);

      const {error: upErr} = await supabase.storage
        .from('class-photos')
        .upload(path, nho, {upsert: false, contentType: kieu});
      if (upErr) {
        hong.push(t('errUpload', {file: file.name}));
        continue;
      }

      const {error: dbErr} = await supabase.from('class_photos').insert({
        album_id: albumId,
        storage_path: path,
        caption: caption.trim() || null,
        sort_order: startOrder + i,
        uploaded_by: uploaderId,
      });
      if (dbErr) {
        // Tệp đã lên mà HÀNG không ghi được = tệp mồ côi: không ai đọc được (policy đọc tra ngược
        // về hàng class_photos) nhưng vẫn chiếm chỗ trong bucket và không còn đường nào gỡ qua
        // giao diện. Dọn ngay tại đây.
        await supabase.storage.from('class-photos').remove([path]);
        hong.push(t('errSave', {file: file.name}));
        continue;
      }
      dat++;
    }

    setTienDo(null);
    // Xoá giá trị input để chọn LẠI đúng tệp đó vẫn kích hoạt onChange (trình duyệt không bắn
    // sự kiện khi giá trị không đổi).
    input.value = '';
    if (hong.length > 0) setLoi(t('skipped', {n: hong.length, list: hong.join(', ')}));
    if (dat > 0) {
      setXong(t('uploaded', {n: dat}));
      setCaption('');
      router.refresh();
    }
  }

  const dangTai = tienDo !== null;

  return (
    <div className="glass rounded-[16px] p-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1.6fr_auto]">
        <Field
          label={t('fCaption')}
          htmlFor="photo-caption"
          hint={t('hCaption')}
        >
          <input
            id="photo-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={dangTai}
            placeholder={t('phCaption')}
            className={inputCls}
          />
        </Field>

        <div className="flex items-end">
          <label className="ctl-h inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-navy/[0.02] px-4 text-[13px] font-extrabold text-navy transition-all focus-within:border-navy focus-within:ring-1 focus-within:ring-navy/20 hover:border-navy hover:bg-white">
            <input
              type="file"
              multiple
              aria-label={t('pickPhotosAria')}
              accept="image/jpeg,image/png,image/webp,image/heic,.heic"
              className="hidden"
              onChange={onChange}
              disabled={dangTai}
            />
            {dangTai ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} strokeWidth={2.2} />}
            {dangTai ? t('uploading', {i: tienDo.i, n: tienDo.n}) : t('pickPhotos')}
          </label>
        </div>
      </div>

      <p className="mt-2 text-[11px] italic text-grey-mid">
        {t('uploadHint')}
      </p>

      {loi && (
        <p className="mt-2 inline-flex items-start gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" />
          {loi}
        </p>
      )}
      {xong && <p className="mt-2 text-[13px] font-bold text-success-dark">{xong}</p>}
    </div>
  );
}
