'use client';

import {useState, type ReactNode} from 'react';
import {ngayVN} from '@/lib/dates';
import {useTranslations} from 'next-intl';
import {Check, CheckCircle2, Pencil, Plus, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost, btnGold} from '@/components/ui/Field';
import {FormMucTieu, type WigLop} from '@/components/student/FormMucTieu';
import {OSoDo} from '@/components/student/OSoDo';
import {DonutRing} from '@/components/charts/DonutRing';
import {
  duyetMucTieu,
  danhDauDaDat,
  xoaMucTieuCuaEm,
} from '@/app/[locale]/(dashboard)/student/actions';

// ════════════════════════════════════════════════════════════════════════════
// MỤC TIÊU CỦA CON — một thẻ nhỏ đọc trong ba giây, form nằm sau một cú bấm
// ════════════════════════════════════════════════════════════════════════════
//
// Đây là thứ thay cho khối "GVCN đặt WIG năm cho từng em" đã xoá ở 0100. Khác biệt không nằm ở
// giao diện mà ở việc AI CẦM BÚT: bản cũ cho cô một ô số đã điền sẵn `mục tiêu lớp ÷ sĩ số`; bản
// này hỏi CHÍNH EM ba câu, và chúng nằm trong hộp thoại FormMucTieu.
//
// Bản đầu để cả form nằm mở giữa màn của em. Hỏng hai đường: (1) đặt xong form vẫn mở, màn hình có
// đồng thời "đã gửi cô xem" và một form còn nguyên chữ; (2) mỗi ngày em vào tick việc hôm nay đều
// phải cuộn qua nửa màn hình ô trống. Nay mặc định chỉ có MỘT THẺ — câu mục tiêu, hạn, việc mỗi
// tuần — còn form thì mở ra khi thật sự cần sửa.
//
// TỪ 12/08/2026 KHỐI NÀY LÀ MỘT NỬA CỦA THẺ CHUNG, KHÔNG CÒN LÀ MỘT KHỐI RIÊNG.
// Nó đứng cạnh "Sổ của con" trong cùng một thẻ ở CUỐI trang, dưới ô tick. Lý do là thứ tự ưu
// tiên: đặt mục tiêu là việc mỗi học kỳ một lần, tick việc là việc mỗi ngày — mà bản cũ để cái
// một-lần nằm trên cùng còn cái mỗi-ngày nằm dưới ba khối. Nên ở đây không còn <section
// className="glass"> bọc ngoài (thẻ chung lo phần đó) và tiêu đề hạ xuống <h3>.
//
// NHÃN NĂM HỌC. `luuMucTieuCuaEm` ghi period='year', start_date = đầu năm học, và kẹp hạn không
// cho thò ra ngoài năm — tức mục tiêu của em SỐNG CẢ NĂM. Màn hình cũ không nói ra, nên nhìn vào
// tưởng là mục tiêu ngắn hạn và sinh câu hỏi "sao không có năm/tháng/tuần?". Nhịp tuần đã nằm ở
// "việc của con" với các thứ được bật; tầng năm/tháng/tuần thật thì thuộc về MỤC TIÊU LỚP
// (parent_wig_id, 3 tầng) — với học sinh, 0100 cố tình làm phẳng. Xem docs/MO_HINH_WIG.md §1.

export type MucTieuCuaEm = {
  id: string;
  kind: string;
  status: string;
  set_by: string | null;
  measure_by: string;
  title: string;
  baseline: number | null;
  target_value: number;
  unit: string;
  area: string;
  start_date: string;
  end_date: string;
  created_at: string;
  achieved_at: string | null;
  source_wig_id: string | null;
};

export type {WigLop};

/** Số đo tuần này của một mục tiêu đo-ngoài-app (0108). `ghi_luc` đã định dạng sẵn ở máy chủ. */
export type SoDoCuaTuan = {wig_id: string; gia_tri: number; vai_tro: string; ghi_luc: string | null};

// ── MỘT DANH SÁCH, MỘT LOẠI THẺ (16/08/2026) ──────────────────────────────────────────────────
//
// Chủ dự án: "tôi vẫn chưa thấy việc tạo ra mục tiêu riêng của bạn và mục tiêu của bạn có khác gì
// nhau mà lại thành 2 mục khác nhau, tôi cũng chưa thấy sự liên kết giữa việc làm đều và biểu đồ
// mục tiêu năm". Đúng cả hai. Bản trước bày hai khối với hai tiêu đề ("Mục tiêu của bạn" / "Mục
// tiêu riêng của bạn") cho hai thứ CÙNG HÌNH — đều là mục tiêu năm của em; còn vòng % thì nằm ở một
// khối khác đầu trang, việc để tick lại ở một khối khác nữa. Ba chỗ cho một cây.
//
// Nay: MỘT danh sách thẻ. Mỗi thẻ là một mục tiêu năm và mang đủ cây của nó:
//   tiêu đề · từ→đến · vòng %   ←  cam kết tuần này (+ đặt cam kết)  ←  việc để tick / điền số
// Phần "tuần này" do màn cha dựng và đưa vào theo id mục tiêu (`tuanNayTheoWig`) — thẻ chỉ là chỗ
// đứng. Học tập / riêng vẫn là hai `kind` ở CSDL (mỗi loại một, 0100), nhưng trên màn không còn là
// hai mục: nút "Thêm mục tiêu" tự biết còn loại nào để thêm.

export function MucTieuCuaCon({
  studentId,
  classId,
  mucTieu,
  wigLop,
  laChinhEm,
  canManage,
  namHoc,
  soDoTheoWig,
  tuanChuaChot,
  pctTheoWig,
  tuanNayTheoWig,
}: {
  studentId: string;
  classId: string;
  mucTieu: MucTieuCuaEm[];
  wigLop: WigLop[];
  laChinhEm: boolean;
  canManage: boolean;
  namHoc: string | null;
  soDoTheoWig: Record<string, SoDoCuaTuan>;
  tuanChuaChot: boolean;
  /** % tiến độ (wig_progress_v) theo id mục tiêu; thiếu = chưa có số. */
  pctTheoWig: Record<string, number>;
  /** Khối "tuần này" của từng mục tiêu, dựng ở màn cha: cam kết + việc để tick. */
  tuanNayTheoWig: Record<string, ReactNode>;
}) {
  const t = useTranslations('goal');
  const [bao, setBao] = useState('');
  const [moForm, setMoForm] = useState<null | 'academic' | 'personal'>(null);
  const hocTap = mucTieu.find((m) => m.kind === 'academic') ?? null;
  const rieng = mucTieu.find((m) => m.kind === 'personal') ?? null;
  // CÔ KHÔNG ĐẶT HỘ, KHÔNG SỬA, KHÔNG XOÁ (16/08/2026 — chủ dự án: "giáo viên chỉ có nút duyệt thôi, mọi
  // thứ khác đều chỉ xem"). Mọi động tác ghi ở đây là của chính em; cô còn đúng nút Duyệt.
  const canGhi = laChinhEm;
  // Còn loại nào chưa có thì mới có gì để thêm; học tập trước, riêng sau (§6.2 bước ④).
  const loaiThem: null | 'academic' | 'personal' = !hocTap ? 'academic' : !rieng ? 'personal' : null;
  const danhSach = [hocTap, rieng].filter(Boolean) as MucTieuCuaEm[];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {bao && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {bao}
        </p>
      )}

      {danhSach.map((mt) => (
        <TheMucTieu
          key={mt.id}
          mt={mt}
          studentId={studentId}
          laChinhEm={laChinhEm}
          canManage={canManage}
          soDo={soDoTheoWig[mt.id]}
          tuanChuaChot={tuanChuaChot}
          pct={pctTheoWig[mt.id]}
          tuanNay={tuanNayTheoWig[mt.id]}
          wigLop={wigLop}
          onSua={() => setMoForm(mt.kind === 'personal' ? 'personal' : 'academic')}
        />
      ))}

      {danhSach.length === 0 && (
        <p className="text-[12.5px] italic text-grey-mid">{canGhi ? t('hint') : t('none')}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canGhi && loaiThem && (
          <button type="button" onClick={() => setMoForm(loaiThem)} className={btnGold}>
            <Plus size={14} strokeWidth={2.5} />
            {t('addGoal')}
          </button>
        )}
        {namHoc && danhSach.length > 0 && (
          <span className="text-[11px] font-extrabold text-gold-text">{t('yearScope', {nam: namHoc})}</span>
        )}
      </div>

      {moForm && (
        <FormMucTieu
          studentId={studentId}
          classId={classId}
          kind={moForm}
          wigLop={wigLop}
          dangSua={moForm === 'personal' ? rieng : hocTap}
          laChinhEm={laChinhEm}
          onClose={() => setMoForm(null)}
          onDone={setBao}
        />
      )}
    </div>
  );
}

// MỘT THẺ MỤC TIÊU — dùng cho cả HỌC TẬP và RIÊNG. Một bản dùng chung thay vì hai khối chép tay:
// cửa sổ 24 giờ, đường duyệt, đích ghi-nhận-ngoài, nút xoá — mọi luật ở đây đều tinh tế.
function TheMucTieu({
  mt,
  studentId,
  laChinhEm,
  canManage,
  soDo,
  tuanChuaChot,
  pct,
  tuanNay,
  wigLop,
  onSua,
}: {
  mt: MucTieuCuaEm;
  wigLop: WigLop[];
  studentId: string;
  laChinhEm: boolean;
  canManage: boolean;
  soDo: SoDoCuaTuan | undefined;
  tuanChuaChot: boolean;
  pct: number | undefined;
  tuanNay: ReactNode;
  onSua: () => void;
}) {
  const t = useTranslations('goal');
  const canGhi = laChinhEm;
  const tenLopNguon = mt.source_wig_id ? (wigLop.find((w) => w.id === mt.source_wig_id)?.title ?? null) : null;
  // Em sửa/xoá mục tiêu CỦA MÌNH lúc nào cũng bấm được — sửa xong thì về chờ duyệt (0129); xoá thì
  // CSDL chặn nếu đã có tick (0131) và câu báo nói rõ. Cửa sổ 24 giờ không còn chắn ở giao diện.
  const emSuaDuoc = laChinhEm;

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border-[1.5px] border-navy/10 p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-extrabold text-navy">{mt.title}</span>
            {mt.status === 'sent' && (
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                {t('waiting')}
              </span>
            )}
            {mt.set_by === 'teacher' && (
              <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                {t('setByTeacher')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] font-semibold tabular-nums text-grey-mid">
            {t('fromToRange', {from: mt.baseline ?? 0, to: mt.target_value, unit: mt.unit, start: ngayVN(mt.start_date), due: ngayVN(mt.end_date)})}
          </p>
          {/* DÂY NỐI LÊN LỚP — nói ra, đừng để người ta đoán "300 bài lấy từ đâu": đây là phần em tự
              nhận góp vào mục tiêu năm của lớp (source_wig_id, 0100/0138). */}
          {tenLopNguon && (
            <p className="mt-0.5 text-[11.5px] font-semibold text-gold-text">{t('contributesTo', {title: tenLopNguon})}</p>
          )}
        </div>
        {/* VÒNG % NGAY TRÊN THẺ — đây là chỗ nối "việc làm đều" với "biểu đồ": tick dưới kia lên
            là vòng này lên. Đích ghi nhận ngoài (điểm, kg) thì không vẽ % (0101) — chỉ Đạt/Chưa. */}
        {mt.measure_by === 'manual' ? (
          <span
            className={`shrink-0 self-center rounded-full px-3 py-1 text-[12px] font-extrabold ${
              mt.achieved_at ? 'bg-success/15 text-success-dark' : 'bg-navy/[0.07] text-grey-mid'
            }`}
          >
            {mt.achieved_at ? t('achieved') : t('notYet')}
          </span>
        ) : (
          <div className="shrink-0">
            <DonutRing pct={pct ?? 0} color="var(--color-navy)" />
          </div>
        )}
      </div>

      {/* Số đo tuần (đích đo ngoài app, 0108) + đánh dấu đạt. */}
      {mt.measure_by === 'manual' && (
        <OSoDo
          wigId={mt.id}
          unit={mt.unit}
          soHienTai={soDo?.gia_tri ?? null}
          nguoiGhi={soDo?.vai_tro ?? null}
          ghiLuc={soDo?.ghi_luc ?? null}
          moKhoa={tuanChuaChot}
          canGhi={canGhi}
        />
      )}
      {mt.measure_by === 'manual' && canGhi && (
        <form action={danhDauDaDat} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="wig_id" value={mt.id} />
          <input type="hidden" name="student_id" value={studentId} />
          {mt.achieved_at ? (
            <>
              <input type="hidden" name="bo" value="1" />
              <SubmitButton
                className="inline-flex min-h-[24px] items-center py-1 text-[11.5px] font-extrabold text-navy underline"
                wrapClass="contents"
              >
                {t('undoAchieved')}
              </SubmitButton>
            </>
          ) : (
            <SubmitButton className={btnGhost} wrapClass="contents">
              <Check size={13} strokeWidth={3} />
              {t('markAchieved')}
            </SubmitButton>
          )}
        </form>
      )}

      {/* ── TUẦN NÀY: cam kết + việc — chính là cái nối mục tiêu năm với việc làm mỗi ngày ── */}
      {tuanNay}

      <div className="flex flex-wrap items-center gap-2">
        {canManage && mt.status === 'sent' && (
          <form action={duyetMucTieu}>
            <input type="hidden" name="wig_id" value={mt.id} />
            <input type="hidden" name="student_id" value={studentId} />
            <SubmitButton className={btnGold} wrapClass="contents">
              {t('approve')}
            </SubmitButton>
          </form>
        )}
        {emSuaDuoc && (
          <>
            <button type="button" onClick={onSua} className={btnGhost}>
              <Pencil size={13} strokeWidth={2.5} />
              {t('edit')}
            </button>
            <form
              action={xoaMucTieuCuaEm}
              onSubmit={(e) => {
                if (!window.confirm(t('confirmDelete'))) e.preventDefault();
              }}
            >
              <input type="hidden" name="wig_id" value={mt.id} />
              <input type="hidden" name="student_id" value={studentId} />
              <SubmitButton
                className="inline-flex min-h-11 cursor-pointer items-center gap-1 px-1.5 text-[12px] font-extrabold text-status-bad underline"
                wrapClass="contents"
              >
                <Trash2 size={13} strokeWidth={2.5} className="shrink-0" />
                {t('deleteGoal')}
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
