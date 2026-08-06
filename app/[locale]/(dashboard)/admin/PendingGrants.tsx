import {getTranslations} from 'next-intl/server';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {createClient} from '@/lib/supabase/server';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {cancelParentInvite, cancelUserGrant, updateUserGrant} from './actions';
import {layDanhMuc, layPhuTro} from './admin-data';
import {Disclosure} from './Disclosure';

const VAI_KHAI_DUOC = ['teacher', 'principal', 'admin', 'student', 'parent'] as const;

const oChon =
  'h-8 w-full min-w-0 cursor-pointer rounded-[9px] border-[1.5px] border-navy/15 bg-white px-1.5 text-[12px] font-semibold text-navy outline-none focus:border-navy';
const luuBtn =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[9px] bg-navy px-2 text-[11px] font-extrabold text-white transition-all hover:bg-navy-700';
const ghostBtn =
  'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white/70 px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy';

// ĐÃ KHAI SẴN — CHỜ ĐĂNG NHẬP LẦN ĐẦU.
//
// Đây là danh sách những email đã được gán trước vai trò (và lớp, nếu có), nằm chờ trong
// pending_user_grants. Người đó đăng nhập bằng Google lần đầu là trigger handle_new_user áp vai +
// đưa vào lớp, rồi xoá dòng chờ.
//
// VÌ SAO NÓ PHẢI HIỆN RA — và vì sao tôi đã sai khi ẩn nó đi:
// Ban đầu mục này mang tên "Lời mời đang chờ", tôi ẩn vì hệ thống KHÔNG gửi email nào cả, nên
// chữ "lời mời" hứa một việc không xảy ra. Nhưng ẩn hẳn thì mất luôn thông tin thật và cần: khai
// xong ba mươi ba email rồi không có chỗ nào xem lại đã khai những ai, vai gì, lớp nào. Cách đúng
// là gọi tên cho trúng, không phải giấu đi.
//
// Nên tiêu đề nói thẳng "chờ họ đăng nhập lần đầu", và có một câu nhắc rằng hệ thống không gửi
// mail — người khai phải tự báo cho họ.
export async function PendingGrants() {
  const t = await getTranslations('admin');
  const tr = await getTranslations('roles');
  const supabase = await createClient();

  // layPhuTro/layDanhMuc đã được các mảnh khác của trang gọi và bọc cache() — dùng lại đúng kết
  // quả ấy, không thêm vòng đi-về nào ra Supabase.
  const [{grants, invites}, {allClasses}] = await Promise.all([layPhuTro(), layDanhMuc()]);

  // Tên học sinh cho lời mời phụ huynh: chỉ hỏi khi THẬT SỰ có lời mời đang chờ.
  const dangCho = invites.filter((i) => i.status === 'pending');
  const idHocSinh = [...new Set(dangCho.map((i) => i.student_id).filter(Boolean))] as string[];
  const tenHocSinh = new Map<string, string>();
  if (idHocSinh.length > 0) {
    const {data} = await supabase.from('profiles').select('id, full_name, email').in('id', idHocSinh);
    for (const p of data ?? []) tenHocSinh.set(p.id, p.full_name ?? p.email);
  }

  const className = new Map(allClasses.map((c) => [c.id, c.name]));
  const lopDangDung = allClasses.filter((c) => c.is_active).map((c) => ({id: c.id, name: c.name}));
  const tong = grants.length + dangCho.length;
  if (tong === 0) return null;

  const ngay = (s: string | null) => (s ? String(s).slice(0, 10) : '');

  return (
    <Disclosure title={t('grantsTitle')} hint={t('grantsHint')} count={tong}>
      {/* role="row" phải nằm TRONG một role="table"/"grid" thì trình đọc màn hình mới hiểu; đứng
          trơ một mình là ARIA không hợp lệ và bị bỏ qua. Khai đủ bộ như bảng người dùng. */}
      <div className="overflow-x-auto rounded-[14px] border-[1.5px] border-navy/10">
        <div role="table" aria-label={t('grantsTitle')}>
        <div
          role="row"
          className="box-border flex min-w-[620px] items-center gap-2 bg-navy/[0.03] px-[14px] py-[9px]"
        >
          <span role="columnheader" className="flex-[1.6] text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
            {t('email')}
          </span>
          <span role="columnheader" className="flex-[2] text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
            {t('role')} · {t('classes')}
          </span>
          <span role="columnheader" className="w-[92px] flex-none text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
            {t('grantedOn')}
          </span>
          <span className="w-[72px] flex-none" aria-hidden />
        </div>

        {grants.map((g) => (
          <div
            key={`g-${g.email}`}
            role="row"
            className="box-border flex min-w-[620px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2"
          >
            <span className="min-w-0 flex-[1.6] truncate text-[13px] font-bold text-navy">{g.email}</span>
            {/* SỬA ĐƯỢC NGAY TẠI DÒNG.
                Khai báo mới chỉ là một dòng chờ — chưa có tài khoản nào tồn tại — nên sửa nó không
                đụng tới ai. Trước đây dòng này chỉ có nút Huỷ, nên khai nhầm vai là phải huỷ rồi
                gõ lại email; với ba mươi ba dòng thì đó là ba mươi ba lần gõ lại. */}
            <form action={updateUserGrant} className="flex flex-[2] items-center gap-1.5" id={`sua-${g.email}`}>
              <input type="hidden" name="email" value={g.email} />
              <select
                name="role"
                defaultValue={g.role}
                aria-label={t('grantRoleFor', {name: g.email})}
                className={`${oChon} flex-1`}
              >
                {VAI_KHAI_DUOC.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
              <select
                name="class_id"
                defaultValue={g.class_id ?? ''}
                aria-label={t('classFor', {name: g.email})}
                className={`${oChon} flex-1`}
              >
                <option value="">{t('classNone')}</option>
                {lopDangDung.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {/* Lớp đã xoá/lưu trữ mà dòng này còn trỏ vào: giữ lại trong danh sách, nếu không
                    <select> tự nhảy về "không gắn lớp" và bấm Lưu là âm thầm mất lớp. */}
                {g.class_id && !lopDangDung.some((c) => c.id === g.class_id) && (
                  <option value={g.class_id}>{className.get(g.class_id) ?? t('classGone')}</option>
                )}
              </select>
              <SubmitButton className={luuBtn} wrapClass="contents" label={t('saveGrantFor', {name: g.email})}>
                {t('save')}
              </SubmitButton>
            </form>
            <span className="w-[92px] flex-none whitespace-nowrap text-[11.5px] font-semibold text-grey-mid">
              {ngay(g.created_at)}
            </span>
            <span className="w-[72px] flex-none">
              <form action={cancelUserGrant}>
                <input type="hidden" name="email" value={g.email} />
                <ConfirmButton
                  message={t('confirmCancelGrant', {email: g.email})}
                  label={t('cancelGrantFor', {email: g.email})}
                  className={ghostBtn}
                >
                  {t('cancelGrant')}
                </ConfirmButton>
              </form>
            </span>
          </div>
        ))}

        {dangCho.map((i) => (
          <div
            key={`p-${i.email}`}
            role="row"
            className="box-border flex min-w-[620px] items-center gap-2 border-t border-navy/[0.08] px-[14px] py-2"
          >
            <span className="min-w-0 flex-[1.6] truncate text-[13px] font-bold text-navy">{i.email}</span>
            <span className="flex-1 whitespace-nowrap text-[12.5px] font-semibold text-navy">
              {tr('parent')}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-grey-mid">
              {/* Phụ huynh gắn với CON, không gắn với lớp — nên cột này hiện tên con. */}
              {i.student_id ? (tenHocSinh.get(i.student_id) ?? t('classGone')) : t('classNone')}
            </span>
            <span className="w-[92px] flex-none" />
            <span className="w-[72px] flex-none">
              <form action={cancelParentInvite}>
                <input type="hidden" name="email" value={i.email} />
                <ConfirmButton
                  message={t('confirmCancelGrant', {email: i.email})}
                  label={t('cancelGrantFor', {email: i.email})}
                  className={ghostBtn}
                >
                  {t('cancelGrant')}
                </ConfirmButton>
              </form>
            </span>
          </div>
        ))}
        </div>
      </div>

      {/* Nói thẳng giới hạn, ngay dưới bảng. Không nói thì người khai ngồi đợi một email mà hệ
          thống chưa bao giờ gửi — đúng thứ đã xảy ra. */}
      <p className="mt-2.5 rounded-[10px] bg-warn/[0.10] px-3 py-2 text-[12px] font-semibold leading-relaxed text-navy">
        {t('grantsNoMailWarning')}
      </p>
    </Disclosure>
  );
}
