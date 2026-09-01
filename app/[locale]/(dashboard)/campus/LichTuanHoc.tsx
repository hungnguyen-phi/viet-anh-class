'use client';

import {useMemo, useState, useTransition} from 'react';
import {useTranslations} from 'next-intl';
import {datTuanHoc} from './actions';

// ════════════════════════════════════════════════════════════════════════════════════════════
// LỊCH TUẦN HỌC — cơ sở tự khai tuần nào NGHỈ, tuần nào THI (40-C · C4)
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Bấm một tuần để đổi vòng: học → nghỉ → thi → học. Tuần nghỉ chỉ MIỄN thắng/thua, không chặn
// ghi (luật ở view thuoc_12_tuan / metrics_tuan, không ở đây). Loại 'hoc' là mặc định nên khi
// quay về học, action xoá dòng cho gọn.
//
// Gửi LOẠI ĐÍCH tường minh cho action (không "kế tiếp"): hai lần bấm nhanh vẫn ra đúng kết quả
// người thấy, không phụ thuộc thứ tự tới máy chủ. Đổi tuần ĐÃ QUA thì hỏi lại (Popup) vì nó tính
// lại thắng/thua của mọi lớp — client chặn trước, action ghi vết kiểm toán.

type Loai = 'hoc' | 'nghi' | 'thi';
type Tuan = {monday: string; thang: number; loai: Loai; quaKhu: boolean};

const KE_TIEP: Record<Loai, Loai> = {hoc: 'nghi', nghi: 'thi', thi: 'hoc'};

export function LichTuanHoc({nam, weeks}: {nam: string; weeks: Tuan[]}) {
  const t = useTranslations('coSoMucTieu');
  const [pending, startTransition] = useTransition();
  // Ghi đè lạc quan: đổi màu ngay khi bấm, không đợi máy chủ dựng lại trang.
  const [ghiDe, setGhiDe] = useState<Record<string, Loai>>({});

  const theoThang = useMemo(() => {
    const m = new Map<number, Tuan[]>();
    for (const w of weeks) {
      const list = m.get(w.thang);
      if (list) list.push(w);
      else m.set(w.thang, [w]);
    }
    return [...m.entries()];
  }, [weeks]);

  function bam(w: Tuan) {
    if (pending) return;
    const hienTai = ghiDe[w.monday] ?? w.loai;
    const dich = KE_TIEP[hienTai];
    if (w.quaKhu && !window.confirm(t('lichQuaKhu'))) return;
    setGhiDe((g) => ({...g, [w.monday]: dich}));
    const fd = new FormData();
    fd.set('week_start', w.monday);
    fd.set('loai', dich);
    fd.set('da_qua', String(w.quaKhu));
    startTransition(() => {
      void datTuanHoc(fd);
    });
  }

  function mauCls(loai: Loai): string {
    if (loai === 'nghi')
      return 'border-warn/40 bg-warn/[0.14] text-warn-text';
    if (loai === 'thi')
      return 'border-gold-deep/40 bg-gold/[0.20] text-gold-text';
    return 'border-navy/12 bg-white text-navy hover:border-navy/40';
  }

  return (
    <section className="glass rounded-[20px] p-[18px]">
      <div className="mb-1 font-display text-[15px] font-bold text-navy">{t('khuLich', {nam})}</div>
      <p className="mb-3 text-xs leading-relaxed text-grey-mid">{t('lichHint')}</p>

      <div className="flex flex-col gap-2.5">
        {theoThang.map(([thang, ds]) => (
          <div key={thang} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="w-[68px] shrink-0 text-[11.5px] font-extrabold uppercase tracking-wide text-grey-mid">
              {t('thang', {m: thang})}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {ds.map((w) => {
                const loai = ghiDe[w.monday] ?? w.loai;
                const nhan = t(loai === 'nghi' ? 'lichNghi' : loai === 'thi' ? 'lichThi' : 'lichHoc');
                return (
                  <button
                    key={w.monday}
                    type="button"
                    onClick={() => bam(w)}
                    disabled={pending}
                    aria-label={`${w.monday} — ${nhan}`}
                    title={w.monday}
                    className={`grid h-9 w-9 place-items-center rounded-[9px] border-[1.5px] text-[10px] font-extrabold tabular-nums transition-all disabled:cursor-wait disabled:opacity-60 ${mauCls(loai)} ${w.quaKhu ? 'opacity-80' : ''}`}
                  >
                    {Number(w.monday.slice(8, 10))}
                    <span className="text-[7.5px] font-bold uppercase leading-none">{nhan}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
