import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LogIn, ArrowRight} from 'lucide-react';
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
    <main className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 px-4 pb-2.5 pt-3.5 [background:linear-gradient(180deg,rgba(235,240,236,0.95)_0%,rgba(235,240,236,0.75)_70%,rgba(235,240,236,0)_100%)]">
        <div className="glass-strong mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-[20px] px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-8 shrink-0 place-items-center rounded-b-[40%] rounded-t-md bg-linear-to-b from-gold-soft to-gold font-display text-[13px] font-extrabold text-navy shadow-[0_4px_12px_rgba(233,180,0,0.35)]">
              VA
            </span>
            <span className="min-w-0 truncate font-display text-[16px] font-bold text-navy">
              Việt Anh Class · {t('guide')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LocaleSwitcher />
            <Link
              href="/login"
              className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-extrabold text-navy transition-colors hover:bg-white/70"
            >
              <LogIn size={15} strokeWidth={2.2} />
              {t('login')}
            </Link>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl space-y-5 px-4 py-6 leading-relaxed">
        <section className="glass rounded-[20px] p-6">
          <h1 className="font-display text-2xl font-extrabold text-navy">Hướng dẫn sử dụng</h1>
          <p className="mt-2 text-sm text-txt">
            Viet Anh Class giúp mỗi lớp lãnh đạo việc học tập theo khung <b>4DX</b>: đặt mục tiêu
            (WIG), đo hành vi dẫn dắt (Lead measure), nhìn bảng điểm thi đua, và họp WIG hằng tuần.
            App song ngữ — đổi ngôn ngữ ở nút <b>EN/VI</b> góc trên.
          </p>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">1. Đăng nhập</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-txt">
            <li><b>Giáo viên / Quản trị / Học sinh</b>: bấm <b>“Đăng nhập với Google”</b> bằng email trường (<code className="rounded-[6px] bg-navy/[0.06] px-1.5 py-0.5 text-[0.85em] font-bold text-navy">@truongvietanh.com</code> hoặc <code className="rounded-[6px] bg-navy/[0.06] px-1.5 py-0.5 text-[0.85em] font-bold text-navy">@student.truongvietanh.com</code>).</li>
            <li><b>Phụ huynh</b>: nhập email đã được nhà trường mời → bấm <b>“Gửi liên kết đăng nhập”</b> → mở email bấm vào liên kết.</li>
            <li>Nếu thấy “Tài khoản chưa được cấp quyền”: tài khoản hợp lệ nhưng chưa được gán vai trò — liên hệ quản trị viên.</li>
          </ul>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">2. Khái niệm 4DX</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-txt">
            <li><b>WIG (mục tiêu cực kỳ quan trọng)</b>: theo 4 lĩnh vực — Kiến thức, Kỹ năng, Tiếng Anh, Thể chất. Có WIG <b>năm</b> và các WIG <b>tuần</b> con.</li>
            <li><b>Lead measure (hành vi dẫn dắt)</b>: việc làm hằng ngày/tuần để đạt WIG (vd “buổi tutor”, “hành vi văn hoá”). Gắn vào <b>WIG tuần</b>.</li>
            <li><b>Scoreboard</b>: donut % + nhãn <span className="font-bold text-success">Đúng tiến độ</span> / <span className="font-bold text-warn">Giữa nhịp</span> / <span className="font-bold text-status-bad">Chậm tiến độ</span> (so % hoàn thành với % thời gian đã trôi).</li>
            <li><b>Họp WIG</b>: mỗi tuần ghi lại chiêm nghiệm, cam kết, việc tuần sau.</li>
          </ul>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">3. Giáo viên chủ nhiệm (GVCN)</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-txt">
            <li><b>Trang lớp</b>: xem bảng điểm, thứ hạng thi đua (Khối/Cấp/Campus/Group), donut WIG 4 lĩnh vực.</li>
            <li><b>Điểm danh</b>: chọn nhanh <b>“Chọn cả lớp ✓✓”</b> (vd tất cả Có mặt) rồi chỉnh vài em vắng/trễ → bấm <b>“Lưu điểm danh”</b>. Hiển thị realtime trên mọi thiết bị.</li>
            <li><b>WIG</b> (thiết lập theo 3 bước): <b>① Tạo WIG năm</b> → <b>② Tạo WIG tuần</b> (liên kết với WIG năm) → <b>③ Thêm Lead measure</b> vào WIG tuần. Bấm <b>“Ghi +”</b> để cộng tiến độ; tiến độ WIG năm = tổng các WIG tuần.</li>
            <li><b>Họp WIG</b>: ghi biên bản tuần (chiêm nghiệm · cam kết · tuần sau).</li>
            <li><b>Danh sách</b>: bật <b>“Trưởng điểm danh”</b> cho 1 học sinh để em đó điểm danh thay (chỉ ngày hôm nay).</li>
          </ol>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">4. Học sinh</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-txt">
            <li>Xem <b>bảng điểm lớp</b> và tiến độ WIG.</li>
            <li>Nếu được giao làm <b>Trưởng điểm danh</b>: điểm danh giúp lớp (chỉ ngày hôm nay).</li>
          </ul>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">5. Phụ huynh</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-txt">
            <li>Vào <b>Báo cáo</b>: chỉ xem dữ liệu <b>con mình</b> — tổng quan điểm danh + tiến độ WIG của lớp con. Không xem được học sinh khác.</li>
          </ul>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">6. Ban giám hiệu (BGH)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-txt">
            <li><b>Báo cáo cơ sở</b>: bảng các lớp trong cơ sở mình — điểm thi đua + điểm danh hôm nay. Không xem được cơ sở khác.</li>
          </ul>
        </section>

        <section className="glass rounded-[20px] p-6">
          <h2 className="font-display text-[17px] font-bold text-navy">7. Quản trị viên (Admin)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-txt">
            <li><b>Tạo cơ sở, tạo lớp</b>; <b>Phân công GVCN</b> cho lớp.</li>
            <li><b>Mời người dùng mới</b> (chọn vai trò + lớp) — vai trò tự gán khi họ đăng nhập lần đầu.</li>
            <li><b>Đổi vai trò</b>, <b>Vô hiệu</b> (đưa về “chờ cấp quyền”), hoặc <b>Xoá</b> người dùng. Không thể tự đổi/xoá chính mình.</li>
            <li><b>Mời phụ huynh</b> theo email + gán con.</li>
            <li><b>Giao diện mẫu</b>: xem nhanh mọi màn hình của app.</li>
          </ul>
        </section>

        <div className="pt-1 text-center">
          <Link
            href="/login"
            className="btn-gold inline-flex items-center gap-2 rounded-[12px] px-6 py-2.5 font-display font-bold"
          >
            {t('login')}
            <ArrowRight size={17} strokeWidth={2.2} />
          </Link>
        </div>
      </article>
    </main>
  );
}
