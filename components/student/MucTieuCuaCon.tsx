'use client';

import {useState} from 'react';
import {ngayVN} from '@/lib/dates';
import {useTranslations} from 'next-intl';
import {Check, CheckCircle2, CornerDownRight, Pencil, Plus} from 'lucide-react';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {btnGhost, btnGold} from '@/components/ui/Field';
import {FormMucTieu, type WigLop} from '@/components/student/FormMucTieu';
import {OSoDo} from '@/components/student/OSoDo';
import {XinSuaMucTieu} from '@/components/student/XinSuaMucTieu';
import {DonutRing} from '@/components/charts/DonutRing';
import {Popup} from '@/components/ui/Popup';
import {AREAS} from '@/lib/areas';
import {duyetMucTieu, traLaiMucTieu, danhDauDaDat} from '@/app/[locale]/(dashboard)/student/actions';

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
  reject_note?: string | null;
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
  nhanTheoArea,
  mauTheoArea,
  xinSuaTheoWig,
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
  /** Nhãn hiển thị của 4 domain (từ area_config, đúng ngôn ngữ đang xem). */
  nhanTheoArea: Record<string, string>;
  /** Màu của 4 domain (area_config): hex cho viền/vòng %, soft (rgba nhạt) cho nền ô. */
  mauTheoArea: Record<string, {hex: string; soft: string}>;
  /** Yêu cầu sửa/xoá CÒN CHỜ DUYỆT của chính em, theo id mục tiêu (rỗng với người xem khác). */
  xinSuaTheoWig: Record<string, {id: string; loai: 'sua' | 'xoa'}>;
}) {
  const t = useTranslations('goal');
  const [bao, setBao] = useState('');
  // BỐN Ô, MỖI DOMAIN MỘT (PRD v3 4.2 — thay luật "học tập + riêng" của 0100). moForm giữ
  // domain của ô em vừa bấm; ô trống chính là lời nhắc "em còn thiếu WIG domain nào".
  const [moForm, setMoForm] = useState<null | string>(null);
  const theoArea = new Map(mucTieu.map((m) => [m.area, m]));
  // CÔ KHÔNG ĐẶT HỘ, KHÔNG SỬA, KHÔNG XOÁ (16/08/2026 — chủ dự án: "giáo viên chỉ có nút duyệt thôi, mọi
  // thứ khác đều chỉ xem"). Mọi động tác ghi ở đây là của chính em; cô còn Duyệt / Trả lại.
  const canGhi = laChinhEm;
  const dangSuaMt = moForm ? theoArea.get(moForm) ?? null : null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {bao && (
        <p className="inline-flex items-start gap-1.5 rounded-[10px] bg-success/[0.10] px-2.5 py-2 text-[12px] font-bold text-success-dark">
          <CheckCircle2 size={13} strokeWidth={2.5} className="mt-px shrink-0" />
          {bao}
        </p>
      )}

      {/* 2×2 trên màn rộng: bốn ô, THỨ TỰ CỐ ĐỊNH theo AREAS — ô nào của domain nấy, kể cả khi
          trống. Ô trống với chính em là nút đặt; với người xem khác là lời "chưa đặt" — cô nhìn
          một phát biết em còn thiếu domain nào (PRD v3 4.2). */}
      <div className="grid gap-3 sm:grid-cols-2">
      {AREAS.map((a) => {
        const mt = theoArea.get(a);
        const nhan = nhanTheoArea[a] ?? a;
        const mau = mauTheoArea[a] ?? {hex: '#26275d', soft: 'rgba(38,39,93,0.06)'};
        if (mt)
          return (
            <TheMucTieu
              key={a}
              mt={mt}
              nhanLinhVuc={nhan}
              mau={mau}
              studentId={studentId}
              laChinhEm={laChinhEm}
              canManage={canManage}
              soDo={soDoTheoWig[mt.id]}
              tuanChuaChot={tuanChuaChot}
              pct={pctTheoWig[mt.id]}
              wigLop={wigLop}
              classId={classId}
              yeuCauCho={xinSuaTheoWig[mt.id] ?? null}
              onSua={() => setMoForm(a)}
            />
          );
        // Ô TRỐNG CŨNG MANG MÀU LĨNH VỰC — "4 ô màu" nghĩa là bốn ô nhận ra nhau bằng màu
        // ngay cả khi chưa có mục tiêu, không phải bốn ô trắng giống hệt. Viền/nền lấy đúng
        // cặp hex/soft của area_config; chữ vẫn navy/grey-mid cho đủ tương phản.
        return canGhi ? (
          <button
            key={a}
            type="button"
            onClick={() => setMoForm(a)}
            style={{
              borderColor: `color-mix(in srgb, ${mau.hex} 30%, white)`,
              background: `color-mix(in srgb, ${mau.hex} 9%, white)`,
            }}
            className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] border-dashed p-4 text-navy transition-colors hover:bg-white/70"
          >
            <span
              style={{background: mau.hex}}
              className="grid h-9 w-9 place-items-center rounded-full text-white"
            >
              <Plus size={18} strokeWidth={2.8} />
            </span>
            <span className="text-[13px] font-extrabold">{nhan}</span>
            {namHoc && <span className="text-[11px] font-semibold text-grey-mid">{namHoc}</span>}
          </button>
        ) : (
          <div
            key={a}
            style={{
              borderColor: `color-mix(in srgb, ${mau.hex} 24%, white)`,
              background: `color-mix(in srgb, ${mau.hex} 7%, white)`,
            }}
            className="flex min-h-[112px] flex-col items-center justify-center gap-1 rounded-[16px] border-[1.5px] border-dashed p-4"
          >
            <span className="text-[13px] font-extrabold text-navy">{nhan}</span>
            <span className="text-[11.5px] font-semibold italic text-grey-mid">{t('notSet')}</span>
          </div>
        );
      })}
      </div>

      {moForm && (
        <FormMucTieu
          studentId={studentId}
          classId={classId}
          area={moForm}
          nhanLinhVuc={nhanTheoArea[moForm] ?? moForm}
          wigLop={wigLop}
          dangSua={dangSuaMt}
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
  nhanLinhVuc,
  mau,
  studentId,
  laChinhEm,
  canManage,
  soDo,
  tuanChuaChot,
  pct,
  wigLop,
  classId,
  yeuCauCho,
  onSua,
}: {
  mt: MucTieuCuaEm;
  nhanLinhVuc: string;
  mau: {hex: string; soft: string};
  wigLop: WigLop[];
  classId: string;
  studentId: string;
  laChinhEm: boolean;
  canManage: boolean;
  soDo: SoDoCuaTuan | undefined;
  tuanChuaChot: boolean;
  pct: number | undefined;
  /** Yêu cầu sửa/xoá của chính em còn chờ duyệt trên mục tiêu này (null = không có). */
  yeuCauCho: {id: string; loai: 'sua' | 'xoa'} | null;
  onSua: () => void;
}) {
  const t = useTranslations('goal');
  const canGhi = laChinhEm;
  const tenLopNguon = mt.source_wig_id ? (wigLop.find((w) => w.id === mt.source_wig_id)?.title ?? null) : null;

  return (
    // Ô MÀU THEO LĨNH VỰC (19/08/2026), tông PASTEL (góp ý cùng ngày: "màu pastel cho đẹp"):
    // pha màu lĩnh vực VỚI TRẮNG bằng color-mix — pastel thật, sáng và sạch; alpha phủ lên nền
    // xám của trang cho ra màu đục, không phải pastel. Vòng % giữ nguyên hex đậm để còn đọc được.
    // `relative` để nút bút "Xin sửa" treo được ở góc trên phải.
    <div
      style={{
        borderColor: `color-mix(in srgb, ${mau.hex} 30%, white)`,
        background: `color-mix(in srgb, ${mau.hex} 9%, white)`,
      }}
      className="relative flex flex-col gap-3 rounded-[16px] border-[1.5px] p-4"
    >
      <div className="flex items-start gap-3.5">
        {/* VÒNG % ĐỨNG ĐẦU THẺ, bên trái — đọc "bao nhiêu phần trăm rồi" trước, rồi mới đọc tên. Đích
            ghi nhận ngoài (điểm, kg) không vẽ % (0101): thay bằng huy hiệu Đạt / Chưa. */}
        {mt.measure_by === 'manual' ? (
          <span
            className={`grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full text-center text-[10.5px] font-extrabold leading-tight ${
              mt.achieved_at ? 'bg-success/15 text-success-dark' : 'bg-navy/[0.07] text-grey-mid'
            }`}
          >
            {mt.achieved_at ? t('achieved') : t('notYet')}
          </span>
        ) : (
          <DonutRing pct={pct ?? 0} color={mau.hex} size={60} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              style={{background: `color-mix(in srgb, ${mau.hex} 16%, white)`}}
              className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
            >
              {nhanLinhVuc}
            </span>
            <span className="font-display text-[16px] font-bold leading-tight text-navy">{mt.title}</span>
            {mt.status === 'sent' && (
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text">
                {t('waiting')}
              </span>
            )}
            {mt.status === 'rejected' && (
              <span className="rounded-full bg-status-bad/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">
                {t('returned')}
              </span>
            )}
            {/* EM ĐÃ XIN SỬA/XOÁ, ĐANG CHỜ (20/08/2026): thiếu chip này thì bấm "Xin xoá" xong
                thẻ im lặng như chưa có gì — em tưởng lỗi và xin lại lần nữa. */}
            {yeuCauCho && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                  yeuCauCho.loai === 'xoa'
                    ? 'bg-status-bad/[0.12] text-status-bad'
                    : 'bg-gold/25 text-gold-text'
                }`}
              >
                {t(yeuCauCho.loai === 'xoa' ? 'reqPendingDelete' : 'reqPendingEdit')}
              </span>
            )}
            {mt.set_by === 'teacher' && (
              <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-grey-mid">
                {t('setByTeacher')}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] font-semibold tabular-nums text-grey-mid">
            {t('fromToRange', {from: mt.baseline ?? 0, to: mt.target_value, unit: mt.unit, start: ngayVN(mt.start_date), due: ngayVN(mt.end_date)})}
          </p>
          {/* DÂY NỐI LÊN LỚP — nói ra, đừng để người ta đoán "300 bài lấy từ đâu": đây là phần em tự
              nhận góp vào mục tiêu năm của lớp (source_wig_id, 0100/0138). Một chip, không phải một câu. */}
          {tenLopNguon && (
            <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-gold/[0.16] px-2 py-0.5 text-[11px] font-extrabold text-gold-text">
              <CornerDownRight size={11} strokeWidth={2.5} className="shrink-0" aria-hidden />
              <span className="truncate">{tenLopNguon}</span>
            </span>
          )}
        </div>
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

      {/* NHẬN XÉT TRẢ LẠI — hiện ngay trên thẻ để em biết sửa gì; gửi lại thì máy chủ xoá. */}
      {mt.status === 'rejected' && mt.reject_note && (
        <p className="rounded-[10px] bg-status-bad/[0.07] px-2.5 py-2 text-[12px] font-semibold leading-relaxed text-navy">
          <span className="font-extrabold text-status-bad">{t('teacherNote')}: </span>
          {mt.reject_note}
        </p>
      )}

      {/* Hàng nút chỉ dựng khi CÓ nút — thẻ đã duyệt của chính em không còn gì ở đây (bút xin
          sửa đã dời lên góc), để lại một vạch ngăn trần là rác thị giác. */}
      <div
        className={`mt-auto flex flex-wrap items-center gap-2 border-t border-navy/[0.06] pt-2.5 ${
          (canManage && mt.status === 'sent') || (laChinhEm && mt.status !== 'approved') ? '' : 'hidden'
        }`}
      >
        {canManage && mt.status === 'sent' && (
          <form action={duyetMucTieu}>
            <input type="hidden" name="wig_id" value={mt.id} />
            <input type="hidden" name="student_id" value={studentId} />
            <SubmitButton className={btnGold} wrapClass="contents">
              {t('approve')}
            </SubmitButton>
          </form>
        )}
        {canManage && mt.status === 'sent' && (
          <NutTraLai wigId={mt.id} studentId={studentId} title={mt.title} />
        )}
        {/* CHƯA DUYỆT → nút Sửa nhỏ (Xoá nằm trong form sửa, không đứng lộ ở đây).
            ĐÃ DUYỆT → ĐÓNG BĂNG: sửa hay xoá đều XIN qua thầy cô — nhưng lời xin nay là CÁI BÚT
            Ở GÓC THẺ, không còn chiếm một dòng chữ (chủ dự án 19/08/2026: "bỏ chữ xin sửa, chỉ
            còn 1 cái bút nhỏ ở góc"). Nút ấy render ở góc trên phải, xem cuối thẻ. */}
        {laChinhEm && mt.status !== 'approved' && (
          <button type="button" onClick={onSua} className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[12px] font-extrabold text-navy underline">
            <Pencil size={12} strokeWidth={2.5} />
            {t('edit')}
          </button>
        )}
      </div>

      {laChinhEm && mt.status === 'approved' && (
        <XinSuaMucTieu
          studentId={studentId}
          classId={classId}
          wigId={mt.id}
          title={mt.title}
          unit={mt.unit}
          targetValue={mt.target_value}
          yeuCauCho={yeuCauCho}
        />
      )}
    </div>
  );
}

// Nút "Trả lại" của cô — mở hộp thoại đòi MỘT CÂU nhận xét rồi mới gửi (wig_reject_note_ck
// chặn trả lại tay không ở CSDL; textarea required chỉ là lớp báo sớm).
function NutTraLai({wigId, studentId, title}: {wigId: string; studentId: string; title: string}) {
  const t = useTranslations('goal');
  const [mo, setMo] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-[12px] font-extrabold text-status-bad underline"
      >
        {t('returnBtn')}
      </button>
      {mo && (
        <Popup title={t('returnTitle')} onClose={() => setMo(false)} width="max-w-[460px]">
          <form action={traLaiMucTieu} className="flex flex-col gap-3">
            <input type="hidden" name="wig_id" value={wigId} />
            <input type="hidden" name="student_id" value={studentId} />
            <p className="text-[13px] font-bold text-navy">{title}</p>
            <textarea
              name="note"
              required
              maxLength={300}
              rows={3}
              className="w-full rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2.5 text-[13px] font-semibold text-navy outline-none focus:border-navy"
            />
            <div className="flex items-center gap-3">
              <SubmitButton className={btnGold} wrapClass="contents">
                {t('returnSend')}
              </SubmitButton>
              <button
                type="button"
                onClick={() => setMo(false)}
                className="inline-flex min-h-[24px] cursor-pointer items-center py-1 text-[12px] font-extrabold text-grey-mid underline"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        </Popup>
      )}
    </>
  );
}
