'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, CheckCircle2, Pencil, Plus, Target, Trash2} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost, btnGold} from '@/components/ui/Field';
import {FormMucTieu, type WigLop} from '@/components/student/FormMucTieu';
import {OSoDo} from '@/components/student/OSoDo';
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
  end_date: string;
  created_at: string;
  achieved_at: string | null;
  source_wig_id: string | null;
  viec: {title: string; target_value: number; active_weekdays: number[] | null} | null;
};

export type {WigLop};

/** Số đo tuần này của một mục tiêu đo-ngoài-app (0108). `ghi_luc` đã định dạng sẵn ở máy chủ. */
export type SoDoCuaTuan = {wig_id: string; gia_tri: number; vai_tro: string; ghi_luc: string | null};

const CUA_SO_MS = 24 * 60 * 60 * 1000;

export function MucTieuCuaCon({
  studentId,
  classId,
  mucTieu,
  wigLop,
  laChinhEm,
  canManage,
  dayShort,
  namHoc,
  soDoTheoWig,
  mocThangTheoWig,
  tuanChuaChot,
}: {
  studentId: string;
  classId: string;
  mucTieu: MucTieuCuaEm[];
  wigLop: WigLop[];
  laChinhEm: boolean;
  canManage: boolean;
  dayShort: string[];
  // Nhãn năm học của lớp ("2026–2027") — để nói rõ mục tiêu này sống bao lâu. Không có lớp thì
  // thôi, đừng bịa một khoảng thời gian ra.
  namHoc: string | null;
  /** Số đo của tuần này, tra theo id mục tiêu. */
  soDoTheoWig: Record<string, SoDoCuaTuan>;
  /** Mốc THÁNG NÀY, tra theo id mục tiêu năm. Chỉ mục tiêu đếm bằng tick mới có. */
  mocThangTheoWig: Record<string, {target: number; unit: string}>;
  /** Lớp CHƯA bấm chốt buổi họp tuần này — còn ghi số được (0108). */
  tuanChuaChot: boolean;
}) {
  const [bao, setBao] = useState('');
  // HAI MỤC TIÊU, KHÔNG PHẢI MỘT. CSDL cho mỗi em đúng một `academic` và một `personal`
  // (wigs_em_uidx, 0100) và máy chủ đã nhận cả hai từ lâu — chỉ màn hình này là chưa bao giờ hỏi
  // tới cái thứ hai, nên "mục tiêu của riêng con" (§6.2 bước ④) không có đường nào đi tới.
  const hocTap = mucTieu.find((m) => m.kind === 'academic') ?? null;
  const rieng = mucTieu.find((m) => m.kind === 'personal') ?? null;

  const chung = {studentId, classId, wigLop, laChinhEm, canManage, dayShort, namHoc,
                 soDoTheoWig, mocThangTheoWig,
                 tuanChuaChot, onBao: setBao};

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {bao && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {bao}
        </p>
      )}
      <MotMucTieu kind="academic" mt={hocTap} {...chung} />
      <MotMucTieu kind="personal" mt={rieng} {...chung} />
    </div>
  );
}

// MỘT MỤC TIÊU — dùng cho cả HỌC TẬP và RIÊNG CỦA CON.
//
// Một bản dùng chung thay vì hai khối chép tay: cửa sổ 24 giờ, đường duyệt, đích ghi-nhận-ngoài,
// nút xoá — mọi luật ở đây đều tinh tế, và hai bản chép là hai chỗ để chúng trôi khỏi nhau.
function MotMucTieu({
  kind,
  mt,
  studentId,
  classId,
  wigLop,
  laChinhEm,
  canManage,
  dayShort,
  namHoc,
  soDoTheoWig,
  mocThangTheoWig,
  tuanChuaChot,
  onBao,
}: {
  kind: 'academic' | 'personal';
  mt: MucTieuCuaEm | null;
  studentId: string;
  classId: string;
  wigLop: WigLop[];
  laChinhEm: boolean;
  canManage: boolean;
  dayShort: string[];
  namHoc: string | null;
  soDoTheoWig: Record<string, SoDoCuaTuan>;
  mocThangTheoWig: Record<string, {target: number; unit: string}>;
  tuanChuaChot: boolean;
  onBao: (s: string) => void;
}) {
  const t = useTranslations('goal');
  const hocTap = mt;
  const laRieng = kind === 'personal';
  const [moForm, setMoForm] = useState(false);

  // Ai cũng ĐỌC được khối này (phụ huynh, BGH), nhưng chỉ chính em và nhân sự mới GHI.
  const canGhi = laChinhEm || canManage;

  // MỤC TIÊU RIÊNG CHƯA CÓ → MỘT CÁI NÚT, KHÔNG PHẢI MỘT KHỐI.
  //
  // Bản trước vẫn dựng đủ bộ khung cho cái chưa tồn tại: cũng biểu tượng đích, cũng tiêu đề mở đầu
  // bằng "Mục tiêu … của con", cũng một nút vàng. Em chưa đặt gì thì màn hình có hai khối trông
  // như nhau nằm chồng, và khối dưới thì rỗng — đọc ra thành một khối bị nhân đôi chứ không thành
  // "còn một việc tuỳ chọn nữa". Mục tiêu riêng là TUỲ CHỌN (§6.2 bước ④): chưa có thì nó chỉ
  // đáng một dòng mời, và chính chữ trên nút đã nói hết. Đặt rồi mới có tiêu đề và thẻ của nó.
  if (laRieng && !hocTap) {
    if (!canGhi) return null;
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <button type="button" onClick={() => setMoForm(true)} className={`${btnGhost} self-start`}>
          <Plus size={14} strokeWidth={2.5} />
          {laChinhEm ? t('openFormPersonal') : t('openFormPersonalFor')}
        </button>
        {moForm && (
          <FormMucTieu
            studentId={studentId}
            classId={classId}
            kind={kind}
            wigLop={wigLop}
            dangSua={null}
            laChinhEm={laChinhEm}
            dayShort={dayShort}
            onClose={() => setMoForm(false)}
            onDone={onBao}
          />
        )}
      </div>
    );
  }

  // CỬA SỔ MỘT NGÀY (0102). Cô sửa/xoá lúc nào cũng được; em thì chỉ khi mục tiêu còn là đề nghị —
  // chưa duyệt, hoặc vừa tạo chưa quá 24 giờ. Tính ở đây chỉ để giao diện nói trước; chốt thật nằm
  // ở RLS và ở hàm máy chủ.
  const conMo =
    !hocTap ||
    hocTap.status === 'draft' ||
    hocTap.status === 'sent' ||
    Date.now() - new Date(hocTap.created_at).getTime() < CUA_SO_MS;
  const emSuaDuoc = canManage || (laChinhEm && conMo);
  const soDo = hocTap ? soDoTheoWig[hocTap.id] : undefined;
  const mocThang = hocTap ? mocThangTheoWig[hocTap.id] : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="flex items-center gap-1.5 font-display text-[14px] font-bold text-navy">
          <Target size={14} strokeWidth={2.5} />
          {laRieng ? t('titlePersonal') : t('title')}
        </h3>
        {/* Mục tiêu này sống cả năm học — nói ra, đừng để em đoán. Nhưng chỉ nói MỘT lần: khối
            riêng nằm ngay dưới khối học tập, cùng một năm học, nên nhắc lại chỉ thành trùng. */}
        {namHoc && !laRieng && (
          <span className="text-[11px] font-extrabold text-gold-text">
            {t('yearScope', {nam: namHoc})}
          </span>
        )}
        {/* Chỉ còn nhánh HỌC TẬP: mục tiêu riêng chưa có thì không dựng tới đây (xem ghi chú ở
            chỗ thoát sớm bên trên). */}
        {!hocTap && canGhi && (
          <button type="button" onClick={() => setMoForm(true)} className={`${btnGold} ml-auto`}>
            <Plus size={14} strokeWidth={2.5} />
            {laChinhEm ? t('openForm') : t('openFormFor')}
          </button>
        )}
      </div>

      {/* ── THẺ MỤC TIÊU ─────────────────────────────────────────────────────────────────── */}
      {hocTap ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-navy/10 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-extrabold text-navy">{hocTap.title}</span>
            {hocTap.status === 'sent' && (
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                {t('waiting')}
              </span>
            )}
            {/* Van an toàn phải lộ ra: em phải biết mục tiêu này không do mình đặt. */}
            {hocTap.set_by === 'teacher' && (
              <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                {t('setByTeacher')}
              </span>
            )}
          </div>
          <p className="text-[12.5px] font-semibold tabular-nums text-grey-mid">
            {t('fromTo', {
              from: hocTap.baseline ?? 0,
              to: hocTap.target_value,
              unit: hocTap.unit,
              due: hocTap.end_date,
            })}
          </p>
          {hocTap.viec && (
            <p className="text-[12.5px] font-semibold text-navy">
              {t('myWork', {title: hocTap.viec.title, n: hocTap.viec.target_value})}
            </p>
          )}

          {/* MỐC THÁNG NÀY. "100 bài trước tháng Năm" là con số không ai bấm được vào; "tháng này
              12 bài" thì có. Chỉ mục tiêu đếm bằng tick mới có mốc — chia "34kg" cho chín tháng ra
              "3,8kg mỗi tháng" là một câu vô nghĩa, nên loại ấy dùng ô số đo ngay dưới. */}
          {mocThang && (
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/[0.18] px-2.5 py-1 text-[12px] font-extrabold text-navy">
              {t('monthPace', {n: mocThang.target, unit: mocThang.unit})}
            </p>
          )}

          {/* ĐÍCH GHI NHẬN NGOÀI — không vẽ vạch phần trăm, chỉ có đạt hay chưa (0101).
              Từ 0108 có thêm ô SỐ ĐO ở ngay trên: "đạt/chưa đạt" là một bit cho cả một năm học,
              em cao thêm 3cm giữa kỳ thì không chỗ nào ghi và buổi họp không có gì để cầm. */}
          {hocTap.measure_by === 'manual' && (
            <OSoDo
              wigId={hocTap.id}
              unit={hocTap.unit}
              soHienTai={soDo?.gia_tri ?? null}
              nguoiGhi={soDo?.vai_tro ?? null}
              ghiLuc={soDo?.ghi_luc ?? null}
              moKhoa={tuanChuaChot}
              canGhi={canGhi}
            />
          )}
          {hocTap.measure_by === 'manual' && (
            <form action={danhDauDaDat} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="wig_id" value={hocTap.id} />
              <input type="hidden" name="student_id" value={studentId} />
              <span className="text-[12px] font-bold text-grey-mid">{t('outsideApp')}</span>
              {hocTap.achieved_at ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11.5px] font-extrabold text-success-dark">
                    <Check size={12} strokeWidth={3} />
                    {t('achieved')}
                  </span>
                  {canGhi && (
                    <>
                      <input type="hidden" name="bo" value="1" />
                      <SubmitButton
                        className="text-[11.5px] font-extrabold text-navy underline"
                        wrapClass="contents"
                      >
                        {t('undoAchieved')}
                      </SubmitButton>
                    </>
                  )}
                </>
              ) : canGhi ? (
                <SubmitButton className={btnGold} wrapClass="contents">
                  {t('markAchieved')}
                </SubmitButton>
              ) : (
                <span className="text-[11.5px] font-bold text-grey-mid">{t('notYet')}</span>
              )}
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Cô duyệt — duyệt xong em mới tick được. Đứng trước vì đây là việc cần làm ngay. */}
            {canManage && hocTap.status === 'sent' && (
              <form action={duyetMucTieu}>
                <input type="hidden" name="wig_id" value={hocTap.id} />
                <input type="hidden" name="student_id" value={studentId} />
                <SubmitButton className={btnGold} wrapClass="contents">
                  {t('approve')}
                </SubmitButton>
              </form>
            )}

            {emSuaDuoc && (
              <>
                <button type="button" onClick={() => setMoForm(true)} className={btnGhost}>
                  <Pencil size={13} strokeWidth={2.5} />
                  {t('edit')}
                </button>
                {/* XOÁ — với em, đây là đường "con không nhận mục tiêu này" khi cô đặt hộ. Nó chỉ
                    mở trong 24 giờ đầu, nên không cần hộp xác nhận riêng: confirm là đủ. */}
                <form
                  action={xoaMucTieuCuaEm}
                  onSubmit={(e) => {
                    if (!window.confirm(t('confirmDelete'))) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="wig_id" value={hocTap.id} />
                  <input type="hidden" name="student_id" value={studentId} />
                  <SubmitButton
                    className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-extrabold text-status-bad underline"
                    wrapClass="contents"
                  >
                    <Trash2 size={13} strokeWidth={2.5} />
                    {t('deleteGoal')}
                  </SubmitButton>
                </form>
              </>
            )}

            {/* Hết cửa sổ: nói rõ vì sao không còn nút, và đi đâu để đổi. Không có câu này thì hai
                em ngồi cạnh nhau thấy hai màn khác nhau mà không ai giải thích được. */}
            {laChinhEm && !emSuaDuoc && (
              <span className="text-[11.5px] font-semibold italic text-grey-mid">
                {t('lockedHint')}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Chỉ còn mục tiêu HỌC TẬP đi tới được nhánh này — mục tiêu riêng chưa có thì đã thoát ở
           trên, chỉ để lại cái nút. Học tập là cái BẮT BUỘC nên thiếu thì phải nói ra. */
        <p className="text-[12.5px] italic text-grey-mid">{canGhi ? t('hint') : t('none')}</p>
      )}

      {moForm && (
        <FormMucTieu
          studentId={studentId}
          classId={classId}
          kind={kind}
          wigLop={wigLop}
          dangSua={hocTap}
          laChinhEm={laChinhEm}
          dayShort={dayShort}
          onClose={() => setMoForm(false)}
          onDone={onBao}
        />
      )}
    </div>
  );
}
