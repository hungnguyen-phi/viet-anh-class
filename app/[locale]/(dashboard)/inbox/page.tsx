import {after} from 'next/server';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ArrowLeft, Lock, MessagesSquare, ShieldCheck} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {getAccessibleClasses} from '@/lib/queries';
import {Flash} from '@/components/ui/Flash';
import {ThreadList, type ThreadItem} from '@/components/inbox/ThreadList';
import {MessageBubble, type MessageRow} from '@/components/inbox/MessageBubble';
import {MessageForm} from './MessageForm';
import {OpenThreadForm, type OpenOption} from './OpenThreadForm';

// Cuộc trao đổi được chỉ định bằng ?t=<uuid>. Soát dạng UUID TRƯỚC khi hỏi cơ sở dữ liệu: gõ bậy
// vào thanh địa chỉ thì Postgres ném 22P02 (sai kiểu) và cả trang rơi vào error boundary — trong
// khi câu trả lời đúng chỉ là "không có cuộc nào như vậy".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lấy tối đa bấy nhiêu tin gần nhất của một cuộc. Cắt ở đầu MỚI (order desc + limit rồi lật lại),
// không phải đầu cũ — cuộc dài thì thứ người ta cần là mấy câu vừa nói, không phải câu đầu tiên.
const SO_TIN_TOI_DA = 200;

const backLinkCls =
  'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy';

type LinkRow = {student_id: string; profiles: {full_name: string | null} | null};
type EnrolRow = {
  student_id: string;
  class_id: string;
  profiles: {full_name: string | null; email: string} | null;
};

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{t?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {t: threadParam} = await searchParams;
  setRequestLocale(locale);

  // Ban giám hiệu và quản trị viên CỐ Ý không vào được màn này (0065): họ nhận CON SỐ qua
  // pt_class_message_health(), không nhận CHỮ. requireRole tự đưa họ về trang nhà của vai mình.
  // Học sinh cũng không vào — đây là kênh giữa người lớn với nhau về em, không phải của em.
  const profile = await requireRole(['parent', 'teacher']);
  const laPhuHuynh = profile.role === 'parent';
  const t = await getTranslations('inbox');
  const supabase = await createClient();

  const openId = threadParam && UUID_RE.test(threadParam) ? threadParam : null;

  // MỘT đợt truy vấn song song cho mọi thứ không phụ thuộc nhau. Các nhánh không cần thì truyền
  // null — `Promise.all` cho null đi thẳng qua, không tốn vòng mạng nào.
  //
  //  • pt_my_threads: hộp thư + số chưa đọc, một lượt (RLS tự lọc theo vai người gọi).
  //  • tin nhắn: bắn NGAY khi có ?t=, không chờ biết cuộc đó có trong hộp thư hay không —
  //    RLS của bảng tin nhắn mới là thứ quyết định, nên hỏi sớm là an toàn và đỡ một chặng.
  //  • pt_can_write_thread: cuộc còn nhắn được không (em còn học lớp đó không). Hỏi trước để ẩn
  //    hẳn ô soạn tin, thay vì để người ta gõ xong rồi mới báo hỏng.
  const [threadsRes, msgRes, canWriteRes, childrenRes, lopCuaToi] = await Promise.all([
    supabase.rpc('pt_my_threads'),
    openId
      ? supabase
          .from('parent_teacher_messages')
          .select('id, sender_id, sender_role, sender_side, body, created_at')
          .eq('thread_id', openId)
          .order('created_at', {ascending: false})
          .limit(SO_TIN_TOI_DA)
      : null,
    openId ? supabase.rpc('pt_can_write_thread', {t: openId}) : null,
    !openId && laPhuHuynh
      ? supabase
          .from('parent_links')
          .select('student_id, profiles!parent_links_student_id_fkey(full_name)')
      : null,
    !openId && !laPhuHuynh ? getAccessibleClasses(supabase, profile) : null,
  ]);

  const threads = (threadsRes.data ?? []) as unknown as ThreadItem[];

  // ============================================================
  // MÀN 2 — MỘT CUỘC TRAO ĐỔI
  // ============================================================
  if (openId) {
    const cuoc = threads.find((x) => x.thread_id === openId) ?? null;
    const messages = ((msgRes?.data ?? []) as unknown as MessageRow[]).slice().reverse();

    let tenCon = cuoc?.student_name ?? null;
    let tenLop = cuoc?.class_name ?? null;
    let vaoDuoc = Boolean(cuoc);

    // Vì sao còn phương án dự phòng: pt_my_threads() join sang `classes`, mà quyền đọc lớp của
    // phụ huynh (is_parent_of_class) đòi con ĐANG ghi danh hoạt động. Em chuyển lớp là dòng đó
    // rụng khỏi hộp thư, dù 0065 chủ ý giữ quyền ĐỌC lịch sử cho cả hai bên. Hỏi thẳng bảng cuộc
    // (policy chỉ xét is_my_child/is_class_teacher) thì vẫn mở lại được lịch sử qua đường link.
    if (!cuoc) {
      const {data: th} = await supabase
        .from('parent_teacher_threads')
        .select('id, profiles!parent_teacher_threads_student_id_fkey(full_name), classes(name)')
        .eq('id', openId)
        .maybeSingle();
      const row = th as unknown as {
        id: string;
        profiles: {full_name: string | null} | null;
        classes: {name: string} | null;
      } | null;
      if (row) {
        vaoDuoc = true;
        tenCon = row.profiles?.full_name ?? null;
        tenLop = row.classes?.name ?? null;
      }
    }

    if (!vaoDuoc) {
      return (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm font-bold text-navy">{t('cannotOpen')}</p>
          <p className="mt-1 text-sm text-grey-mid">
            {t('cannotOpenHint')}
          </p>
          <Link href="/inbox" className={`mt-4 ${backLinkCls}`}>
            <ArrowLeft size={14} strokeWidth={2.5} />
            {t('backToInbox')}
          </Link>
        </div>
      );
    }

    // Đánh dấu đã đọc SAU khi trả trang (after) — người dùng không phải chờ thêm một lượt ghi mới
    // thấy nội dung. Mốc đọc do máy chủ đặt bên trong pt_mark_read(), client không gửi giờ lên.
    after(() => {
      void supabase.rpc('pt_mark_read', {p_thread: openId});
    });

    // Lỗi RPC (mạng) thì cứ cho gửi: để insert báo lỗi thật còn hơn khoá nhầm ô soạn tin.
    const coTheGui = canWriteRes?.data !== false;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate font-display text-[22px] font-bold text-navy">
              {t('threadAbout', {name: tenCon ?? t('aStudent')})}
            </h1>
            {tenLop && (
              <p className="mt-0.5 text-[12.5px] font-bold text-grey-mid">
                {t('classLine', {cls: tenLop})} · {laPhuHuynh ? t('withTeacher') : t('withParents')}
              </p>
            )}
          </div>
          <Link href="/inbox" className={backLinkCls}>
            <ArrowLeft size={14} strokeWidth={2.5} />
            {t('allThreads')}
          </Link>
        </div>

        <Flash />

        <div className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
          {messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-grey-mid">
              {t('noMessagesYet')}
            </p>
          ) : (
            <>
              {messages.length === SO_TIN_TOI_DA && (
                <p className="text-center text-[11px] italic text-grey-mid">
                  {t('showingLatest', {n: SO_TIN_TOI_DA})}
                </p>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} toiLaAi={profile.id} />
              ))}
            </>
          )}
        </div>

        {coTheGui ? (
          <MessageForm threadId={openId} laPhuHuynh={laPhuHuynh} />
        ) : (
          <div className="glass rounded-[16px] p-3">
            <p className="inline-flex items-start gap-1.5 text-[13px] font-bold text-grey-mid">
              <Lock size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" />
              {t('lockedLeftClass')}
            </p>
          </div>
        )}

        {laPhuHuynh && (
          <p className="inline-flex items-start gap-1.5 text-[11px] italic text-grey-mid">
            <ShieldCheck size={13} strokeWidth={2.5} className="mt-px shrink-0" />
            {t('privacyThread')}
          </p>
        )}

        {/* Neo cuối trang: link vào cuộc trỏ tới #moi-nhat nên trình duyệt tự cuộn xuống đáy —
            thấy ngay mấy câu vừa nói và ô soạn tin, không phải lướt qua cả lịch sử. Đặt CUỐI
            CÙNG mới đúng: neo được kéo lên đầu khung nhìn, mà đáy trang thì không kéo thêm được
            nữa nên dừng đúng chỗ cần. */}
        <div id="moi-nhat" />
      </div>
    );
  }

  // ============================================================
  // MÀN 1 — HỘP THƯ
  // ============================================================
  const tongChuaDoc = threads.reduce((s, x) => s + Number(x.unread_count ?? 0), 0);
  const soCuocDangCho = threads.filter((x) => x.waiting_for_school).length;
  const daCoCuoc = new Set(threads.map((x) => x.student_id));

  // Ai chưa có cuộc nào thì cho mở cuộc mới. 0065 cho phép CẢ HAI bên chủ động, và cột opened_by
  // ghi lại ai bấm — chính là số liệu ban giám hiệu muốn xem sau đợt thử.
  let luaChonMoCuoc: OpenOption[] = [];

  if (laPhuHuynh) {
    const cacCon = ((childrenRes?.data ?? []) as unknown as LinkRow[])
      .map((l) => ({id: l.student_id, name: l.profiles?.full_name ?? t('yourChild')}))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    luaChonMoCuoc = cacCon.filter((c) => !daCoCuoc.has(c.id));

    if (cacCon.length === 0) {
      return (
        <div className="glass rounded-[20px] p-8 text-center">
          <h1 className="font-display text-[22px] font-bold text-navy">
            {t('noLinkTitle')}
          </h1>
          <p className="mt-2 text-sm text-grey-mid">
            {t('noLinkHint')} {t('noLinkAsk')}
          </p>
        </div>
      );
    }
  } else {
    // GVCN: gợi ý mở cuộc với gia đình những em CHƯA có cuộc nào. Danh sách lấy từ đúng các lớp
    // mình chủ nhiệm (getAccessibleClasses với vai teacher trả về đúng chừng đó).
    const lop = lopCuaToi ?? [];
    if (lop.length > 0) {
      const {data: enrols} = await supabase
        .from('enrollments')
        .select('student_id, class_id, profiles!enrollments_student_id_fkey(full_name, email)')
        .in(
          'class_id',
          lop.map((c) => c.id),
        )
        .eq('is_active', true);
      const tenLop = new Map(lop.map((c) => [c.id, c.name] as const));
      luaChonMoCuoc = ((enrols ?? []) as unknown as EnrolRow[])
        .filter((e) => !daCoCuoc.has(e.student_id))
        .map((e) => ({
          id: e.student_id,
          // Nhiều lớp thì phải kèm tên lớp: hai em trùng tên ở hai lớp là chuyện thường.
          name:
            (e.profiles?.full_name ?? e.profiles?.email ?? t('aStudentCap')) +
            (lop.length > 1 ? ` — ${tenLop.get(e.class_id) ?? ''}` : ''),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="inline-flex items-center gap-2 font-display text-[22px] font-bold text-navy">
          <MessagesSquare size={20} strokeWidth={2.2} />
          {laPhuHuynh ? t('titleParent') : t('titleTeacher')}
          {tongChuaDoc > 0 && (
            <span className="rounded-full bg-gold px-2 py-0.5 text-[12px] font-black text-navy">
              {tongChuaDoc}
            </span>
          )}
        </h1>
        {!laPhuHuynh && soCuocDangCho > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-bad/[0.08] px-2.5 py-1 text-[11.5px] font-extrabold text-status-bad">
            {t('waitingFamilies', {n: soCuocDangCho})}
          </span>
        )}
      </div>

      <Flash />

      {threads.length === 0 ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            {laPhuHuynh
              ? t('emptyParent')
              : t('emptyTeacher')}
          </p>
        </div>
      ) : (
        <ThreadList items={threads} nhinTuNhaTruong={!laPhuHuynh} />
      )}

      <OpenThreadForm
        options={luaChonMoCuoc}
        label={
          laPhuHuynh
            ? t('openLabelParent')
            : t('openLabelTeacher')
        }
        hint={laPhuHuynh ? t('openHintParent') : undefined}
        nutMotLuaChon={(ten) => t('openOneBtn', {name: ten})}
        nutNhieuLuaChon={t('openManyBtn')}
      />

      {laPhuHuynh && (
        <p className="inline-flex items-start gap-1.5 text-[11px] italic text-grey-mid">
          <ShieldCheck size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {t('privacyFootParent')}
        </p>
      )}
    </div>
  );
}
