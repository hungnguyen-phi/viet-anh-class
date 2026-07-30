import {SubmitButton} from '@/components/ui/SubmitButton';
import {labelCls, selectCls, btnGold} from '@/components/ui/Field';
import {openThread} from './actions';

export type OpenOption = {id: string; name: string};

/**
 * Mở cuộc trao đổi mới.
 *
 * Một ô chọn + một nút, KHÔNG có validation inline nên dùng server action trần + flash redirect
 * (đúng mẫu của dự án cho form không cần giữ giá trị đã gõ).
 *
 * Khi chỉ có MỘT lựa chọn thì bỏ hẳn ô chọn: bắt người ta bấm vào một danh sách một dòng để chọn
 * đúng cái đang hiện sẵn là bước thừa. Lúc đó học sinh đi theo input ẩn, nút nói rõ tên em.
 */
export function OpenThreadForm({
  options,
  label,
  hint,
  nutMotLuaChon,
  nutNhieuLuaChon,
}: {
  options: OpenOption[];
  label: string;
  hint?: string;
  // Chữ trên nút khi chỉ có một em (nhận tên em) và khi có nhiều em.
  nutMotLuaChon: (ten: string) => string;
  nutNhieuLuaChon: string;
}) {
  if (options.length === 0) return null;
  const motNguoi = options.length === 1 ? options[0] : null;

  return (
    <form action={openThread} className="glass rounded-[16px] p-3">
      {motNguoi ? (
        <>
          <input type="hidden" name="student_id" value={motNguoi.id} />
          <p className="mb-2 text-[13px] font-bold text-navy">{label}</p>
          <SubmitButton className={btnGold} wrapClass="contents">
            {nutMotLuaChon(motNguoi.name)}
          </SubmitButton>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[220px] flex-1">
            <label className={labelCls} htmlFor="pt-open-student">
              {label}
            </label>
            {/* required + option rỗng disabled: trình duyệt chặn ngay khi chưa chọn ai, khỏi
                phải đi một vòng lên máy chủ chỉ để nhận về "Chưa chọn học sinh". */}
            <select
              id="pt-open-student"
              name="student_id"
              className={selectCls}
              defaultValue=""
              required
            >
              <option value="" disabled>
                — Chọn học sinh —
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton className={btnGold} wrapClass="contents">
            {nutNhieuLuaChon}
          </SubmitButton>
        </div>
      )}
      {hint && <p className="mt-2 text-[11px] italic text-grey-mid">{hint}</p>}
    </form>
  );
}
