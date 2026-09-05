'use client';

// LỘ TRÌNH của MỘT mục tiêu trên màn EM — hội tụ: dưới mục tiêu là VIỆC đẩy nó (tick) + CAM KẾT
// tuần của em cho nó. Cùng mẫu với lộ trình màn cô; không còn "việc" và "cam kết" là hai khu rời.
// Tự tính cửa sổ 7 ngày + tick lạc quan (số nhảy ngay, ghi lượt chạy nền).
import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {HangViec, TheCamKet, themNgay, type ViecEm, type CamKetEm} from '@/components/student/BangEmPA2';
import {ThemCamKetEm} from '@/components/student/ThemCamKetEm';
import {NutThemThuoc} from '@/components/wig/NutThemThuoc';
import type {LuotResult} from '@/app/[locale]/(dashboard)/student/actions';

export function LoTrinhEm({
  goal,
  viec,
  camKet,
  studentId,
  classId,
  laChinhEm,
  monday,
  thisMonday,
  today,
  daChotHopTuan,
  tuanNghi,
  weekDays,
  dayShort,
  donViList = [],
}: {
  goal: {id: string; ten: string; don_vi_id: string | null; ten_don_vi: string | null};
  viec: ViecEm[];
  camKet: CamKetEm[];
  studentId: string;
  classId: string;
  laChinhEm: boolean;
  monday: string;
  thisMonday: string;
  today: string;
  daChotHopTuan: boolean;
  tuanNghi: boolean;
  weekDays: string[];
  dayShort: string[];
  donViList?: {id: string; ma: string; nhan?: string}[];
}) {
  const tb = useTranslations('bangEm');
  const tv = useTranslations('viec');
  const router = useRouter();
  const [dangChay, khoiDong] = useTransition();
  const [loi, datLoi] = useState<string | null>(null);
  const ghi = (fn: () => Promise<LuotResult>) => {
    datLoi(null);
    khoiDong(async () => {
      const r = await fn();
      if (!r.ok) datLoi(r.error ?? tv('ghiLoi'));
      else router.refresh();
    });
  };
  const moTuan = laChinhEm && monday === thisMonday && !daChotHopTuan;
  const dauCuaSo = themNgay(today, -6);
  const moNgay = (d: string) => moTuan && d <= today && d >= dauCuaSo;

  return (
    <div className="flex flex-col gap-1.5 rounded-[12px] bg-white/60 p-2.5">
      {loi && (
        <p className="rounded-[12px] border border-status-bad/40 bg-status-bad/[0.08] px-2.5 py-1.5 text-chu-thich font-bold text-status-bad">
          {loi}
        </p>
      )}

      {/* CAM KẾT TUẦN của em cho mục tiêu này — hàng đầu có nút (+) thêm, như thẻ của thầy cô. Dưới
          MỖI cam kết là thước đo dẫn dắt (em tick để hoàn thành cam kết). */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-nhan font-extrabold uppercase tracking-wide text-grey-mid">{tb('loCamKet')}</p>
        {laChinhEm && classId && (
          <ThemCamKetEm
            studentId={studentId}
            classId={classId}
            monday={monday}
            mucTieuLop={[{id: goal.id, ten: goal.ten, don_vi_id: goal.don_vi_id, ten_don_vi: goal.ten_don_vi}]}
          />
        )}
      </div>
      {camKet.length === 0 && (
        <p className="text-chu-thich font-semibold italic text-grey-mid">
          {monday > thisMonday ? tb('loCamKetTuLan') : tb('loCamKetTrong')}
        </p>
      )}
      {camKet.map((c) => {
        // 0185: một cam kết treo NHIỀU thước — gom theo thuoc.cam_ket_id (viec_bang trả cột này).
        const chumThuoc = viec.filter((v) => v.cam_ket_id === c.id);
        return (
          <div key={c.id} className="flex flex-col gap-1.5 rounded-[12px] bg-white/70 p-2">
            <TheCamKet c={c} studentId={studentId} laChinhEm={laChinhEm} tuanNghi={tuanNghi} today={today} anGiup />
            {chumThuoc.map((vBoTro) => (
              // THƯỚC ĐO là chỗ em bấm MỖI NGÀY → nổi hơn phần chấm cam kết (viền + nền vàng nhạt, 05/09).
              <div key={vBoTro.thuoc_id} className="rounded-[12px] border-[1.5px] border-gold/70 bg-gold/[0.10] p-1">
                <HangViec
                  v={vBoTro}
                  khoa={c.ket_qua != null}
                  weekDays={weekDays}
                  today={today}
                  moNgay={moNgay}
                  daChotHopTuan={daChotHopTuan}
                  dangChay={dangChay}
                  ghi={ghi}
                  dayShort={dayShort}
                  vien={false}
                  studentId={studentId}
                  laChinhEm={laChinhEm}
                  donViList={donViList}
                />
              </div>
            ))}
            {laChinhEm && classId && monday === thisMonday && c.ket_qua == null && (
              <NutThemThuoc mode="em" camKetId={c.id} classId={classId} studentId={studentId} monday={monday} donViList={donViList} />
            )}
          </div>
        );
      })}
    </div>
  );
}
