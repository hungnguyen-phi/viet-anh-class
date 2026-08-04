import {getTranslations, setRequestLocale} from 'next-intl/server';
import {CalendarClock, Check, Circle, Users} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {requireProfile} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext, getChildren, conDangXem as layConDangXem, type Con} from '@/lib/queries';
import {todayInVN} from '@/lib/dates';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {Flash} from '@/components/ui/Flash';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {btnGold, btnGhost} from '@/components/ui/Field';
import {HomeworkForm} from './HomeworkForm';
import {deletePost, toggleDone, seedSubjects} from './actions';
import type {Database} from '@/lib/database.types';

type Kind = Database['public']['Enums']['homework_kind'];
type Post = {
  id: string;
  date: string;
  // Cột chữ CŨ (trước 0069 là ô gõ tay). Giữ lại CHỈ để hiện những bài cũ chưa có subject_id —
  // không dòng mã nào ghi vào đây nữa, xem quyết định E của migration 0069.
  subject: string | null;
  subject_id: string | null;
  // Tên môn lấy thẳng từ danh mục qua khoá ngoại. Đây mới là nguồn sự thật.
  subjects: {name: string} | null;
  content: string;
  due_date: string | null;
  kind: Kind;
};
// Một môn trong chương trình của lớp (class_subjects → subjects).
type MonHoc = {id: string; name: string; sort_order: number; is_active: boolean};

// Nhãn + màu chip theo loại. Dùng token brand có sẵn, không màu tự phát:
// bài tập = navy (việc thường), dặn dò = xanh (nhẹ nhàng), kiểm tra = vàng (giống tiết thi ở TKB).
// Chỉ giữ phần KHÔNG phụ thuộc ngôn ngữ. Nhãn tra ở homework.kinds.* / homework.weekdays.*.
const CHIP_LOAI: Record<Kind, string> = {
  assignment: 'bg-navy/[0.08] text-navy',
  reminder: 'bg-success/[0.12] text-success-dark',
  exam: 'bg-gold/20 text-navy',
};

// Bao nhiêu bài gần nhất thì tải. 60 ≈ hai tháng học của một lớp — đủ để tra "BTVN thứ Ba tuần
// trước là gì" mà không kéo cả năm về. Chỉ mục (class_id, date desc) của 0061 phục vụ đúng
// truy vấn này.
const SO_BAI_TAI = 60;

// yyyy-mm-dd → 'Thứ Ba · 28/07/2026'. Neo vào T00:00:00Z rồi đọc bằng getUTCDay: phép tính
// thuần trên chuỗi ngày, không phụ thuộc múi giờ của máy chủ.
function nhanNgay(iso: string, t: (k: string) => string): string {
  const [y, m, d] = iso.split('-');
  const thu = t(`weekdays.d${new Date(`${iso}T00:00:00Z`).getUTCDay()}`);
  return `${thu} · ${d}/${m}/${y}`;
}
function ngayNgan(iso: string): string {
  const [, m, d] = iso.split('-');
  return d && m ? `${d}/${m}` : iso;
}

export default async function HomeworkPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; child?: string; edit?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam, child: childParam, edit: editId} = await searchParams;
  setRequestLocale(locale);
  // Mọi vai đăng nhập đều có việc ở đây, chỉ khác nhau ở phần được thấy:
  // GVCN/admin đăng bài · học sinh tự đánh dấu · phụ huynh theo dõi con · hiệu trưởng chỉ xem.
  const profile = await requireProfile();
  const t = await getTranslations('homework');
  const supabase = await createClient();

  // ===== Phụ huynh: con nào, lớp nào =====
  // Phải hỏi trước Promise.all bên dưới (thêm một chặng mạng, CHỈ với phụ huynh) vì chưa biết con
  // đang xem là ai thì chưa biết hỏi lớp nào. RLS pl_parent_self chỉ trả link của chính họ.
  // Danh sách con lấy từ lib/queries.ts — dùng chung với /thời khoá biểu. Bản chép tay ở đây đã
  // được gỡ: nó và getMyClass() sắp theo hai thứ tự khác nhau (tên vs UUID), nên hai trang mở ra
  // hai đứa trẻ khác nhau mà không màn hình nào nói ra.
  const children: Con[] = profile.role === 'parent' ? await getChildren(supabase) : [];
  const conDangXem = layConDangXem(children, childParam);

  // Phụ huynh đổi con thì đổi luôn lớp — dùng lại nhánh preferredClassId của getClassContext
  // (RLS chặn nếu đó không phải lớp của con họ).
  const lopMuonXem = profile.role === 'parent' ? conDangXem?.classId : classParam;
  const {myClass, classes: accessible} = await getClassContext(supabase, profile, lopMuonXem);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  // Hiệu trưởng CỐ Ý chỉ được xem (0061): người chịu trách nhiệm về bài tập của lớp là GVCN.
  const canManage = profile.role === 'teacher' || profile.role === 'admin';
  const laHocSinh = profile.role === 'student';
  const laPhuHuynh = profile.role === 'parent';

  // Ngày hôm nay theo giờ VN — TÍNH TẠI CHỖ, không hỏi máy chủ CSDL.
  //
  // Trước đây gọi rpc('app_today'), tốn một vòng mạng (đo được 60–197 ms) chỉ để hỏi hôm nay là
  // ngày mấy. Và chính mã này đã dùng todayInVN() làm phương án dự phòng ngay dòng dưới — tức là
  // đã tin nó đúng rồi. lib/dates.ts tính bằng Intl với múi giờ Asia/Ho_Chi_Minh nên không phụ
  // thuộc giờ máy chủ (máy chủ chạy UTC, lệch 7 tiếng).
  const today = todayInVN();

  const [{data: postData}, {data: monData}] = await Promise.all([
    supabase
      .from('homework_posts')
      // Nhặt luôn tên môn từ danh mục trong CÙNG một truy vấn — hỏi riêng bảng subjects là thêm
      // một chặng mạng mà chẳng biết thêm gì.
      .select('id, date, subject, subject_id, content, due_date, kind, subjects(name)')
      .eq('class_id', myClass.id)
      .order('date', {ascending: false})
      .order('created_at', {ascending: false})
      .limit(SO_BAI_TAI),
    // Chương trình của lớp = nguồn DUY NHẤT cho ô chọn môn (0069 mục B). Chỉ hỏi khi người xem
    // đăng được bài: học sinh, phụ huynh và hiệu trưởng không có form nào, hỏi thêm là tốn một
    // chặng mạng cho không (đúng bài học ở roster/page.tsx:91).
    canManage
      ? supabase
          .from('class_subjects')
          .select('subjects(id, name, sort_order, is_active)')
          .eq('class_id', myClass.id)
          .eq('is_active', true)
      : Promise.resolve({data: null}),
  ]);
  const posts = (postData ?? []) as unknown as Post[];
  const postIds = posts.map((p) => p.id);
  // Môn đã ngừng dùng (is_active = false) vẫn còn trong chương trình lớp nhưng KHÔNG được chọn
  // tiếp — DB cũng chặn ở subject_fits_class, chặn sẵn ở đây để khỏi báo lỗi khó hiểu.
  const monLop = ((monData ?? []) as unknown as {subjects: MonHoc | null}[])
    .map((r) => r.subjects)
    .filter((m): m is MonHoc => !!m && m.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'))
    .map((m) => ({id: m.id, name: m.name}));

  // TÊN MÔN ĐỂ HIỆN. Đọc từ danh mục; bài cũ còn subject_id NULL thì hiện tạm chữ cũ — chỉ để
  // không mất dữ liệu đang có, KHÔNG phải để ghi tiếp vào cột đó.
  const tenMon = (p: Post) => p.subjects?.name ?? p.subject ?? '—';

  // ===== Ai đã tự đánh dấu =====
  // Đọc homework_done theo ĐÚNG vai (policy ở 0061):
  //   • GVCN/admin  → cả lớp, để biết còn bao nhiêu em chưa đụng tới bài.
  //   • học sinh    → chỉ dòng của chính em (tick của bạn khác không hiện, và cũng không hỏi).
  //   • phụ huynh   → chỉ con mình.
  //   • hiệu trưởng → KHÔNG hỏi bảng này. Policy cố ý loại BGH ("em A chưa làm bài ngày 12/9" là
  //     bản ghi hành vi của từng đứa trẻ); hỏi cũng chỉ nhận rỗng rồi tưởng là lỗi.
  const demTheoBai = new Map<string, number>();
  const daDanhDau = new Set<string>();
  let siSo = 0;
  if (postIds.length > 0) {
    if (canManage) {
      const [{data: doneRows}, {count}] = await Promise.all([
        supabase.from('homework_done').select('post_id').in('post_id', postIds),
        supabase
          .from('enrollments')
          .select('student_id', {count: 'exact', head: true})
          .eq('class_id', myClass.id)
          .eq('is_active', true),
      ]);
      for (const r of doneRows ?? []) demTheoBai.set(r.post_id, (demTheoBai.get(r.post_id) ?? 0) + 1);
      siSo = count ?? 0;
    } else if (laHocSinh || (laPhuHuynh && conDangXem)) {
      const ai = laHocSinh ? profile.id : conDangXem!.id;
      const {data} = await supabase
        .from('homework_done')
        .select('post_id')
        .eq('student_id', ai)
        .in('post_id', postIds);
      for (const r of data ?? []) daDanhDau.add(r.post_id);
    }
  }

  // Gom theo ngày. posts đã sắp ngày giảm dần nên chỉ cần so với nhóm cuối, không phải sắp lại.
  const nhom: {ngay: string; bai: Post[]}[] = [];
  for (const p of posts) {
    const cuoi = nhom[nhom.length - 1];
    if (cuoi && cuoi.ngay === p.date) cuoi.bai.push(p);
    else nhom.push({ngay: p.date, bai: [p]});
  }

  // Bài đang sửa (?edit=<id>) — theo đúng lối ?editWig của /wig, ?editSlot của /timetable.
  const editing = canManage && editId ? posts.find((p) => p.id === editId) ?? null : null;

  // Mọi link nội bộ phải bảo toàn ?class= (ClassPicker) và ?child= (bộ chọn con).
  const href = (extra: Record<string, string> = {}) => ({
    pathname: '/homework' as const,
    query: {
      ...(classParam ? {class: classParam} : {}),
      ...(childParam ? {child: childParam} : {}),
      ...extra,
    },
  });

  const chipCls = 'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold';
  const editLinkCls =
    'cursor-pointer rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2 py-1 text-[11px] font-extrabold text-navy transition-all hover:border-navy';
  const xoaCls =
    'cursor-pointer rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] px-2 py-1 text-[11px] font-extrabold text-status-bad transition-all hover:bg-status-bad/[0.16]';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title', {class: myClass.name})}
        </h1>
        {accessible.length > 1 && <ClassPicker classes={accessible} current={myClass.id} />}
      </div>

      <Flash />

      {/* Phụ huynh nhiều con (có thể ở nhiều lớp) → chọn con để xem báo bài của lớp con đó.
          Cùng kiểu chip với trang Báo cáo để phụ huynh không phải học lại thao tác mới. */}
      {laPhuHuynh && children.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {children.map((c) => (
            <Link
              key={c.id}
              href={{pathname: '/homework', query: {child: c.id}}}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
                c.id === conDangXem?.id
                  ? 'border-navy bg-navy text-white'
                  : 'border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
              }`}
            >
              {c.name}
              {c.className ? ` · ${c.className}` : ''}
            </Link>
          ))}
        </div>
      )}

      {/* Nói rõ tinh thần của ô đánh dấu NGAY TRÊN danh sách, trước khi em bấm nút đầu tiên. */}
      {laHocSinh && (
        <p className="text-[12px] font-semibold leading-[1.55] text-grey-mid">
          {t('noteStudent')}
          hạng hay so sánh với bạn. Chỉ mình em, thầy cô chủ nhiệm và bố mẹ nhìn thấy; các bạn khác
          thì không.
        </p>
      )}
      {laPhuHuynh && (
        <p className="text-[12px] font-semibold leading-[1.55] text-grey-mid">
          {t('noteParent')}
          phải điểm — nên bố mẹ xem được nhưng không đánh dấu thay con.
        </p>
      )}
      {profile.role === 'principal' && (
        <p className="text-[12px] font-semibold leading-[1.55] text-grey-mid">
          {t('notePrincipal')}
        </p>
      )}

      {/* GVCN/Admin: đăng bài mới, hoặc sửa bài đang chọn.
          key ép remount khi đổi bài đang sửa → form nạp lại đúng nội dung bài mới. */}
      {canManage &&
        (monLop.length === 0 ? (
          /* Lớp CHƯA khai môn nào → ô chọn môn sẽ rỗng, mà rỗng thì không đăng nổi bài nào. Đừng
             hiện form chết: nói thẳng phải làm gì, và đặt sẵn nút làm hộ. RPC seed_class_subjects
             gieo cả bộ môn đang dùng của cơ sở, gọi lại bao nhiêu lần cũng an toàn. */
          <div className="glass rounded-[16px] p-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="min-w-[240px] flex-1 text-[12.5px] font-semibold leading-[1.55] text-txt">
                {t('noSubjects')}
                thêm cả bộ môn của cơ sở vào chương trình lớp, rồi đăng bài như thường.
              </p>
              <form action={seedSubjects}>
                <input type="hidden" name="class_id" value={myClass.id} />
                <SubmitButton className={btnGold} wrapClass="contents">
                  {t('seedSubjects')}
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : (
          <HomeworkForm
            key={editing?.id ?? 'new'}
            classId={myClass.id}
            today={today}
            subjects={monLop}
            post={
              editing
                ? {
                    id: editing.id,
                    date: editing.date,
                    subject_id: editing.subject_id,
                    subjectName: tenMon(editing),
                    content: editing.content,
                    due_date: editing.due_date,
                    kind: editing.kind,
                  }
                : null
            }
          />
        ))}

      {posts.length === 0 ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            {canManage
              ? t('emptyManage')
              : t('empty')}
          </p>
        </div>
      ) : (
        nhom.map((g) => (
          <section key={g.ngay} className="glass rounded-[20px] p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-[15px] font-bold text-navy">{nhanNgay(g.ngay, t)}</h2>
              {g.ngay === today && (
                <span className={`${chipCls} bg-gold/20 text-navy`}>{t('today')}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {g.bai.map((p) => {
                const xong = daDanhDau.has(p.id);
                // Học sinh: bài CHƯA tự đánh dấu được làm nổi hơn — mở app buổi tối là thấy ngay
                // còn việc gì, không phải đọc lại từng bài.
                const vien =
                  laHocSinh && !xong
                    ? 'border-gold/50 bg-gold/[0.07]'
                    : 'border-navy/[0.08] bg-navy/[0.02]';
                return (
                  <article key={p.id} className={`rounded-[12px] border-[1.5px] px-3 py-2.5 ${vien}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`${chipCls} ${CHIP_LOAI[p.kind]}`}>{t(`kinds.${p.kind}`)}</span>
                      <span className="min-w-0 truncate text-[13.5px] font-bold text-navy">
                        {tenMon(p)}
                      </span>
                      {p.due_date && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-extrabold text-gold-text">
                          <CalendarClock size={12} strokeWidth={2.5} />
                          {t('dueOn', {date: ngayNgan(p.due_date)})}
                        </span>
                      )}
                      {canManage && (
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          <Link href={href({edit: p.id})} className={editLinkCls}>
                            {t('edit')}
                          </Link>
                          <form action={deletePost}>
                            <input type="hidden" name="class_id" value={myClass.id} />
                            <input type="hidden" name="id" value={p.id} />
                            <ConfirmButton
                              message={t('confirmDelete', {kind: t(`kinds.${p.kind}`).toLowerCase(), subject: tenMon(p), date: ngayNgan(p.date)})}
                              className={xoaCls}
                            >
                              {t('delete')}
                            </ConfirmButton>
                          </form>
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 whitespace-pre-line text-[13px] font-semibold leading-[1.6] text-txt">
                      {p.content}
                    </p>

                    {/* GVCN: bao nhiêu em đã TỰ đánh dấu. Cố ý không nêu tên em nào ở đây —
                        con số là để biết trước tiết, không phải để đọc tên trước lớp. */}
                    {canManage && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-bold text-grey-mid">
                        <Users size={12} strokeWidth={2.5} />
                        {t('doneCountLabel')}{' '}
                        <b className="font-display text-navy">
                          {demTheoBai.get(p.id) ?? 0}
                          <span className="text-grey-mid">/{siSo}</span>
                        </b>{' '}
                        {t('doneCountUnit')}
                      </div>
                    )}

                    {/* Học sinh: tự đánh dấu / bỏ đánh dấu. Bấm là đảo trạng thái hiện tại. */}
                    {laHocSinh && (
                      <form action={toggleDone} className="mt-2">
                        <input type="hidden" name="class_id" value={myClass.id} />
                        <input type="hidden" name="post_id" value={p.id} />
                        <input type="hidden" name="done" value={xong ? '1' : '0'} />
                        <SubmitButton className={xong ? btnGhost : btnGold}>
                          {xong ? (
                            <>
                              <Check size={14} strokeWidth={2.5} />
                              {t('undoDone')}
                            </>
                          ) : (
                            <>
                              <Circle size={14} strokeWidth={2.5} />
                              {t('markDone')}
                            </>
                          )}
                        </SubmitButton>
                      </form>
                    )}

                    {/* Phụ huynh: con đã tự đánh dấu chưa. Chỉ để biết, không có nút. */}
                    {laPhuHuynh && conDangXem && (
                      <div
                        className={`mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-bold ${
                          xong ? 'text-success-dark' : 'text-grey-mid'
                        }`}
                      >
                        {xong ? (
                          <Check size={12} strokeWidth={2.5} />
                        ) : (
                          <Circle size={12} strokeWidth={2.5} />
                        )}
                        {xong
                          ? t('childDone', {name: conDangXem.name})
                          : t('childNotDone', {name: conDangXem.name})}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {posts.length >= SO_BAI_TAI && (
        <p className="text-[11px] italic text-grey-mid">
          Đang hiện {SO_BAI_TAI} bài gần nhất của lớp.
        </p>
      )}
    </div>
  );
}
