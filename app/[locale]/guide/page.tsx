import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LocaleSwitcher} from '@/components/shell/LocaleSwitcher';

export default async function GuidePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');

  return (
    <main className="min-h-screen bg-grey-light">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-heading font-extrabold">
            <span className="flex h-7 w-6 items-center justify-center rounded-b-[40%] rounded-t-sm bg-gold text-[11px] font-black text-navy">
              VA
            </span>
            Viet Anh Class · {t('guide')}
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Link href="/login" className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
              {t('login')}
            </Link>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-8 leading-relaxed">
        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h1 className="font-heading text-2xl font-black text-navy">Hướng dẫn sử dụng</h1>
          <p className="mt-2 text-sm text-txt">
            Viet Anh Class giúp mỗi lớp lãnh đạo việc học tập theo khung <b>4DX</b>: đặt mục tiêu
            (WIG), đo hành vi dẫn dắt (Lead measure), nhìn bảng điểm thi đua, và họp WIG hằng tuần.
            App song ngữ — đổi ngôn ngữ ở nút <b>EN/VI</b> góc trên.
          </p>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">1. Đăng nhập</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>Giáo viên / Quản trị / Học sinh</b>: bấm <b>“Đăng nhập với Google”</b> bằng email trường (<code>@truongvietanh.com</code> hoặc <code>@student.truongvietanh.com</code>).</li>
            <li><b>Phụ huynh</b>: nhập email đã được nhà trường mời → bấm <b>“Gửi liên kết đăng nhập”</b> → mở email bấm vào liên kết.</li>
            <li>Nếu thấy “Tài khoản chưa được cấp quyền”: tài khoản hợp lệ nhưng chưa được gán vai trò — liên hệ quản trị viên.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">2. Khái niệm 4DX</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>WIG (mục tiêu cực kỳ quan trọng)</b>: theo 4 lĩnh vực — Kiến thức, Kỹ năng, Tiếng Anh, Thể chất. Có WIG <b>năm</b> và các WIG <b>tuần</b> con.</li>
            <li><b>Lead measure (hành vi dẫn dắt)</b>: việc làm hằng ngày/tuần để đạt WIG (vd “buổi tutor”, “hành vi văn hoá”). Gắn vào <b>WIG tuần</b>.</li>
            <li><b>Scoreboard</b>: donut % + nhãn <span className="text-success font-bold">Đúng tiến độ</span> / <span className="text-warn font-bold">Giữa nhịp</span> / <span className="text-status-bad font-bold">Chậm tiến độ</span> (so % hoàn thành với % thời gian đã trôi).</li>
            <li><b>Họp WIG</b>: mỗi tuần ghi lại chiêm nghiệm, cam kết, việc tuần sau.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">3. Giáo viên chủ nhiệm (GVCN)</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li><b>Trang lớp</b>: xem bảng điểm, thứ hạng thi đua (Khối/Cấp/Campus/Group), donut WIG 4 lĩnh vực.</li>
            <li><b>Điểm danh</b>: chọn nhanh <b>“Chọn cả lớp ✓✓”</b> (vd tất cả Có mặt) rồi chỉnh vài em vắng/trễ → bấm <b>“Lưu điểm danh”</b>. Hiển thị realtime trên mọi thiết bị.</li>
            <li><b>WIG</b> (thiết lập theo 3 bước): <b>① Tạo WIG năm</b> → <b>② Tạo WIG tuần</b> (liên kết với WIG năm) → <b>③ Thêm Lead measure</b> vào WIG tuần. Bấm <b>“Ghi +”</b> để cộng tiến độ; tiến độ WIG năm = tổng các WIG tuần.</li>
            <li><b>Họp WIG</b>: ghi biên bản tuần (chiêm nghiệm · cam kết · tuần sau).</li>
            <li><b>Danh sách</b>: bật <b>“Trưởng điểm danh”</b> cho 1 học sinh để em đó điểm danh thay (chỉ ngày hôm nay).</li>
          </ol>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">4. Học sinh</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Xem <b>bảng điểm lớp</b> và tiến độ WIG.</li>
            <li>Nếu được giao làm <b>Trưởng điểm danh</b>: điểm danh giúp lớp (chỉ ngày hôm nay).</li>
          </ul>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">5. Phụ huynh</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Vào <b>Báo cáo</b>: chỉ xem dữ liệu <b>con mình</b> — tổng quan điểm danh + tiến độ WIG của lớp con. Không xem được học sinh khác.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">6. Ban giám hiệu (BGH)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>Báo cáo cơ sở</b>: bảng các lớp trong cơ sở mình — điểm thi đua + điểm danh hôm nay. Không xem được cơ sở khác.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-grey-line bg-white p-5">
          <h2 className="font-heading text-lg font-extrabold text-navy">7. Quản trị viên (Admin)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li><b>Tạo cơ sở, tạo lớp</b>; <b>Phân công GVCN</b> cho lớp.</li>
            <li><b>Mời người dùng mới</b> (chọn vai trò + lớp) — vai trò tự gán khi họ đăng nhập lần đầu.</li>
            <li><b>Đổi vai trò</b>, <b>Vô hiệu</b> (đưa về “chờ cấp quyền”), hoặc <b>Xoá</b> người dùng. Không thể tự đổi/xoá chính mình.</li>
            <li><b>Mời phụ huynh</b> theo email + gán con.</li>
            <li><b>Giao diện mẫu</b>: xem nhanh mọi màn hình của app.</li>
          </ul>
        </section>

        <p className="text-center text-sm text-grey-mid">
          <Link href="/login" className="font-bold text-navy underline">
            → {t('login')}
          </Link>
        </p>
      </article>
    </main>
  );
}
