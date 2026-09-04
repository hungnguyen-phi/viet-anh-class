'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Building2, ChevronRight, Plus} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {gradeNumbersFor, levelLabels, type SchoolLevel} from '@/lib/levels';
import {LevelPicker} from './LevelPicker';
import {deleteCampus, deleteClass, setCampusActive, setClassActive, updateCampus, updateClass} from './actions';
import {GradeManager} from './GradeManager';
import {CampusForm} from './CampusForm';
import {ClassForm} from './ClassForm';

type Campus = {id: string; name: string; code: string; levels: SchoolLevel[]};
type Grade = {id: string; name: string; campus_id: string; sort_order: number};
type GradeOption = {id: string; name: string; campus_id: string; is_active: boolean};
type ClassRow = {
  id: string;
  name: string;
  grade_id: string | null;
  grade: string | null;
  school_year: string;
  campus_id: string;
  homeroom_teacher_id: string | null;
  /** Số WIG và số học sinh đang gắn với lớp — quyết định lớp có xoá được hay không. */
  soWig: number;
  soHocSinh: number;
};
type Teacher = {id: string; full_name: string | null; email: string};

const inp =
  'min-w-0 rounded-[8px] border-[1.5px] border-navy/15 bg-white px-2.5 py-1.5 text-than font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[8px] bg-navy px-2.5 text-chu-thich font-extrabold text-white transition-all hover:bg-navy-700';
const ghost =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[8px] border-[1.5px] border-navy/20 bg-white px-2.5 text-chu-thich font-extrabold text-navy transition-all hover:border-navy';
const gold =
  'btn-gold h-8 shrink-0 inline-flex items-center cursor-pointer whitespace-nowrap rounded-[8px] px-2.5 text-chu-thich font-extrabold transition-all';
// Pha từ chính token --color-status-bad thay vì gõ lại rgba(192,57,43,…): đổi màu trạng thái hỏng
// một chỗ là đổi cả app, không phải đi tìm ba con số ấy nằm rải ở đâu. Cùng cách ConfirmButton làm.
const danger =
  'h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-[8px] bg-[color-mix(in_srgb,var(--color-status-bad)_12%,transparent)] px-2.5 text-chu-thich font-extrabold text-status-bad transition-all hover:bg-[color-mix(in_srgb,var(--color-status-bad)_22%,transparent)]';
const subLabel = 'text-nhan font-extrabold uppercase tracking-wide text-grey-mid';

// CÂY CƠ SỞ → KHỐI → LỚP.
//
// Bản cũ chia cùng một cấu trúc ra ba khối rời nhau trên trang: một thẻ "Tạo cơ sở" đứng riêng ở
// trên, một khối "Cơ sở & Khối", rồi một BẢNG LỚP phẳng có ô lọc cơ sở ở tận dưới. Nên trả lời
// câu hỏi đơn giản nhất của người quản trị — "cơ sở này đang có những lớp nào" — phải cuộn qua
// nửa trang rồi chọn lại đúng cơ sở ấy lần thứ hai trong một ô lọc khác.
//
// Nay: mỗi cơ sở là một mục cha gấp/mở được, khối và lớp là mục con nằm bên trong, và nút thêm
// nằm ngay trong mục nó thuộc về (thêm khối trong khối, thêm lớp trong lớp, thêm cơ sở ở đầu
// danh sách) thay vì là những thẻ riêng trôi nổi bên ngoài.
export function CampusTree({
  campuses,
  grades,
  allGrades,
  classes,
  teachers,
  defaultYear,
}: {
  campuses: Campus[];
  grades: Grade[];
  allGrades: GradeOption[];
  classes: ClassRow[];
  teachers: Teacher[];
  defaultYear: string;
}) {
  const t = useTranslations('admin');
  const [adding, setAdding] = useState(false);
  // Một cơ sở thì mở sẵn (gấp lại chẳng giấu được gì); nhiều cơ sở thì đóng hết để nhìn được
  // toàn cảnh trước khi đi vào một cái.
  const [openIds, setOpenIds] = useState<string[]>(campuses.length === 1 ? [campuses[0].id] : []);

  const gradesByCampus = useMemo(() => {
    const m = new Map<string, Grade[]>();
    for (const g of grades) m.set(g.campus_id, [...(m.get(g.campus_id) ?? []), g]);
    // Khối theo thứ tự khối, không theo thứ tự vừa thêm.
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'));
    return m;
  }, [grades]);

  const classesByCampus = useMemo(() => {
    const order = new Map(grades.map((g) => [g.id, g.sort_order]));
    const m = new Map<string, ClassRow[]>();
    for (const c of classes) m.set(c.campus_id, [...(m.get(c.campus_id) ?? []), c]);
    // XẾP THEO KHỐI RỒI TỚI TÊN LỚP. Trước đây lớp mới luôn rơi xuống cuối bảng theo thứ tự tạo,
    // nên một trường thêm lớp 1C giữa năm thì nó nằm sau lớp 5A — danh sách không còn đọc được
    // như một cuốn sổ nữa.
    for (const arr of m.values())
      arr.sort(
        (a, b) =>
          (order.get(a.grade_id ?? '') ?? 999) - (order.get(b.grade_id ?? '') ?? 999) ||
          a.name.localeCompare(b.name, 'vi'),
      );
    return m;
  }, [classes, grades]);

  const toggle = (id: string) =>
    setOpenIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    // Khung và tiêu đề do Disclosure bên ngoài lo (AdminSections) — mục này gấp lại được như
    // mọi mục khác của trang. Ở đây chỉ còn nút thêm cơ sở và cây.
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => setAdding((v) => !v)} className={ghost}>
          <span className="inline-flex items-center gap-1">
            <Plus size={14} strokeWidth={2.5} />
            {t('createCampus')}
          </span>
        </button>
      </div>

      {/* Thêm cơ sở NGAY TRONG mục cơ sở, không phải một thẻ riêng ở đầu trang. */}
      {adding && (
        // THẺ TRONG THẺ TRONG THẺ là cách nhanh nhất để một trang quản trị trông rối. Khối "thêm
        // mới" ở đây chỉ cần tách khỏi danh sách, không cần khung riêng — dùng vạch ngăn + nền
        // nhạt, đúng cách GradeManager đang làm ở tầng dưới.
        <div className="mb-3 border-y border-navy/[0.08] bg-navy/[0.02] px-1 py-3">
          <div className={`mb-2 ${subLabel}`}>{t('createCampus')}</div>
          <CampusForm />
        </div>
      )}

      {campuses.length === 0 ? (
        <div className="rounded-[12px] border-[1.5px] border-navy/10 px-[13px] py-[9px] text-than text-grey-mid">
          {t('none')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {campuses.map((c) => (
            <CampusNode
              key={c.id}
              campus={c}
              open={openIds.includes(c.id)}
              onToggle={() => toggle(c.id)}
              grades={gradesByCampus.get(c.id) ?? []}
              classes={classesByCampus.get(c.id) ?? []}
              allCampuses={campuses}
              allGrades={allGrades}
              teachers={teachers}
              defaultYear={defaultYear}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- MỤC CHA: một cơ sở ----------
function CampusNode({
  campus,
  open,
  onToggle,
  grades,
  classes,
  allCampuses,
  allGrades,
  teachers,
  defaultYear,
}: {
  campus: Campus;
  open: boolean;
  onToggle: () => void;
  grades: Grade[];
  classes: ClassRow[];
  allCampuses: Campus[];
  allGrades: GradeOption[];
  teachers: Teacher[];
  defaultYear: string;
}) {
  const t = useTranslations('admin');
  const [edit, setEdit] = useState(false);
  const [suaLevels, setSuaLevels] = useState<SchoolLevel[]>(campus.levels);
  const [addingClass, setAddingClass] = useState(false);
  const [editClassId, setEditClassId] = useState<string | null>(null);

  return (
    <div className="rounded-[16px] border-[1.5px] border-navy/10 bg-white/50">
      {/* Hàng tiêu đề cơ sở */}
      {edit ? (
        <form action={updateCampus} className="flex flex-wrap items-center gap-1.5 p-3">
          <input type="hidden" name="id" value={campus.id} />
          <input name="name" aria-label={t('name')} defaultValue={campus.name} className={`${inp} flex-1`} required />
          <input name="code" aria-label={t('code')} defaultValue={campus.code} className={`${inp} w-24`} required />
          {/* Thêm cấp sẽ SINH THÊM khối chuẩn của cấp mới (trigger campus_seed_grades). Bỏ một cấp
              thì KHÔNG xoá khối cũ — lớp đang trỏ vào chúng vẫn nguyên; dọn là việc có ý thức. */}
          <div className="w-full" title={t('levelHint')}>
            <LevelPicker value={suaLevels} onChange={setSuaLevels} />
          </div>
          <SubmitButton className={navyBtn} wrapClass="contents">
            {t('save')}
          </SubmitButton>
          <button type="button" onClick={() => setEdit(false)} className={ghost}>
            {t('cancel')}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            // flex-wrap: KHÔNG phải để cho đẹp.
            //
            // Hàng này có bốn thứ nối đuôi nhau — tên cơ sở, mã, nhãn cấp học, "7 khối · 3 lớp" —
            // và trước đây không thứ nào được phép xuống dòng. Trên máy 360px, audit đo được
            // "THCS · THPT" thò ra 57px và "7 khối · 3 lớp" thò ra 129px: chúng tràn khỏi nút và
            // ĐÈ LÊN ba nút Sửa / Lưu trữ / Xoá ngay bên phải — chữ chồng chữ, bấm Sửa có thể
            // trúng Xoá. Cho xuống dòng là hết, và trên màn rộng thì thừa chỗ nên không đổi gì.
            className="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-left"
          >
            <ChevronRight
              size={16}
              strokeWidth={2.5}
              className={`shrink-0 text-grey-mid transition-transform ${open ? 'rotate-90' : ''}`}
            />
            <Building2 size={16} strokeWidth={2} className="shrink-0 text-gold-deep" />
            <span className="truncate font-display text-doc font-bold text-navy">{campus.name}</span>
            <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-bold text-grey-mid">
              {campus.code}
            </span>
            {campus.levels.length > 0 ? (
              // Hiện ĐỦ các cấp. Trước đây chỗ này chỉ vẽ được một cấp nên cơ sở dạy cả THCS lẫn
              // THPT hiện ra là "THPT" — nhãn nói sai về chính dữ liệu ngay bên dưới nó.
              <span className="rounded-full bg-gold/[0.18] px-2 py-0.5 text-chu-thich font-bold text-navy">
                {levelLabels(campus.levels, t)}
              </span>
            ) : (
              // Chưa khai cấp học thì chưa sinh được khối nào → nói thẳng việc cần làm.
              <span className="rounded-full bg-status-bad/[0.10] px-2 py-0.5 text-chu-thich font-bold text-status-bad">
                {t('noLevel')}
              </span>
            )}
            <span className="whitespace-nowrap text-chu-thich font-semibold text-grey-mid">
              {grades.length} {t('gradesShort')} · {classes.length} {t('classesShort')}
            </span>
          </button>
          <span className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setEdit(true)} className={ghost}>
              {t('edit')}
            </button>
            <form action={setCampusActive}>
              <input type="hidden" name="id" value={campus.id} />
              <input type="hidden" name="active" value="false" />
              <SubmitButton className={ghost} wrapClass="contents">
                {t('archive')}
              </SubmitButton>
            </form>
            <form action={deleteCampus}>
              <input type="hidden" name="id" value={campus.id} />
              <ConfirmButton message={t('confirmDeleteCampus')} className={danger}>
                {t('delete')}
              </ConfirmButton>
            </form>
          </span>
        </div>
      )}

      {/* Mục con: KHỐI và LỚP */}
      {open && (
        <div className="border-t border-navy/[0.08] px-3 pb-3">
          {/* Khối — GradeManager giữ nguyên (có sẵn thêm/sửa/lưu-trữ/xoá bên trong). */}
          <GradeManager campusId={campus.id} grades={grades} levels={campus.levels} />
          {campus.levels.length > 0 && gradeNumbersFor(campus.levels) == null && grades.length === 0 && (
            <p className="mt-1 text-chu-thich font-semibold italic text-grey-mid">{t('manualGradeHint')}</p>
          )}

          {/* Lớp của chính cơ sở này */}
          <div className="mt-3 border-t border-navy/[0.08] pt-2.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className={subLabel}>
                {t('classes')} ({classes.length})
              </span>
              <button
                type="button"
                onClick={() => setAddingClass((v) => !v)}
                className={`${ghost} ml-auto`}
              >
                <span className="inline-flex items-center gap-1">
                  <Plus size={14} strokeWidth={2.5} />
                  {t('createClass')}
                </span>
              </button>
            </div>

            {addingClass && (
              <div className="mb-2 border-y border-navy/[0.08] bg-navy/[0.02] px-1 py-2.5">
                {/* Cơ sở đã biết → không bắt chọn lại. */}
                <ClassForm
                  campuses={allCampuses.map((c) => ({id: c.id, name: c.name}))}
                  grades={grades.map((g) => ({id: g.id, name: g.name, campus_id: g.campus_id}))}
                  teachers={teachers}
                  defaultYear={defaultYear}
                  fixedCampusId={campus.id}
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              {classes.map((c) => {
                // Lớp còn dữ liệu thì không xoá được — tính một lần ở đây để cả chip lẫn nút dùng
                // chung một sự thật, thay vì mỗi chỗ tự suy ra một kiểu.
                const coDuLieu = c.soWig > 0 || c.soHocSinh > 0;
                const lyDoKhongXoa = t('cannotDeleteClass', {wig: c.soWig, hs: c.soHocSinh});
                return (
                <div key={c.id}>
                  <div className="flex flex-wrap items-center gap-2 rounded-[12px] px-1.5 py-1.5 transition-colors hover:bg-navy/[0.03]">
                    <span className="min-w-0 flex-1 truncate text-than font-bold text-navy">{c.name}</span>
                    {/* Hiện SỐ LIỆU ĐANG GIỮ ngay trên dòng: đây là thứ quyết định lớp có xoá được
                        hay không, nên nó phải nhìn thấy được TRƯỚC khi người ta với tay tới nút. */}
                    {coDuLieu && (
                      <span className="whitespace-nowrap rounded-full bg-navy/[0.06] px-2 py-0.5 text-chu-thich font-bold text-grey-mid">
                        {c.soWig > 0 && t('classHasData', {n: c.soWig})}
                        {c.soWig > 0 && c.soHocSinh > 0 && ' · '}
                        {c.soHocSinh > 0 && t('classHasStudents', {n: c.soHocSinh})}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-chu-thich font-semibold text-grey-mid">
                      {c.grade ?? t('noGrade')} · {c.school_year}
                    </span>
                    <span className="min-w-0 max-w-[180px] flex-1 truncate text-chu-thich font-semibold text-grey-mid">
                      {c.homeroom_teacher_id
                        ? teachers.find((p) => p.id === c.homeroom_teacher_id)?.full_name ??
                          teachers.find((p) => p.id === c.homeroom_teacher_id)?.email ??
                          t('gvcnRoleChanged')
                        : t('notAssigned')}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <Link href={`/admin/class/${c.id}`} className={gold}>
                        {t('detail')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditClassId(editClassId === c.id ? null : c.id)}
                        className={ghost}
                      >
                        {t('edit')}
                      </button>
                      <form action={setClassActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value="false" />
                        <SubmitButton className={ghost} wrapClass="contents">
                          {t('archive')}
                        </SubmitButton>
                      </form>
                      {/* NÚT XOÁ PHẢI NÓI TRƯỚC LÀ NÓ KHÔNG XOÁ ĐƯỢC.
                          deleteClass từ chối xoá lớp còn WIG hoặc còn học sinh — và từ chối là
                          đúng, vì xoá lớp sẽ kéo theo toàn bộ WIG và lịch sử tick của các em.
                          Nhưng trước đây giao diện giấu chuyện đó: nút trông y như xoá được, hộp
                          thoại vẫn hỏi "chắc chưa", bấm đồng ý xong mới hiện một dòng đỏ thoáng
                          qua. Chủ dự án đã tưởng mình xoá hết lớp trong khi còn nguyên bốn lớp.
                          Nay: nút mờ đi, và hover/đọc màn hình đều nghe được LÝ DO cùng lối ra. */}
                      {coDuLieu ? (
                        <button
                          type="button"
                          disabled
                          title={lyDoKhongXoa}
                          aria-label={lyDoKhongXoa}
                          className={`${danger} cursor-not-allowed opacity-40`}
                        >
                          ✕
                        </button>
                      ) : (
                        <form action={deleteClass}>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmButton
                            message={t('confirmDeleteClass')}
                            label={t('deleteClassFor', {name: c.name})}
                            className={danger}
                          >
                            ✕
                          </ConfirmButton>
                        </form>
                      )}
                    </span>
                  </div>

                  {editClassId === c.id && (
                    <ClassInlineEdit
                      row={c}
                      campuses={allCampuses.map((x) => ({id: x.id, name: x.name}))}
                      grades={allGrades}
                      teachers={teachers}
                      onDone={() => setEditClassId(null)}
                    />
                  )}
                </div>
                );
              })}
              {classes.length === 0 && (
                <div className="px-1.5 py-1 text-chu-thich font-semibold text-grey-mid">{t('noClass')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Form sửa 1 lớp, mở ngay dưới dòng lớp ----------
// Select Cơ sở ↔ Khối liên kết (đổi cơ sở thì reset khối).
function ClassInlineEdit({
  row,
  campuses,
  grades,
  teachers,
  onDone,
}: {
  row: ClassRow;
  campuses: {id: string; name: string}[];
  grades: GradeOption[];
  teachers: Teacher[];
  onDone: () => void;
}) {
  const t = useTranslations('admin');
  const [campusId, setCampusId] = useState(row.campus_id);
  const [gradeId, setGradeId] = useState(row.grade_id ?? '');
  // Giữ khối đang gắn của lớp trong danh sách kể cả khi đã lưu-trữ → tránh lưu mất khối (audit #3).
  const gradeOptions = useMemo(
    () => grades.filter((g) => g.campus_id === campusId && (g.is_active || g.id === row.grade_id)),
    [grades, campusId, row.grade_id],
  );

  return (
    <form
      action={updateClass}
      className="mt-1 grid gap-2 border-y border-navy/[0.08] bg-navy/[0.02] px-1 py-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"
    >
      <input type="hidden" name="id" value={row.id} />
      <label className={`flex flex-col gap-1 ${subLabel}`}>
        {t('name')}
        <input name="name" aria-label={t('name')} defaultValue={row.name} className={inp} required />
      </label>
      <label className={`flex flex-col gap-1 ${subLabel}`}>
        {t('schoolYear')}
        <input
          name="school_year"
          aria-label={t('schoolYear')}
          defaultValue={row.school_year}
          className={inp}
          required
        />
      </label>
      <label className={`flex flex-col gap-1 ${subLabel}`}>
        {t('campus')}
        <select
          name="campus_id"
          aria-label={t('campus')}
          value={campusId}
          onChange={(e) => {
            setCampusId(e.target.value);
            setGradeId('');
          }}
          className={`cursor-pointer ${inp}`}
        >
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`flex flex-col gap-1 ${subLabel}`}>
        {t('grade')}
        <select
          name="grade_id"
          aria-label={t('grade')}
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">{t('notAssigned')}</option>
          {gradeOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.is_active ? '' : ` (${t('archived')})`}
            </option>
          ))}
        </select>
      </label>
      <label className={`flex flex-col gap-1 ${subLabel}`}>
        {t('gvcn')}
        <select
          name="homeroom_teacher_id"
          aria-label={t('gvcn')}
          defaultValue={row.homeroom_teacher_id ?? ''}
          className={`cursor-pointer ${inp}`}
        >
          <option value="">{t('notAssigned')}</option>
          {/* GIỮ LẠI NGƯỜI ĐANG CHỦ NHIỆM DÙ HỌ KHÔNG CÒN TRONG DANH SÁCH.
              `teachers` chỉ gồm nhân sự đang có vai giáo viên/BGH/quản trị. Nếu người đang chủ
              nhiệm đã bị đổi vai (hoặc vô hiệu), họ biến mất khỏi danh sách — và một <select> có
              defaultValue không khớp option nào sẽ tự nhảy về option ĐẦU TIÊN, ở đây là "Chưa
              gán". Nên mở form ra sửa mỗi cái tên lớp rồi bấm Lưu là lớp mất chủ nhiệm, lặng lẽ. */}
          {row.homeroom_teacher_id && !teachers.some((p) => p.id === row.homeroom_teacher_id) && (
            <option value={row.homeroom_teacher_id}>{t('gvcnRoleChanged')}</option>
          )}
          {teachers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-1.5">
        <SubmitButton className={navyBtn}>{t('save')}</SubmitButton>
        <button type="button" onClick={onDone} className={ghost}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
