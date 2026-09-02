'use client';

// LỘ TRÌNH của MỘT mục tiêu trên màn EM — hội tụ: dưới mục tiêu là VIỆC đẩy nó (tick) + CAM KẾT
// tuần của em cho nó. Cùng mẫu với lộ trình màn cô; không còn "việc" và "cam kết" là hai khu rời.
// Tự tính cửa sổ 7 ngày + tick lạc quan (số nhảy ngay, ghi lượt chạy nền).
import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {HangViec, TheCamKet, themNgay, type ViecEm, type CamKetEm} from '@/components/student/BangEmPA2';
import {ThemCamKetEm} from '@/components/student/ThemCamKetEm';
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
    <div className="mt-1.5 flex flex-col gap-2 rounded-[14px] bg-navy/[0.03] p-2.5">
      {loi && (
        <p className="rounded-[10px] border border-status-bad/40 bg-status-bad/[0.08] px-2.5 py-1.5 text-[12px] font-bold text-status-bad">
          {loi}
        </p>
      )}

      {/* VIỆC đẩy mục tiêu này — em tick, số của mục tiêu ở trên tự nhích lên. */}
      {viec.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{tb('loViec')}</p>
          <div className="flex flex-col overflow-hidden rounded-[12px] bg-white/70">
            {viec.map((v, i) => (
              <HangViec
                key={v.thuoc_id}
                v={v}
                weekDays={weekDays}
                today={today}
                moNgay={moNgay}
                daChotHopTuan={daChotHopTuan}
                dangChay={dangChay}
                ghi={ghi}
                dayShort={dayShort}
                vien={i > 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* CAM KẾT tuần của em, hướng vào mục tiêu này. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{tb('loCamKet')}</p>
        {camKet.length === 0 && !laChinhEm && (
          <p className="text-[11.5px] font-semibold italic text-grey-mid">{tb('loCamKetTrong')}</p>
        )}
        {camKet.map((c) => (
          <TheCamKet key={c.id} c={c} studentId={studentId} laChinhEm={laChinhEm} tuanNghi={tuanNghi} today={today} />
        ))}
        {laChinhEm && classId && (
          <ThemCamKetEm
            studentId={studentId}
            classId={classId}
            monday={monday}
            mucTieuLop={[{id: goal.id, ten: goal.ten, don_vi_id: goal.don_vi_id, ten_don_vi: goal.ten_don_vi}]}
          />
        )}
      </div>
    </div>
  );
}
