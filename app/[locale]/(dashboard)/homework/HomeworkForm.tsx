'use client';

import {useActionState, useEffect, useState, type KeyboardEvent} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCircle2, AlertCircle} from 'lucide-react';
import {Link, useRouter} from '@/i18n/navigation';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {Field, ctlWithBorder, selectCls, btnGold, btnGhost} from '@/components/ui/Field';
import {savePost} from './actions';

// Ba loại nội dung khác nhau ở VIỆC người đọc phải làm (xem comment enum homework_kind ở 0061),
// nên nhãn cũng phải nói ra việc đó chứ không chỉ đặt tên.
// Nhãn tra ở homework.kindOptions.* — chúng nói ra VIỆC người đọc phải làm, không chỉ đặt tên.
const LOAI = ['assignment', 'reminder', 'exam'] as const;

const RONG = {date: '', subject_id: '', content: '', due_date: '', kind: 'assignment'};

export type PostForEdit = {
  id: string;
  date: string;
  // Bài cũ (trước 0069) chưa có môn trong danh mục → null, ô chọn để trống và phải chọn lại.
  subject_id: string | null;
  // Tên môn CHỈ để hiện ở tiêu đề panel sửa; cái được gửi đi vẫn là subject_id.
  subjectName: string;
  content: string;
  due_date: string | null;
  kind: string;
};

// Form đăng / sửa báo bài. Dùng useActionState để lỗi hiện ngay cạnh ô và GIỮ NGUYÊN nội dung đã
// soạn — ô nội dung có thể là mấy dòng bài tập vừa gõ tay, mất là phải gõ lại từ đầu.
//
// `today` tính Ở SERVER rồi truyền xuống: client tự new Date() sẽ lệch khi qua nửa đêm (máy chủ
// chạy UTC, sớm hơn giờ VN 7 tiếng) và gây cảnh báo hydration.
//
// `subjects` là chương trình của lớp (class_subjects), cũng lấy ở server: ô Môn là ô CHỌN, không
// còn gõ tay — gõ tay chính là thứ làm "Ngữ văn"/"Ngữ Văn" thành hai môn và làm sai luôn tiêu đề
// thông báo đẩy gửi cho cả lớp lẫn phụ huynh.
export function HomeworkForm({
  classId,
  today,
  subjects,
  post,
}: {
  classId: string;
  today: string;
  subjects: {id: string; name: string}[];
  post?: PostForEdit | null;
}) {
  const t = useTranslations('homework');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [state, formAction] = useActionState(savePost, {ok: false});

  // Input CONTROLLED → React không xoá nội dung khi submit; giữ nguyên khi có lỗi.
  const [v, setV] = useState({
    date: post?.date ?? today,
    subject_id: post?.subject_id ?? '',
    content: post?.content ?? '',
    due_date: post?.due_date ?? '',
    kind: post?.kind ?? 'assignment',
  });
  const set = (k: keyof typeof RONG) => (e: {target: {value: string}}) =>
    setV((p) => ({...p, [k]: e.target.value}));

  // Địa chỉ danh sách (giữ ?class= để không nhảy về lớp khác sau khi lưu).
  const dsHref = `/homework?class=${encodeURIComponent(classId)}`;

  useEffect(() => {
    if (!state.ok) return;
    if (post) {
      // SỬA xong thì phải rời chế độ sửa, nếu không panel vẫn mở và giáo viên tưởng chưa lưu.
      // Kèm ?flash= để thông báo nổi lên như mọi thao tác khác của app.
      router.push(`${dsHref}&flash=${encodeURIComponent(state.message ?? t('updated'))}`);
      return;
    }
    // ĐĂNG xong thì dọn form cho bài kế tiếp, nhưng GIỮ NGUYÊN ngày và môn: giáo viên thường
    // báo mấy môn liền trong cùng một buổi, bắt chọn lại ngày mỗi lần là thừa thao tác.
    setV((p) => ({...RONG, date: p.date, subject_id: p.subject_id}));
  }, [state, post, router, dsHref, t]);

  // Ctrl/⌘+Enter gửi nhanh (form nhiều ô, và ô nội dung là textarea nên Enter thường là xuống dòng).
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLFormElement).requestSubmit();
    }
  };

  // Textarea không dùng được `ctl-h` (44px cố định) nên tự khai, nhưng giữ NGUYÊN ngôn ngữ hình
  // ảnh của ô nhập chuẩn: bo 10px, viền 1.5px navy/15, nền trắng, chữ navy đậm.
  const taCls = (loi: boolean) =>
    `w-full min-w-0 min-h-[96px] rounded-[10px] border-[1.5px] bg-white px-3 py-2.5 text-sm font-semibold leading-[1.6] text-navy outline-none transition-colors ${
      loi ? 'border-status-bad focus:border-status-bad' : 'border-navy/15 focus:border-navy'
    }`;

  const loi = (ten: string) => (state.fieldError === ten ? state.error : null);

  return (
    <form
      action={formAction}
      onKeyDown={onKeyDown}
      className={
        post
          ? 'glass animate-rise rounded-[20px] p-[18px] ring-2 ring-gold/60'
          : 'glass rounded-[16px] p-3'
      }
      noValidate
    >
      <input type="hidden" name="class_id" value={classId} />
      {post && <input type="hidden" name="post_id" value={post.id} />}

      {post && (
        <div className="mb-2.5 font-display text-[15px] font-bold text-navy">
          Sửa bài đã đăng · {post.subjectName}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Ngày BÁO BÀI (buổi học nào), không phải hạn nộp — mặc định hôm nay theo giờ VN. */}
        <Field label={t('fDate')} htmlFor="hw-date" error={loi('date')}>
          <input
            id="hw-date"
            name="date"
            type="date"
            value={v.date}
            onChange={set('date')}
            aria-invalid={state.fieldError === 'date'}
            className={ctlWithBorder(state.fieldError === 'date')}
          />
        </Field>

        {/* MÔN: chọn từ chương trình của lớp, không gõ tay nữa. Tên môn ở đây còn chui vào TIÊU ĐỀ
            THÔNG BÁO ĐẨY gửi cả lớp lẫn phụ huynh (trigger notify_homework_post), nên gõ sai một
            chữ là hàng chục người cùng nhận. Dùng ctlWithBorder + cursor-pointer chứ không
            `selectCls + BORDER_ERR`: hai lớp viền chồng nhau thì cái nào thắng phụ thuộc thứ tự
            Tailwind sinh CSS. */}
        <Field label={t('fSubject')} htmlFor="hw-subject" error={loi('subject_id')}>
          <select
            id="hw-subject"
            name="subject_id"
            value={v.subject_id}
            onChange={set('subject_id')}
            aria-invalid={state.fieldError === 'subject_id'}
            className={`${ctlWithBorder(state.fieldError === 'subject_id')} cursor-pointer`}
          >
            <option value="">{t('pickSubject')}</option>
            {subjects.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('fKind')} htmlFor="hw-kind">
          <select
            id="hw-kind"
            name="kind"
            value={v.kind}
            onChange={set('kind')}
            className={selectCls}
          >
            {LOAI.map((k) => (
              <option key={k} value={k}>
                {t(`kindOptions.${k}`)}
              </option>
            ))}
          </select>
        </Field>

        {/* Hạn nộp ĐƯỢC PHÉP TRỐNG, cố ý: dặn dò và kiểm tra thường không có gì để nộp. Ép nhập
            cho mọi dòng chỉ đẻ ra hạn giả rồi không ai tin màn "sắp đến hạn" nữa (xem 0061). */}
        {/* <Field> tự ưu tiên hiện lỗi và giấu hint khi có lỗi — không cần tự lo ở đây. */}
        <Field
          label={t('fDue')}
          htmlFor="hw-due"
          error={loi('due_date')}
          hint={t('hDue')}
        >
          <input
            id="hw-due"
            name="due_date"
            type="date"
            value={v.due_date}
            onChange={set('due_date')}
            min={v.date}
            aria-invalid={state.fieldError === 'due_date'}
            className={ctlWithBorder(state.fieldError === 'due_date')}
          />
        </Field>

        <div className="sm:col-span-2 lg:col-span-4">
          <Field label={t('fContent')} htmlFor="hw-content" error={loi('content')}>
            <textarea
              id="hw-content"
              name="content"
              value={v.content}
              onChange={set('content')}
              rows={3}
              placeholder={t('phContent')}
              aria-invalid={state.fieldError === 'content'}
              className={taCls(state.fieldError === 'content')}
            />
          </Field>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          {post && (
            <Link href={dsHref} className={btnGhost}>
              {tCommon('cancel')}
            </Link>
          )}
          <SubmitButton className={btnGold} wrapClass="contents">
            {post ? t('saveEdit') : t('post')}
          </SubmitButton>
        </div>
      </div>

      {!post && (
        <p className="mt-2 text-[11px] italic text-grey-mid">
          {t('postHint')}
        </p>
      )}

      {/* Lỗi chung (không gắn ô cụ thể) */}
      {state.error && !state.fieldError && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-status-bad">
          <AlertCircle size={14} strokeWidth={2.5} />
          {state.error}
        </p>
      )}
      {/* Báo thành công inline (chế độ sửa thì đã chuyển sang thông báo nổi rồi rời trang) */}
      {state.ok && state.message && !post && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-success">
          <CheckCircle2 size={14} strokeWidth={2.5} />
          {state.message}
        </p>
      )}
    </form>
  );
}
