import {UtensilsCrossed} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {getCurrentProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getMyClass} from '@/lib/queries';
import {todayInVN} from '@/lib/dates';
import {MEAL_SLOTS, MEAL_LABEL, ngayVN, type MealSlot} from './MealMeta';

// Thẻ "thực đơn hôm nay" — bản GỌN của trang /menu, để nhúng vào trang phụ huynh và trang học
// sinh. Tự lo lấy dữ liệu (server component) nên nơi nhúng chỉ cần viết <TodayMenuCard />.
//
// `campusId` là tuỳ chọn: truyền vào nếu trang cha ĐÃ biết cơ sở (tiết kiệm một vòng mạng);
// không truyền thì thẻ tự suy ra.
//
// TỰ SUY RA CƠ SỞ NHƯ THẾ NÀO — và vì sao không đọc thẳng profiles.campus_id:
// 0062 đã chứng minh cột đó thường NULL với phụ huynh (luồng mời phụ huynh đi qua
// parent_invitations, không qua pending_user_grants nên handle_new_user không gán campus_id).
// Mà phụ huynh chính là người xin tính năng này. Nên: có campus_id thì dùng, không thì suy từ
// lớp của con (getMyClass đã xử lý đủ mọi vai).
export async function TodayMenuCard({campusId}: {campusId?: string}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  let cid = campusId ?? profile.campus_id ?? null;
  if (!cid) {
    const cls = await getMyClass(supabase, profile);
    cid = cls?.campus_id ?? null;
  }
  // Không xác định được cơ sở thì KHÔNG có gì đúng để hiện — thà không hiện thẻ còn hơn hiện một
  // thực đơn của cơ sở khác.
  if (!cid) return null;

  // todayInVN() chứ không new Date(): máy chủ chạy UTC, khung 00:00–07:00 giờ VN sẽ lấy nhầm
  // thực đơn của HÔM QUA — đúng khung giờ phụ huynh mở app trước khi đưa con đi học.
  const hom_nay = todayInVN();
  const {data} = await supabase
    .from('meal_menus')
    .select('meal, items, note')
    .eq('campus_id', cid)
    .eq('date', hom_nay);

  const byMeal = new Map((data ?? []).map((r) => [r.meal as MealSlot, r]));
  const co = MEAL_SLOTS.filter((s) => byMeal.has(s));

  return (
    <div className="glass rounded-[20px] p-[18px]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-navy">
          <UtensilsCrossed size={15} strokeWidth={2.2} className="text-grey-mid" />
          Thực đơn hôm nay
        </span>
        <span className="rounded-full bg-navy/[0.08] px-2 py-0.5 text-[10.5px] font-extrabold">
          {ngayVN(hom_nay)}
        </span>
      </div>

      {/* Chưa nhập thì nói thẳng là CHƯA NHẬP, không ẩn thẻ đi. 0062 cảnh báo đúng chỗ này: khi
          màn hình trống, người dùng không báo "sai quyền" mà báo "app hỏng" — nên phải phân biệt
          rõ "nhà trường chưa cập nhật" với "app lỗi". */}
      {co.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-grey-mid">
          Nhà trường chưa cập nhật thực đơn hôm nay.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {co.map((s) => {
            const r = byMeal.get(s)!;
            return (
              <div key={s} className="flex gap-2">
                <span className="w-[62px] shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                  {MEAL_LABEL[s]}
                </span>
                <div className="min-w-0 flex-1">
                  {/* items lưu dạng văn bản mỗi món một dòng (0062) → phải giữ xuống dòng */}
                  <p className="whitespace-pre-line break-words text-[12.5px] font-semibold leading-[1.5] text-navy">
                    {r.items}
                  </p>
                  {r.note && (
                    <p className="mt-0.5 text-[11px] italic text-grey-mid">{r.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/menu"
        className="mt-2 inline-block text-[11.5px] font-extrabold text-gold-deep underline underline-offset-2"
      >
        Xem thực đơn cả tuần
      </Link>
    </div>
  );
}
