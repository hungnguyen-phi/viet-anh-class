import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft, CalendarDays, Images} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getClassContext} from '@/lib/queries';
import {todayInVN} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {FlashToast} from '@/components/ui/FlashToast';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {PhotoImg} from '@/components/gallery/PhotoImg';
import {PhotoUpload} from '@/components/gallery/PhotoUpload';
import {AlbumForm} from './AlbumForm';
import {deleteAlbum, deletePhoto} from './actions';

type SB = Awaited<ReturnType<typeof createClient>>;

// Postgres trả yyyy-mm-dd; trường học Việt Nam đọc ngày/tháng/năm (giống helper cùng tên ở /roster).
function ngayVN(iso: string): string {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// HẠN CỦA SIGNED URL — 30 phút, cố ý ngắn hơn mức "1 giờ là hợp lý" mà 0063 gợi ý.
//
// Vì sao ngắn: signed URL là VÉ VÀO CỬA, không phải thẻ tên. Ai cầm được đường dẫn đều mở được ảnh
// cho tới khi hết hạn — kể cả người chưa đăng nhập, kể cả sau khi GVCN đã xoá ảnh khỏi app. RLS
// không đi theo cái link. Một phụ huynh chuyển tiếp vào nhóm Zalo là ảnh khuôn mặt trẻ ra khỏi
// vành đai, và cửa sổ đó dài đúng bằng TTL. 30 phút vẫn đủ dài cho một lượt xem album bình thường,
// và PhotoImg đã bắt onError để ký lại khi trang mở lâu hơn thế.
const KY_URL_GIAY = 30 * 60;

// Ký cả loạt trong MỘT lượt gọi. 0063 nói rõ: dùng createSignedUrls (số nhiều), không thì album 60
// ảnh là 60 vòng mạng. Mảng rỗng thì bỏ hẳn lượt gọi — nó vẫn tốn một chặng mạng vô ích.
async function kyAnh(supabase: SB, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const {data} = await supabase.storage.from('class-photos').createSignedUrls(paths, KY_URL_GIAY);
  for (const r of data ?? []) if (r.path && r.signedUrl) out.set(r.path, r.signedUrl);
  return out;
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; album?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, album: albumParam, flash} = await searchParams;
  setRequestLocale(locale);
  // Mọi vai đăng nhập đều vào được trang; RLS quyết ai thấy album nào (HS trong lớp, PH có con
  // trong lớp, GVCN lớp đó, BGH cơ sở, admin). GVCN lớp KHÁC không nằm trong danh sách đó nên
  // getAccessibleClasses cũng không đưa lớp ấy ra cho họ chọn.
  const profile = await requireProfile();
  const tc = await getTranslations('class');
  const t = await getTranslations('gallery');
  const supabase = await createClient();

  const {myClass, classes: accessible} = await getClassContext(supabase, profile, classParam);

  if (!myClass) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">{tc('noClass')}</p>
      </div>
    );
  }

  // Đúng bằng staff_can_manage_class trong 0063: GVCN của CHÍNH lớp này, hoặc admin.
  // Hiệu trưởng cố ý KHÔNG có quyền đăng/xoá — đọc được nhưng người chịu trách nhiệm về ảnh trẻ
  // trong lớp là giáo viên chủ nhiệm.
  const canManage = profile.role === 'admin' || myClass.homeroom_teacher_id === profile.id;
  const chiXem = profile.role === 'principal';

  const {data: albumRows} = await supabase
    .from('class_albums')
    .select('id, title, event_date, description')
    .eq('class_id', myClass.id)
    .order('event_date', {ascending: false});
  const albums = albumRows ?? [];

  const openAlbum = albumParam ? albums.find((a) => a.id === albumParam) ?? null : null;

  const tieuDe = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-[22px] font-bold text-navy">{t('title', {class: myClass.name})}</h1>
      {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
    </div>
  );

  // ══ Mở MỘT album ═════════════════════════════════════════════════════════
  if (openAlbum) {
    const {data: photoRows} = await supabase
      .from('class_photos')
      .select('id, storage_path, caption, sort_order')
      .eq('album_id', openAlbum.id)
      .order('sort_order')
      .order('created_at');
    const photos = photoRows ?? [];

    const urls = await kyAnh(
      supabase,
      photos.map((p) => p.storage_path),
    );
    const startOrder = photos.length
      ? Math.max(...photos.map((p) => p.sort_order)) + 1
      : 0;

    return (
      <div className="flex flex-col gap-4">
        {tieuDe}
        {flash && <FlashToast message={flash} />}

        <div className="glass rounded-[20px] p-4">
          <Link
            href={{pathname: '/gallery', query: classParam ? {class: classParam} : {}}}
            className="mb-2 inline-flex items-center gap-1 text-[11.5px] font-extrabold text-gold-text underline underline-offset-2"
          >
            <ArrowLeft size={12} strokeWidth={3} />
            {t('allAlbums')}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[17px] font-bold text-navy">{openAlbum.title}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-navy/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold">
              <CalendarDays size={11} strokeWidth={2.5} />
              {ngayVN(openAlbum.event_date)}
            </span>
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-navy">
              {t('photoCount', {n: photos.length})}
            </span>
            {canManage && (
              <form action={deleteAlbum} className="ml-auto">
                <input type="hidden" name="class_id" value={myClass.id} />
                <input type="hidden" name="album_id" value={openAlbum.id} />
                <ConfirmButton
                  message={t('confirmDeleteAlbum', {title: openAlbum.title, n: photos.length})}
                  className="cursor-pointer rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-2 py-1 text-[11px] font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.16]"
                >
                  {t('deleteAlbum')}
                </ConfirmButton>
              </form>
            )}
          </div>

          {openAlbum.description && (
            <p className="mt-1.5 text-[12.5px] font-semibold leading-[1.55] text-grey-mid">
              {openAlbum.description}
            </p>
          )}
        </div>

        {canManage && (
          <PhotoUpload
            classId={myClass.id}
            albumId={openAlbum.id}
            uploaderId={profile.id}
            startOrder={startOrder}
          />
        )}

        {photos.length === 0 ? (
          <div className="glass rounded-[20px] p-8 text-center">
            <p className="text-sm text-grey-mid">
              {canManage
                ? t('emptyAlbumManage')
                : t('emptyAlbum')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => {
              const url = urls.get(p.storage_path);
              // Mô tả ảnh: ưu tiên chú thích GVCN đã ghi; không có thì mô tả theo album + ngày +
              // lớp. Cố ý KHÔNG mô tả người trong ảnh — ảnh trẻ em, không suy đoán danh tính.
              const alt =
                p.caption ??
                t('photoAlt', {album: openAlbum.title, class: myClass.name, date: ngayVN(openAlbum.event_date)});
              return (
                <figure
                  key={p.id}
                  className="glass glass-hover overflow-hidden rounded-[18px] p-2"
                >
                  {url ? (
                    <PhotoImg
                      src={url}
                      alt={alt}
                      className="aspect-square w-full rounded-[12px] object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-[12px] bg-navy/[0.06] text-[11px] font-bold text-grey-mid">
                      {t('photoBroken')}
                    </div>
                  )}
                  {p.caption && (
                    <figcaption className="mt-1.5 line-clamp-2 px-0.5 text-[11.5px] font-semibold text-grey-mid">
                      {p.caption}
                    </figcaption>
                  )}
                  {canManage && (
                    <form action={deletePhoto} className="mt-1.5 flex justify-end">
                      <input type="hidden" name="class_id" value={myClass.id} />
                      <input type="hidden" name="album_id" value={openAlbum.id} />
                      <input type="hidden" name="photo_id" value={p.id} />
                      <ConfirmButton
                        message={t('confirmDeletePhoto')}
                        label={t('deletePhoto')}
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                      >
                        ✕
                      </ConfirmButton>
                    </form>
                  )}
                </figure>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ══ Danh sách album ══════════════════════════════════════════════════════
  // Lấy hai cột ngắn của MỌI ảnh trong lớp để vừa đếm số ảnh vừa chọn ảnh bìa (tấm đầu theo thứ
  // tự GVCN đã xếp) mà không phải một truy vấn cho mỗi album. Chỉ KÝ URL cho ảnh bìa — vài chục
  // album cũng chỉ là một lượt ký.
  const albumIds = albums.map((a) => a.id);
  const {data: photoLite} = albumIds.length
    ? await supabase
        .from('class_photos')
        .select('album_id, storage_path')
        .in('album_id', albumIds)
        .order('album_id')
        .order('sort_order')
        .limit(1000)
    : {data: []};

  const biaCua = new Map<string, string>();
  const soAnh = new Map<string, number>();
  for (const r of photoLite ?? []) {
    soAnh.set(r.album_id, (soAnh.get(r.album_id) ?? 0) + 1);
    if (!biaCua.has(r.album_id)) biaCua.set(r.album_id, r.storage_path);
  }
  const urls = await kyAnh(supabase, [...biaCua.values()]);

  return (
    <div className="flex flex-col gap-4">
      {tieuDe}
      {flash && <FlashToast message={flash} />}

      <p className="text-[12px] font-semibold leading-[1.55] text-grey-mid">
        {canManage
          ? t('privacyManage')
          : chiXem
            ? t('privacyPrincipal')
            : t('privacyFamily')}
      </p>

      {canManage && <AlbumForm classId={myClass.id} today={todayInVN()} />}

      {albums.length === 0 ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            {canManage
              ? t('noAlbumsManage')
              : t('noAlbums')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => {
            const bia = biaCua.get(a.id);
            const url = bia ? urls.get(bia) : undefined;
            const n = soAnh.get(a.id) ?? 0;
            return (
              <Link
                key={a.id}
                href={{
                  pathname: '/gallery',
                  query: {...(classParam ? {class: classParam} : {}), album: a.id},
                }}
                className="glass glass-hover overflow-hidden rounded-[18px] p-3"
              >
                {url ? (
                  <PhotoImg
                    src={url}
                    alt={t('coverAlt', {album: a.title, class: myClass.name})}
                    className="aspect-[4/3] w-full rounded-[12px] object-cover"
                  />
                ) : (
                  <div className="grid aspect-[4/3] w-full place-items-center rounded-[12px] bg-navy/[0.06] text-navy/40">
                    <Images size={22} strokeWidth={2} />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-display text-[15px] font-bold text-navy">
                    {a.title}
                  </span>
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-navy">
                    {t('photoCount', {n})}
                  </span>
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-grey-mid">
                  <CalendarDays size={11} strokeWidth={2.5} />
                  {ngayVN(a.event_date)}
                </div>
                {a.description && (
                  <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-[1.5] text-grey-mid">
                    {a.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
