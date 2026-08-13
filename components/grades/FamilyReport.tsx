import {after} from 'next/server';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {tenHienThi} from '@/lib/ten-hien-thi';
import {
  soVN,
  CONDUCT_CHIP,
  SCORE_KINDS,
  TERM_KINDS,
  type Conduct,
  type ScoreKind,
  type TermKind,
} from '@/components/grades/labels';

type PhieuRow = {
  id: string;
  term_id: string;
  conduct: Conduct | null;
  conduct_score: number | null;
  comment: string | null;
  published_at: string | null;
  assessment_terms: {
    name: string;
    kind: TermKind;
    school_year: string;
    start_date: string | null;
  } | null;
  classes: {name: string} | null;
};

type ConDiem = {
  subject_id: string | null;
  /** Cột chữ CŨ (trước 0069). Chỉ dùng để cứu những dòng chưa kịp gắn subject_id — không bao giờ ghi. */
  subject: string | null;
  kind: ScoreKind;
  ordinal: number;
  score: number;
  weight: number;
  taken_on: string | null;
  subjects: {name: string; sort_order: number} | null;
};

/** Một môn trong bảng của gia đình: gom theo ID, chỉ hiện TÊN. */
type MonGom = {khoa: string; ten: string; thuTu: number; diem: ConDiem[]};

/**
 * Bảng điểm gửi GIA ĐÌNH — dùng chung cho phụ huynh và cho chính học sinh.
 *
 * Vì sao một khối cho hai vai: họ xem đúng một thứ (điểm + nhận xét + hạnh kiểm của MỘT em, chỉ
 * các đợt ĐÃ CÔNG BỐ). Khác nhau duy nhất là "em nào" — phụ huynh chọn con, học sinh là chính
 * mình. Migration 0064 cũng gộp hai vai này vào một hàm (review_visible_to_family) với đúng lý
 * do đó: tách ra chỉ tạo thêm một chỗ để quên `published_at`.
 *
 * Bản nháp KHÔNG lọt vào đây: RLS đã chặn, và ở đây lọc thêm một lần nữa cho rõ ý.
 */
export async function FamilyReport({
  profile,
  childParam,
  termParam,
}: {
  profile: Profile;
  childParam?: string;
  termParam?: string;
}) {
  const t = await getTranslations('grades');
  const supabase = await createClient();
  const laPhuHuynh = profile.role === 'parent';

  // ── Em nào ────────────────────────────────────────────────────────────────
  let children: {id: string; name: string}[];
  if (laPhuHuynh) {
    // RLS pl_parent_self chỉ trả link của chính họ — không cần (và không được) lọc theo parent_id.
    const {data: links} = await supabase
      .from('parent_links')
      .select('student_id, profiles!parent_links_student_id_fkey(full_name)');
    children = (
      (links ?? []) as unknown as {student_id: string; profiles: {full_name: string | null} | null}[]
    )
      .map((l) => ({id: l.student_id, name: l.profiles?.full_name ?? l.student_id}))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  } else {
    children = [{id: profile.id, name: tenHienThi(profile.full_name, profile.email)}];
  }

  const childId = childParam && children.some((c) => c.id === childParam) ? childParam : children[0]?.id;

  if (!childId) {
    return (
      <div className="glass rounded-[26px] p-10 text-center">
        <h1 className="font-display text-xl font-bold text-navy">{t('reportTitle')}</h1>
        <p className="mt-2 text-sm text-grey-mid">
          {t('noChildLinked')}
        </p>
      </div>
    );
  }

  const {data: phieuData} = await supabase
    .from('student_term_reviews')
    .select(
      'id, term_id, conduct, conduct_score, comment, published_at, ' +
        'assessment_terms!student_term_reviews_term_id_fkey(name, kind, school_year, start_date), ' +
        'classes!student_term_reviews_class_id_fkey(name)',
    )
    .eq('student_id', childId)
    .not('published_at', 'is', null);

  // Mới nhất lên trước: năm học giảm dần, trong cùng năm thì theo đúng thứ tự enum (giữa kỳ 1 →
  // cả năm) đảo lại. Không sắp bằng start_date vì cột đó được phép bỏ trống.
  const phieu = ((phieuData ?? []) as unknown as PhieuRow[]).sort((a, b) => {
    const na = a.assessment_terms?.school_year ?? '';
    const nb = b.assessment_terms?.school_year ?? '';
    if (na !== nb) return nb.localeCompare(na);
    return (
      TERM_KINDS.indexOf(b.assessment_terms?.kind ?? 'giua_ky_1') -
      TERM_KINDS.indexOf(a.assessment_terms?.kind ?? 'giua_ky_1')
    );
  });

  const chon = phieu.find((p) => p.term_id === termParam) ?? phieu[0] ?? null;

  // Ghi vết truy cập báo cáo nhạy cảm (DATA_GOVERNANCE §3) — giống hệt trang /report của phụ
  // huynh. Học sinh xem điểm của chính mình thì không ghi: em là chủ thể của dữ liệu, không phải
  // người ngoài truy cập.
  // KHÔNG await — xem lý do ở report/page.tsx: ghi log là việc của hệ thống, gia đình không việc
  // gì phải đứng chờ nó xong mới được xem điểm của con. after() chạy sau khi đã trả phản hồi.
  if (laPhuHuynh) {
    after(() => {
      void supabase.rpc('log_audit', {
        p_action: 'view_child_grades',
        p_detail: {student_id: childId, term_id: chon?.term_id ?? null},
      });
    });
  }

  let diem: ConDiem[] = [];
  let tbMon = new Map<string, number | null>();
  if (chon) {
    const [{data: scoreData}, {data: sumData}] = await Promise.all([
      // Tên môn lấy từ DANH MỤC qua subject_id (0069), không đọc cột chữ cũ nữa — trừ khi dòng
      // điểm đó có từ trước migration và chưa gắn được môn nào.
      supabase
        .from('subject_scores')
        .select('subject_id, subject, kind, ordinal, score, weight, taken_on, subjects(name, sort_order)')
        .eq('review_id', chon.id),
      // Trung bình có hệ số LẤY TỪ VIEW, không tự nhân chia lại ở đây — hệ số lệch giữa màn hình
      // cô và màn hình phụ huynh là lỗi phụ huynh phát hiện trước nhà trường (0064).
      supabase
        .from('subject_term_summary_v')
        .select('subject_id, diem_trung_binh')
        .eq('review_id', chon.id),
    ]);
    diem = (scoreData ?? []) as unknown as ConDiem[];
    tbMon = new Map(
      (sumData ?? [])
        .filter((s) => s.subject_id !== null)
        .map((s) => [
          s.subject_id as string,
          s.diem_trung_binh === null ? null : Number(s.diem_trung_binh),
        ]),
    );
  }

  // Gom con điểm theo MÔN (theo id, không theo tên — gom theo tên là cách "Ngữ văn"/"Ngữ Văn"
  // thành hai dòng), trong môn thì xếp theo loại điểm (miệng → cuối kỳ) rồi tới lần thứ mấy —
  // đúng thứ tự sổ điểm giấy, để phụ huynh dò theo được.
  const theoMon = new Map<string, MonGom>();
  for (const d of diem) {
    // Dòng cũ chưa gắn môn thì gom tạm theo chữ cũ, để điểm đã nhập không biến mất khỏi màn hình
    // của gia đình. Những dòng này không có trong view tổng kết nên cột trung bình sẽ là "—".
    const khoa = d.subject_id ?? `cu:${(d.subject ?? '').toLowerCase()}`;
    const nhom = theoMon.get(khoa);
    if (nhom) nhom.diem.push(d);
    else
      theoMon.set(khoa, {
        khoa,
        ten: d.subjects?.name ?? d.subject ?? t('unknownSubject'),
        // Môn trong danh mục xếp theo thứ tự của trường; dòng cũ chưa gắn môn dồn xuống cuối.
        thuTu: d.subjects?.sort_order ?? 9999,
        diem: [d],
      });
  }
  for (const nhom of theoMon.values()) {
    nhom.diem.sort(
      (a, b) => SCORE_KINDS.indexOf(a.kind) - SCORE_KINDS.indexOf(b.kind) || a.ordinal - b.ordinal,
    );
  }
  const monList = [...theoMon.values()].sort(
    (a, b) => a.thuTu - b.thuTu || a.ten.localeCompare(b.ten, 'vi'),
  );

  const linkDot = (termId: string) => ({
    pathname: '/grades' as const,
    query: {...(laPhuHuynh ? {child: childId} : {}), term: termId},
  });

  return (
    <div className="space-y-6">
      {/* Hero: em nào, lớp nào, đợt nào */}
      <div className="glass animate-rise rounded-[26px] p-6 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-gold-text">
              {t('reportTitle')}
            </div>
            <h1 className="mt-0.5 font-display text-[27px] font-bold leading-tight text-navy">
              {children.find((c) => c.id === childId)?.name ?? t('aStudent')}
            </h1>
            {chon?.classes?.name && (
              <p className="mt-1 text-[13px] font-bold text-txt">
                Lớp <b className="text-navy">{chon.classes.name}</b>
                {chon.assessment_terms?.school_year && (
                  <span className="text-grey-mid"> · {chon.assessment_terms.school_year}</span>
                )}
              </p>
            )}
          </div>
          <div className="ml-auto flex flex-col items-end gap-2">
            {children.length > 1 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {children.map((c) => (
                  <Link
                    key={c.id}
                    href={{pathname: '/grades', query: {child: c.id}}}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
                      c.id === childId
                        ? 'border-navy bg-navy text-white'
                        : 'border-navy/15 bg-navy/[0.02] text-navy hover:border-navy'
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            {phieu.length > 1 && (
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-grey-mid">
                  {t('termPickerLabel')}
                </span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {phieu.map((p) => (
                    <Link
                      key={p.id}
                      href={linkDot(p.term_id)}
                      className={`inline-flex h-8 items-center rounded-[10px] px-3 text-xs font-extrabold whitespace-nowrap text-navy transition-all ${
                        p.id === chon?.id
                          ? 'btn-gold border border-transparent'
                          : 'border-[1.5px] border-navy/20 bg-white/60 hover:border-navy'
                      }`}
                    >
                      {p.assessment_terms?.name ??
                        t(`termKinds.${p.assessment_terms?.kind ?? 'hoc_ky_1'}`)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <span className="text-[10.5px] font-semibold italic text-grey-mid">{t('viewOnly')}</span>
          </div>
        </div>
      </div>

      {!chon ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            {t('nothingPublished')}
            hiện ở đây.
          </p>
        </div>
      ) : (
        <>
          {/* Điểm từng môn */}
          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
              {t('scoresTitle')}
              {chon.assessment_terms?.name ? ` · ${chon.assessment_terms.name}` : ''}
            </h2>
            {monList.length === 0 ? (
              <div className="glass rounded-[20px] p-8 text-center">
                <p className="text-sm text-grey-mid">{t('noScoresInTerm')}</p>
              </div>
            ) : (
              <div className="glass overflow-x-auto rounded-[20px]">
                <div className="flex min-w-[640px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
                  <span className="w-[140px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
                    {t('thSubject')}
                  </span>
                  <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">
                    {t('thScores')}
                  </span>
                  <span className="w-[90px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid">
                    {t('thAverage')}
                  </span>
                </div>
                {monList.map((mon) => (
                  <div
                    key={mon.khoa}
                    className="flex min-w-[640px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5"
                  >
                    <span
                      title={mon.ten}
                      className="w-[140px] flex-none truncate text-[13.5px] font-bold text-navy"
                    >
                      {mon.ten}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      {mon.diem.map((d) => (
                        <span
                          key={`${d.kind}-${d.ordinal}`}
                          title={t('scoreTitle', {kind: t(`scoreKinds.${d.kind}`), ordinal: d.ordinal, weight: d.weight})}
                          className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-navy/15 bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-navy"
                        >
                          <span className="text-grey-mid">{t(`scoreKinds.${d.kind}`)}</span>
                          {soVN(d.score)}
                          {d.weight > 1 && <span className="text-gold-text">×{d.weight}</span>}
                        </span>
                      ))}
                    </span>
                    <span className="w-[90px] flex-none text-center font-display text-[16px] font-bold text-navy">
                      {soVN(tbMon.get(mon.khoa))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] italic text-grey-mid">
              Trung bình đã tính theo hệ số của từng loại điểm (×2, ×3 ghi ngay cạnh con điểm).
            </p>
          </section>

          {/* Hạnh kiểm + nhận xét của cô */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_1.6fr]">
            <section>
              <h2 className="mb-3 font-display text-[17px] font-bold text-navy">{t('conductSection')}</h2>
              <div className="glass rounded-[20px] p-[18px] text-center">
                {chon.conduct ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-extrabold ${CONDUCT_CHIP[chon.conduct]}`}
                  >
                    {t(`conducts.${chon.conduct}`)}
                  </span>
                ) : (
                  <p className="text-xs italic text-grey-mid">{t('noConductInTerm')}</p>
                )}
                {chon.conduct_score !== null && (
                  <p className="mt-2.5 text-[12.5px] font-semibold text-grey-mid">
                    Điểm rèn luyện:{' '}
                    <b className="font-display text-[16px] text-navy">{chon.conduct_score}</b>
                    /100
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
                {t('teacherComment')}
              </h2>
              <div className="glass rounded-[20px] p-[18px]">
                {chon.comment ? (
                  <p className="text-[13px] leading-[1.7] font-semibold whitespace-pre-line text-txt">
                    {chon.comment}
                  </p>
                ) : (
                  <p className="text-xs italic text-grey-mid">{t('noCommentInTerm')}</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
