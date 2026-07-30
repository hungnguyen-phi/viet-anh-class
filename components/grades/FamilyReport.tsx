import {Link} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import type {Profile} from '@/lib/auth';
import {
  soVN,
  CONDUCT_LABEL,
  CONDUCT_CHIP,
  SCORE_KIND_LABEL,
  SCORE_KINDS,
  TERM_KINDS,
  TERM_KIND_LABEL,
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
  subject: string;
  kind: ScoreKind;
  ordinal: number;
  score: number;
  weight: number;
  taken_on: string | null;
};

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
    children = [{id: profile.id, name: profile.full_name ?? profile.email}];
  }

  const childId = childParam && children.some((c) => c.id === childParam) ? childParam : children[0]?.id;

  if (!childId) {
    return (
      <div className="glass rounded-[26px] p-10 text-center">
        <h1 className="font-display text-xl font-bold text-navy">Học bạ</h1>
        <p className="mt-2 text-sm text-grey-mid">
          Tài khoản này chưa được nối với học sinh nào. Nhờ giáo viên chủ nhiệm kiểm tra giúp.
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
  if (laPhuHuynh) {
    await supabase.rpc('log_audit', {
      p_action: 'view_child_grades',
      p_detail: {student_id: childId, term_id: chon?.term_id ?? null},
    });
  }

  let diem: ConDiem[] = [];
  let tbMon = new Map<string, number | null>();
  if (chon) {
    const [{data: scoreData}, {data: sumData}] = await Promise.all([
      supabase
        .from('subject_scores')
        .select('subject, kind, ordinal, score, weight, taken_on')
        .eq('review_id', chon.id),
      // Trung bình có hệ số LẤY TỪ VIEW, không tự nhân chia lại ở đây — hệ số lệch giữa màn hình
      // cô và màn hình phụ huynh là lỗi phụ huynh phát hiện trước nhà trường (0064).
      supabase
        .from('subject_term_summary_v')
        .select('subject, diem_trung_binh')
        .eq('review_id', chon.id),
    ]);
    diem = (scoreData ?? []) as ConDiem[];
    tbMon = new Map(
      (sumData ?? []).map((s) => [
        s.subject ?? '',
        s.diem_trung_binh === null ? null : Number(s.diem_trung_binh),
      ]),
    );
  }

  // Gom con điểm theo môn, trong môn thì xếp theo loại điểm (miệng → cuối kỳ) rồi tới lần thứ mấy
  // — đúng thứ tự sổ điểm giấy, để phụ huynh dò theo được.
  const theoMon = new Map<string, ConDiem[]>();
  for (const d of diem) {
    const list = theoMon.get(d.subject);
    if (list) list.push(d);
    else theoMon.set(d.subject, [d]);
  }
  for (const list of theoMon.values()) {
    list.sort((a, b) => SCORE_KINDS.indexOf(a.kind) - SCORE_KINDS.indexOf(b.kind) || a.ordinal - b.ordinal);
  }
  const monList = [...theoMon.keys()].sort((a, b) => a.localeCompare(b, 'vi'));

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
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-gold-deep">
              Học bạ
            </div>
            <h1 className="mt-0.5 font-display text-[27px] font-bold leading-tight text-navy">
              {children.find((c) => c.id === childId)?.name ?? 'Học sinh'}
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
                  Đợt đánh giá
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
                        TERM_KIND_LABEL[p.assessment_terms?.kind ?? 'hoc_ky_1']}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <span className="text-[10.5px] font-semibold italic text-grey-mid">Chỉ xem</span>
          </div>
        </div>
      </div>

      {!chon ? (
        <div className="glass rounded-[20px] p-8 text-center">
          <p className="text-sm text-grey-mid">
            Chưa có bảng điểm nào được công bố. Khi nhà trường tổng kết xong một đợt, bảng điểm sẽ
            hiện ở đây.
          </p>
        </div>
      ) : (
        <>
          {/* Điểm từng môn */}
          <section>
            <h2 className="mb-3 font-display text-[17px] font-bold text-navy">
              Điểm các môn
              {chon.assessment_terms?.name ? ` · ${chon.assessment_terms.name}` : ''}
            </h2>
            {monList.length === 0 ? (
              <div className="glass rounded-[20px] p-8 text-center">
                <p className="text-sm text-grey-mid">Đợt này chưa có con điểm nào.</p>
              </div>
            ) : (
              <div className="glass overflow-x-auto rounded-[20px]">
                <div className="flex min-w-[640px] items-center gap-2 bg-navy/[0.03] px-[18px] py-[10px]">
                  <span className="w-[140px] flex-none text-[11px] font-extrabold uppercase text-grey-mid">
                    Môn học
                  </span>
                  <span className="flex-1 text-[11px] font-extrabold uppercase text-grey-mid">
                    Các con điểm
                  </span>
                  <span className="w-[90px] flex-none text-center text-[11px] font-extrabold uppercase text-grey-mid">
                    Trung bình
                  </span>
                </div>
                {monList.map((mon) => (
                  <div
                    key={mon}
                    className="flex min-w-[640px] items-center gap-2 border-t border-navy/[0.08] px-[18px] py-2.5"
                  >
                    <span className="w-[140px] flex-none truncate text-[13.5px] font-bold text-navy">
                      {mon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                      {(theoMon.get(mon) ?? []).map((d) => (
                        <span
                          key={`${d.kind}-${d.ordinal}`}
                          title={`${SCORE_KIND_LABEL[d.kind]} lần ${d.ordinal} · hệ số ${d.weight}`}
                          className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-navy/15 bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-navy"
                        >
                          <span className="text-grey-mid">{SCORE_KIND_LABEL[d.kind]}</span>
                          {soVN(d.score)}
                          {d.weight > 1 && <span className="text-gold-deep">×{d.weight}</span>}
                        </span>
                      ))}
                    </span>
                    <span className="w-[90px] flex-none text-center font-display text-[16px] font-bold text-navy">
                      {soVN(tbMon.get(mon))}
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
              <h2 className="mb-3 font-display text-[17px] font-bold text-navy">Rèn luyện</h2>
              <div className="glass rounded-[20px] p-[18px] text-center">
                {chon.conduct ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-extrabold ${CONDUCT_CHIP[chon.conduct]}`}
                  >
                    {CONDUCT_LABEL[chon.conduct]}
                  </span>
                ) : (
                  <p className="text-xs italic text-grey-mid">Đợt này chưa xếp loại hạnh kiểm.</p>
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
                Nhận xét của giáo viên chủ nhiệm
              </h2>
              <div className="glass rounded-[20px] p-[18px]">
                {chon.comment ? (
                  <p className="text-[13px] leading-[1.7] font-semibold whitespace-pre-line text-txt">
                    {chon.comment}
                  </p>
                ) : (
                  <p className="text-xs italic text-grey-mid">Đợt này chưa có nhận xét.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
