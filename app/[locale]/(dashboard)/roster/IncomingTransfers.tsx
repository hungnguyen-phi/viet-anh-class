import {getTranslations} from 'next-intl/server';
import {ArrowRightLeft} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {decideTransfer} from './actions';

export type DeNghiDen = {
  id: string;
  studentName: string;
  fromClassName: string;
  note: string | null;
  createdAt: string;
};

const nut =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[8px] px-3 text-chu-thich font-extrabold transition-all';

// ĐỀ NGHỊ CHUYỂN ĐẾN LỚP NÀY — chờ chủ nhiệm lớp này quyết.
//
// Đặt ngay đầu trang danh sách lớp: nếu nhét xuống dưới thì một em bị treo giữa hai lớp hàng tuần
// vì không ai nhìn thấy có việc phải quyết. Lớp gửi đã chờ, và em thì vẫn đang ngồi ở lớp cũ.
//
// Chỉ hiện khi CÓ đề nghị: một khối rỗng nằm mãi trên đầu là một khối người ta thôi nhìn.
export async function IncomingTransfers({
  classId,
  requests,
}: {
  classId: string;
  requests: DeNghiDen[];
}) {
  const t = await getTranslations('roster');
  if (requests.length === 0) return null;

  return (
    <section data-hd="ds-de-nghi-den" className="rounded-[20px] border-[1.5px] border-gold-deep/40 bg-gold/[0.10] p-[18px]">
      <div className="mb-1 flex items-center gap-2 font-display text-noi-dung font-bold text-navy">
        <ArrowRightLeft size={16} strokeWidth={2.5} />
        {t('incomingTitle', {n: requests.length})}
      </div>
      <p className="mb-3 text-chu-thich font-semibold leading-relaxed text-navy/70">
        {t('incomingHint')}
      </p>

      <div className="flex flex-col gap-2">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-[12px] bg-white/70 px-3 py-2.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-than font-extrabold text-navy">
                {r.studentName}
              </span>
              <span className="block truncate text-chu-thich font-semibold text-grey-mid">
                {t('incomingFrom', {class: r.fromClassName, date: r.createdAt.slice(0, 10)})}
                {r.note ? ` · ${r.note}` : ''}
              </span>
            </span>
            {/* Hai nút, hai server action riêng — KHÔNG dùng một form với hai giá trị submit khác
                nhau: SubmitButton khoá nút khi đang gửi, mà khoá cả hai thì người dùng không biết
                mình vừa bấm cái nào. */}
            <form action={decideTransfer} className="flex-none">
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="requestId" value={r.id} />
              <input type="hidden" name="approve" value="true" />
              <SubmitButton
                className={`${nut} bg-navy text-white hover:bg-navy-700`}
                wrapClass="contents"
                label={t('approveFor', {name: r.studentName})}
              >
                {t('approve')}
              </SubmitButton>
            </form>
            <form action={decideTransfer} className="flex-none">
              <input type="hidden" name="classId" value={classId} />
              <input type="hidden" name="requestId" value={r.id} />
              <input type="hidden" name="approve" value="false" />
              <SubmitButton
                className={`${nut} border-[1.5px] border-navy/20 bg-white text-navy hover:border-navy`}
                wrapClass="contents"
                label={t('rejectFor', {name: r.studentName})}
              >
                {t('reject')}
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}
