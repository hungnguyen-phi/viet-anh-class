'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, Loader2, WifiOff} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {Field, inputCls} from '@/components/ui/Field';

// ════════════════════════════════════════════════════════════════════════════════════════════
// HAI Ô CỦA CHÍNH EM TRONG PHÒNG HỌP WIG
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Vì sao có màn này: khối "Từng em" của phòng họp là ba mươi em nhân hai ô, và người gõ hết chỗ
// ấy là GVCN — trong lúc đang chủ trì buổi họp. Đó là lý do khối ấy hay bị bỏ trống. Chủ dự án
// chốt 13/08/2026: em tự điền phần của mình, cô chỉ đọc và bổ sung.
//
// CHỈ TRONG PHÒNG HỌP. Không có đường nào khác vào đây — biên bản là thứ của buổi họp, không
// phải một ô nhật ký em gõ lúc nào cũng được (sổ của em đã là chỗ ấy rồi).
//
// LƯU THEO NHỊP GÕ, không có nút Lưu. Một buổi họp đang chạy thì không ai bấm nút; và nếu có
// nút thì đúng cái ô quan trọng nhất sẽ là ô người ta quên bấm. Gõ xong ngừng tay 600ms là ghi.
// Chính lượt ghi ấy cũng là thứ làm chữ "… đang điền" hiện lên màn của cô (0111: cột hs_go_luc
// + Realtime trên wig_meetings).
const NHIP_MS = 600;

export function OBienBanCuaEm({
  classId,
  weekLabel,
  weekStart,
  ketQuaBanDau,
  camKetBanDau,
  khoa,
}: {
  classId: string;
  weekLabel: string;
  weekStart: string;
  ketQuaBanDau: string;
  camKetBanDau: string;
  /** Tuần đã chốt → đọc được, không sửa được. */
  khoa: boolean;
}) {
  const t = useTranslations('meeting');
  const [supabase] = useState(() => createClient());
  const [ketQua, setKetQua] = useState(ketQuaBanDau);
  const [camKet, setCamKet] = useState(camKetBanDau);
  const [trangThai, setTrangThai] = useState<'yen' | 'dangLuu' | 'daLuu' | 'hong'>('yen');
  // CÔ CHỐT GIỮA LÚC EM ĐANG GÕ — cảnh chắc chắn xảy ra ở cuối mỗi buổi họp. Từ lúc ấy máy chủ
  // từ chối mọi lượt ghi, và nếu màn hình vẫn nói "kiểm tra mạng" thì em ngồi gõ lại mãi vào một
  // ô không còn nhận nữa. Khoá ô ngay và nói đúng chuyện (mã P0002 từ RPC — 0112).
  const [chotGiuaChung, setChotGiuaChung] = useState(false);
  const daKhoa = khoa || chotGiuaChung;
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Giá trị MỚI NHẤT, đọc trong lúc hẹn giờ nổ. State đóng băng theo lần render nên nếu đọc
  // state ở đó thì lượt ghi mang chữ của 600ms trước, thiếu mất mấy phím cuối.
  const moiNhat = useRef({ketQua: ketQuaBanDau, camKet: camKetBanDau});

  useEffect(() => {
    return () => {
      if (hen.current) clearTimeout(hen.current);
    };
  }, []);

  function henGhi() {
    if (daKhoa) return;
    if (hen.current) clearTimeout(hen.current);
    setTrangThai('dangLuu');
    hen.current = setTimeout(async () => {
      const {error} = await supabase.rpc('hs_ghi_bien_ban', {
        p_class: classId,
        p_week_label: weekLabel,
        p_week_start: weekStart,
        p_ket_qua: moiNhat.current.ketQua,
        p_cam_ket: moiNhat.current.camKet,
      });
      if (error?.code === 'P0002') {
        setChotGiuaChung(true);
        setTrangThai('yen');
        return;
      }
      setTrangThai(error ? 'hong' : 'daLuu');
    }, NHIP_MS);
  }

  const doi = (k: 'ketQua' | 'camKet') => (val: string) => {
    moiNhat.current = {...moiNhat.current, [k]: val};
    if (k === 'ketQua') setKetQua(val);
    else setCamKet(val);
    henGhi();
  };

  return (
    <div className="glass rounded-[20px] p-[18px]">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-[16px] font-bold text-navy">{t('myBoxTitle')}</h2>
        {/* Trạng thái ghi nằm NGAY CẠNH tiêu đề của khối, không ở cuối trang: em gõ xong ngẩng
            lên là phải thấy chữ đã vào máy, nếu không thì em gõ lại lần nữa. */}
        {!daKhoa && trangThai === 'dangLuu' && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-grey-mid">
            <Loader2 size={11} strokeWidth={2.5} className="animate-spin" />
            {t('saving')}
          </span>
        )}
        {!daKhoa && trangThai === 'daLuu' && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-success-dark">
            <Check size={11} strokeWidth={3} />
            {t('saved')}
          </span>
        )}
        {!daKhoa && trangThai === 'hong' && (
          <span
            role="alert"
            className="inline-flex items-center gap-1 text-[11.5px] font-bold text-status-bad"
          >
            <WifiOff size={11} strokeWidth={2.5} />
            {t('saveFailed')}
          </span>
        )}
      </div>
      <p className="mb-3 text-[11.5px] font-semibold leading-relaxed text-grey-mid">
        {daKhoa ? t('closedForYou') : t('myHint')}
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label={t('emResults')} htmlFor="bb-ketqua">
          <input
            id="bb-ketqua"
            value={ketQua}
            disabled={daKhoa}
            onChange={(e) => doi('ketQua')(e.target.value)}
            placeholder={t('myResultsPlaceholder')}
            className={inputCls}
          />
        </Field>
        <Field label={t('emCommit')} htmlFor="bb-camket">
          <input
            id="bb-camket"
            value={camKet}
            disabled={daKhoa}
            onChange={(e) => doi('camKet')(e.target.value)}
            placeholder={t('myCommitPlaceholder')}
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}
