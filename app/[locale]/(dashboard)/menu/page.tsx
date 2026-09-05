import {getTranslations, setRequestLocale} from 'next-intl/server';
import {CalendarDays, UtensilsCrossed} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getMyClass} from '@/lib/queries';
import {todayInVN, weekRangeVN} from '@/lib/dates';
import {Flash} from '@/components/ui/Flash';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {Field, selectInline, inputInline, btnGold} from '@/components/ui/Field';
import {CampusPicker} from '@/components/menu/CampusPicker';
import {
  DAY_KEYS,
  MEAL_SLOTS,
  isMealSlot,
  ngayVN,
  type MealSlot,
} from '@/components/menu/MealMeta';
import {saveMenu, deleteMenu} from './actions';

// Ô nhập nhiều dòng: KHÔNG dùng được `ctl-h` (cao cứng 44px) vì thực đơn một bữa thường 3–5 món.
// Giữ nguyên ngôn ngữ hình ảnh của các ô khác (bo 10px, viền 1.5px navy/15, chữ navy đậm).
const textareaCls =
  'w-full rounded-[8px] border-[1.5px] border-navy/15 bg-white px-3 py-2.5 text-sm font-semibold leading-[1.55] text-navy outline-none transition-colors focus:border-navy';

// Nút "Sửa" nhỏ trong ô lưới — y hệt editLinkCls của /wig.
const suaCls =
  'cursor-pointer rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-nhan font-extrabold text-navy transition-all hover:border-navy';

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    campus?: string;
    week?: string;
    date?: string;
    meal?: string;
    day?: string;
  }>;
}) {
  const {locale} = await params;
  const {
    campus: campusParam,
    week: weekParam,
    date: dateParam,
    meal: mealParam,
    day: dayParam,
  } = await searchParams;
  setRequestLocale(locale);
  // Mọi vai đăng nhập đều XEM được thực đơn cơ sở mình (policy rls_select_meal_menus) — kể cả
  // học sinh và phụ huynh, vốn là nhóm xin tính năng này.
  const profile = await requireProfile();
  const t = await getTranslations('menu');
  const supabase = await createClient();

  const isAdmin = profile.role === 'admin';
  // Quyền NHẬP lấy đúng theo rls_all_meal_menus (0062): admin + hiệu trưởng. Giáo viên chỉ xem.
  const canManage = isAdmin || profile.role === 'principal';

  // ===== Cơ sở đang xem =====
  // KHÔNG đọc thẳng profiles.campus_id cho mọi vai. 0062 giải thích dài: cột đó thường NULL với
  // phụ huynh (luồng mời phụ huynh đi qua parent_invitations chứ không qua pending_user_grants,
  // nên handle_new_user không gán campus_id), và NULL = NULL trong SQL cho ra NULL → thực đơn
  // hiện trống đúng với nhóm người xin tính năng. Thiếu thì suy ra từ lớp (của mình / của con).
  //
  // Hai truy vấn độc lập → chạy song song, tránh waterfall. Người đã có campus_id trong hồ sơ thì
  // bỏ hẳn lượt hỏi lớp (nhân sự chiếm phần lớn lượt mở trang này).
  const [myClass, {data: campusRows}] = await Promise.all([
    profile.campus_id ? Promise.resolve(null) : getMyClass(supabase, profile),
    supabase.from('campuses').select('id, name').eq('is_active', true).order('name'),
  ]);
  const campuses = campusRows ?? [];
  const myCampusId = profile.campus_id ?? myClass?.campus_id ?? null;

  // Chỉ quản trị viên mới đổi được cơ sở đang xem. Vai khác đổi cũng vô ích — RLS chỉ trả về thực
  // đơn cơ sở của họ — mà bày ra một ô chọn bấm vào chỉ thấy trang trống thì tệ hơn không bày.
  const campusId = isAdmin
    ? campusParam && campuses.some((c) => c.id === campusParam)
      ? campusParam
      : myCampusId ?? campuses[0]?.id ?? null
    : myCampusId;

  if (!campusId) {
    return (
      <div className="glass rounded-[20px] p-8 text-center">
        <p className="text-sm text-grey-mid">
          {t('noCampus')}
        </p>
      </div>
    );
  }

  const campusName = campuses.find((c) => c.id === campusId)?.name ?? '';

  // ===== Tuần đang xem =====
  // Cùng lối làm với /timetable: ?week=YYYY-MM-DD (bất kỳ ngày nào trong tuần đó), mặc định tuần
  // hiện tại theo giờ VN. todayInVN() chứ không new Date() — máy chủ chạy UTC, lệch 7 tiếng.
  const today = todayInVN();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? '') ? weekParam! : today;
  const {start: weekStart} = weekRangeVN(new Date(`${anchor}T00:00:00Z`));
  const dichNgay = (soNgay: number) => {
    const d = new Date(`${weekStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + soNgay);
    return d.toISOString().slice(0, 10);
  };
  // 7 cột (T2→CN), khác /timetable chỉ có T2–T7: học sinh nội trú ăn ở trường cả cuối tuần.
  const weekDates = DAY_KEYS.map((_, i) => dichNgay(i));
  const rangeLabel = `${ngayVN(weekDates[0])} → ${ngayVN(weekDates[6])}`;

  const {data: rows} = await supabase
    .from('meal_menus')
    .select('date, meal, items, note')
    .eq('campus_id', campusId)
    .gte('date', weekDates[0])
    .lte('date', weekDates[6]);

  const byKey = new Map((rows ?? []).map((r) => [`${r.date}|${r.meal}`, r]));

  // Ô đang sửa (?date=&meal=) — theo đúng lối ?editSlot= của /timetable: điền sẵn panel bên dưới
  // thay vì dựng 28 form inline trên lưới.
  const editingDate = dateParam && weekDates.includes(dateParam) ? dateParam : null;
  const editingMeal = mealParam && isMealSlot(mealParam) ? mealParam : null;
  const editing =
    editingDate && editingMeal ? byKey.get(`${editingDate}|${editingMeal}`) ?? null : null;

  // Mặc định của form khi chưa chọn ô nào: hôm nay nếu hôm nay nằm trong tuần đang xem, không thì
  // ngày đầu tuần. Bữa trưa là bữa hầu như trường nào cũng có.
  const formDate = editingDate ?? (weekDates.includes(today) ? today : weekDates[0]);
  const formMeal: MealSlot = editingMeal ?? 'lunch';
  const ngayXem = dayParam && weekDates.includes(dayParam) ? dayParam : weekDates.includes(today) ? today : weekDates[0];

  // Mọi link nội bộ phải bảo toàn cơ sở + tuần đang xem, nếu không bấm "Sửa" là nhảy về tuần này.
  const q = (extra: Record<string, string> = {}) => ({
    ...(isAdmin ? {campus: campusId} : {}),
    ...(weekParam ? {week: weekParam} : {}),
    ...extra,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-dau font-bold text-navy">
          {campusName ? t('titleAt', {campus: campusName}) : t('title')}
        </h1>
        {isAdmin && <CampusPicker campuses={campuses} current={campusId} />}
      </div>

      <Flash />

      {/* Điều hướng tuần — dùng lại lối làm của /timetable để hai trang thao tác giống nhau */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-than font-bold text-navy">
          <CalendarDays size={14} strokeWidth={2} className="text-grey-mid" />
          {rangeLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {[
            {d: -7, label: t('prevWeek')},
            {d: 0, label: t('thisWeek')},
            {d: 7, label: t('nextWeek')},
          ].map(({d, label}) => (
            <Link
              key={d}
              href={{
                pathname: '/menu',
                query: {
                  ...(isAdmin ? {campus: campusId} : {}),
                  ...(d === 0 ? {} : {week: dichNgay(d)}),
                },
              }}
              className="inline-flex min-h-[44px] items-center rounded-[8px] border-[1.5px] border-navy/15 bg-white/60 px-3 text-chu-thich font-extrabold text-navy transition-colors hover:border-navy"
            >
              {label}
            </Link>
          ))}
        </span>
      </div>

      {/* Tuần chưa có thực đơn → nói thẳng, không bày lưới trống (audit 04/09: em thấy bảng câm). */}
      {(rows ?? []).length === 0 && !canManage && (
        <p className="glass rounded-[16px] px-4 py-3 text-than font-semibold text-grey-mid">{t('trongEm')}</p>
      )}

      {/* < 640px: xem theo NGÀY — lưới 7 cột chỉ hiện 2 cột trên điện thoại mà không có dấu hiệu cuộn.
          Mặc định hôm nay (nếu nằm trong tuần), đổi ngày bằng chip; ?day= để giữ khi bấm. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label={t('homNay')}>
          {weekDates.map((d, i) => (
            <Link
              key={d}
              href={{pathname: '/menu', query: q({day: d})}}
              aria-current={d === ngayXem ? 'date' : undefined}
              className={`inline-flex min-h-[44px] shrink-0 flex-col items-center justify-center rounded-[12px] border-[1.5px] px-3 text-chu-thich font-extrabold ${
                d === ngayXem ? 'border-navy bg-navy text-white' : 'border-navy/15 bg-white/60 text-navy'
              }`}
            >
              {t(`days.${DAY_KEYS[i]}`)}
              <span className={`text-chu-thich font-bold ${d === ngayXem ? 'text-white/80' : d === today ? 'text-gold-text' : 'text-grey-mid'}`}>
                {d.slice(5)}
              </span>
            </Link>
          ))}
        </div>
        <div className="glass flex flex-col gap-2 rounded-[20px] p-3">
          {MEAL_SLOTS.map((meal) => {
            const m = byKey.get(`${ngayXem}|${meal}`);
            return (
              <div key={meal} className="rounded-[12px] border-[1.5px] border-navy/10 bg-white/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{t(`meals.${meal}`)}</span>
                  {canManage && (
                    <Link
                      href={{pathname: '/menu', query: q({date: ngayXem, meal})}}
                      className="inline-flex min-h-[36px] items-center text-chu-thich font-extrabold text-navy underline"
                    >
                      {m ? t('edit') : t('them')}
                    </Link>
                  )}
                </div>
                {m ? (
                  <>
                    <p className="mt-1 whitespace-pre-line break-words text-than font-semibold leading-[1.5] text-navy">{m.items}</p>
                    {m.note && <p className="mt-1 text-chu-thich font-semibold italic text-grey-mid">{m.note}</p>}
                  </>
                ) : (
                  <p className="mt-1 text-chu-thich font-semibold italic text-grey-mid">{t('ngayTrong')}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ≥ 640px: lưới hàng = bữa, cột = thứ (kèm ngày thật của tuần đang xem) */}
      <div className="glass hidden overflow-x-auto rounded-[20px] p-2 sm:block">
        <div className="min-w-[980px]">
          <div className="flex">
            <div className="w-[92px] shrink-0 px-2 py-2 text-nhan font-extrabold uppercase text-grey-mid">
              {t('colMeal')}
            </div>
            {DAY_KEYS.map((dk, i) => (
              <div key={dk} className="flex-1 px-2 py-2 text-center">
                <div className="text-chu-thich font-extrabold text-navy">{t(`days.${dk}`)}</div>
                <div
                  className={`text-chu-thich font-bold ${
                    weekDates[i] === today ? 'text-gold-text' : 'text-grey-mid'
                  }`}
                >
                  {weekDates[i].slice(5)}
                </div>
              </div>
            ))}
          </div>

          {MEAL_SLOTS.map((meal) => (
            <div key={meal} className="flex border-t border-navy/[0.08]">
              <div className="flex w-[92px] shrink-0 items-center px-2 text-chu-thich font-bold text-grey-mid">
                {t(`meals.${meal}`)}
              </div>
              {weekDates.map((d) => {
                const m = byKey.get(`${d}|${meal}`);
                return (
                  <div key={d} className="min-w-0 flex-1 p-1.5">
                    {m ? (
                      <div className="rounded-[8px] border-[1.5px] border-navy/15 bg-white/50 px-2 py-1.5">
                        {/* items lưu văn bản thô, mỗi món một dòng (0062) → giữ nguyên xuống dòng */}
                        <p className="whitespace-pre-line break-words text-chu-thich font-semibold leading-[1.5] text-navy">
                          {m.items}
                        </p>
                        {m.note && (
                          <p className="mt-1 break-words text-chu-thich font-semibold italic text-grey-mid">
                            {m.note}
                          </p>
                        )}
                        {canManage && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Link
                              href={{pathname: '/menu', query: q({date: d, meal})}}
                              className={suaCls}
                            >
                              {t('edit')}
                            </Link>
                            <form action={deleteMenu}>
                              <input type="hidden" name="campus_id" value={campusId} />
                              <input type="hidden" name="week" value={weekParam ?? ''} />
                              <input type="hidden" name="date" value={d} />
                              <input type="hidden" name="meal" value={meal} />
                              <ConfirmButton
                                message={t('confirmDelete', {meal: t(`meals.${meal}`).toLowerCase(), date: ngayVN(d)})}
                                className="cursor-pointer rounded-[8px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-2 py-1 text-chu-thich font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.16]"
                              >
                                {t('delete')}
                              </ConfirmButton>
                            </form>
                          </div>
                        )}
                      </div>
                    ) : canManage ? (
                      <Link
                        href={{pathname: '/menu', query: q({date: d, meal})}}
                        aria-label={t('addAria', {meal: t(`meals.${meal}`).toLowerCase(), date: ngayVN(d)})}
                        className="block rounded-[8px] border-[1.5px] border-dashed border-navy/15 py-2 text-center text-chu-thich font-extrabold text-navy/40 transition-colors hover:border-navy hover:text-navy"
                      >
                        {t('them')}
                      </Link>
                    ) : (
                      <div className="rounded-[8px] py-2 text-center text-chu-thich text-navy/15">·</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Admin / hiệu trưởng: khung soạn một bữa của một ngày */}
      {canManage && (
        <div className="glass rounded-[20px] p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-noi-dung font-bold text-navy">
              <UtensilsCrossed size={14} strokeWidth={2} className="text-grey-mid" />
              {editing
                ? t('editTitle', {meal: t(`meals.${formMeal}`).toLowerCase(), date: ngayVN(formDate)})
                : t('composeTitle')}
            </span>
            {editingDate && (
              <Link
                href={{pathname: '/menu', query: q()}}
                className="inline-flex min-h-[24px] items-center text-chu-thich font-extrabold text-gold-text underline underline-offset-2"
              >
                {t('clearPick')}
              </Link>
            )}
          </div>

          {/* key ép remount khi đổi ô đang sửa → defaultValue nạp lại đúng ô mới (bẫy đã gặp ở TKB) */}
          <form key={`${formDate}|${formMeal}`} action={saveMenu} className="flex flex-col gap-3">
            <input type="hidden" name="campus_id" value={campusId} />
            <input type="hidden" name="week" value={weekParam ?? ''} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_2fr]">
              <Field label={t('fDate')} htmlFor="menu-date">
                <select
                  id="menu-date"
                  name="date"
                  defaultValue={formDate}
                  className={`${selectInline} w-full`}
                >
                  {weekDates.map((d, i) => (
                    <option key={d} value={d}>
                      {t(`days.${DAY_KEYS[i]}`)} · {ngayVN(d)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('fMeal')} htmlFor="menu-meal">
                <select
                  id="menu-meal"
                  name="meal"
                  defaultValue={formMeal}
                  className={`${selectInline} w-full`}
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`meals.${s}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label={t('fNote')}
                htmlFor="menu-note"
                hint={t('hNote')}
              >
                <input
                  id="menu-note"
                  name="note"
                  defaultValue={editing?.note ?? ''}
                  className={`${inputInline} w-full`}
                />
              </Field>
            </div>

            <Field label={t('fDishes')} htmlFor="menu-items">
              <textarea
                id="menu-items"
                name="items"
                rows={5}
                required
                defaultValue={editing?.items ?? ''}
                placeholder={t('phDishes')}
                className={textareaCls}
              />
            </Field>

            <div>
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('save')}
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
