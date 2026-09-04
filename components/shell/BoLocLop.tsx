'use client';

// BỘ LỌC LỚP BỐN CẤP — Năm học → Cơ sở → Khối → Lớp — cho admin/BGH (04/09/2026).
//
// Chủ dự án: "thêm filter để lọc cơ sở, khối, lớp, năm… tránh một đống lớp chung một dropdown".
// Một <select> 28 lớp gom optgroup vẫn là một danh sách dài phải dò; nay mỗi cấp chỉ hiện lựa chọn
// còn hợp lệ theo cấp trước, tới cấp Lớp chỉ còn dăm ba mục. Chọn Lớp mới điều hướng (?class=),
// GIỮ query đang có (?week=, ?bang=…) và mờ trang khi đang chuyển — y như ClassPicker.
//
// Dữ liệu: đúng prop `classes` (ClassOption) mà ClassPicker nhận — không gọi Supabase ở client.
// BGH chỉ có lớp của cơ sở mình (RLS) nên ô Cơ sở tự thành một mục và bị khoá.
import {useEffect, useMemo, useState, useTransition} from 'react';
import {Loader2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter, usePathname} from '@/i18n/navigation';
import {useSearchParams} from 'next/navigation';
import type {ClassOption} from '@/lib/queries';

const SEL =
  'ctl-h w-full min-w-0 cursor-pointer appearance-none rounded-[12px] border-[1.5px] border-navy/20 bg-white px-3 pr-8 text-base font-bold text-navy transition-all hover:border-navy focus-visible:border-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm';

function O({label, children, htmlFor}: {label: string; children: React.ReactNode; htmlFor: string}) {
  return (
    <label htmlFor={htmlFor} className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-grey-mid">{label}</span>
      <span className="relative block">
        {children}
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-navy/60">▼</span>
      </span>
    </label>
  );
}

export function BoLocLop({classes, current}: {classes: ClassOption[]; current?: string}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dangChuyen, batDau] = useTransition();

  const hienTai = classes.find((c) => c.id === current);
  // Năm hiện hành = năm của lớp đang xem, không thì năm mới nhất trong danh sách.
  const namMoiNhat = useMemo(() => [...new Set(classes.map((c) => c.school_year))].sort().at(-1) ?? '', [classes]);
  const [nam, setNam] = useState(hienTai?.school_year ?? namMoiNhat);
  const [coSo, setCoSo] = useState(hienTai?.campus_id ?? '');
  const [khoi, setKhoi] = useState(hienTai?.grade_id ?? '');

  // Lớp đang xem đổi (điều hướng xong) → đồng bộ lại ba ô trên cho khớp.
  useEffect(() => {
    if (!hienTai) return;
    setNam(hienTai.school_year);
    setCoSo(hienTai.campus_id ?? '');
    setKhoi(hienTai.grade_id ?? '');
  }, [hienTai]);

  useEffect(() => {
    if (dangChuyen) document.documentElement.setAttribute('data-chuyen-lop', '1');
    else document.documentElement.removeAttribute('data-chuyen-lop');
    return () => document.documentElement.removeAttribute('data-chuyen-lop');
  }, [dangChuyen]);

  // Từng cấp: chỉ lựa chọn còn hợp lệ theo cấp trước. `classes` đã sắp (cơ sở, khối, tên).
  const namList = useMemo(() => [...new Set(classes.map((c) => c.school_year))].sort().reverse(), [classes]);
  const theoNam = useMemo(() => classes.filter((c) => !nam || c.school_year === nam), [classes, nam]);
  const coSoList = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of theoNam) if (c.campus_id && !m.has(c.campus_id)) m.set(c.campus_id, c.campus_name ?? '');
    return [...m.entries()];
  }, [theoNam]);
  const theoCoSo = useMemo(() => theoNam.filter((c) => !coSo || c.campus_id === coSo), [theoNam, coSo]);
  const khoiList = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of theoCoSo) if (c.grade_id && !m.has(c.grade_id)) m.set(c.grade_id, c.grade_name);
    return [...m.entries()];
  }, [theoCoSo]);
  const lopList = useMemo(() => theoCoSo.filter((c) => !khoi || c.grade_id === khoi), [theoCoSo, khoi]);
  const khoaCoSo = coSoList.length <= 1;

  const doiLop = (id: string) => {
    if (!id || id === current) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set('class', id);
    batDau(() => {
      router.push(`${pathname}?${q.toString()}`);
    });
  };

  return (
    <div
      role="group"
      aria-label={tc('chonLop')}
      aria-busy={dangChuyen}
      className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-[auto_auto_auto_minmax(9rem,auto)] sm:items-end"
    >
      <O label={t('locNam')} htmlFor="loc-nam">
        <select
          id="loc-nam"
          value={nam}
          disabled={dangChuyen || namList.length <= 1}
          onChange={(e) => {
            setNam(e.target.value);
            setKhoi('');
          }}
          className={SEL}
        >
          {namList.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </O>
      <O label={t('locCoSo')} htmlFor="loc-co-so">
        <select
          id="loc-co-so"
          value={khoaCoSo ? (coSoList[0]?.[0] ?? '') : coSo}
          disabled={dangChuyen || khoaCoSo}
          onChange={(e) => {
            setCoSo(e.target.value);
            setKhoi('');
          }}
          className={SEL}
        >
          {!khoaCoSo && <option value="">{t('locTatCa')}</option>}
          {coSoList.map(([id, ten]) => (
            <option key={id} value={id}>
              {ten}
            </option>
          ))}
        </select>
      </O>
      <O label={t('locKhoi')} htmlFor="loc-khoi">
        <select id="loc-khoi" value={khoi} disabled={dangChuyen} onChange={(e) => setKhoi(e.target.value)} className={SEL}>
          <option value="">{t('locTatCa')}</option>
          {khoiList.map(([id, ten]) => (
            <option key={id} value={id}>
              {ten}
            </option>
          ))}
        </select>
      </O>
      <O label={t('locLop')} htmlFor="loc-lop">
        <select
          id="loc-lop"
          value={lopList.some((c) => c.id === current) ? current : ''}
          disabled={dangChuyen}
          onChange={(e) => doiLop(e.target.value)}
          className={SEL}
        >
          <option value="">{tc('chonLop')}</option>
          {lopList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {dangChuyen && (
          <Loader2 size={14} strokeWidth={2.5} className="absolute -left-5 top-1/2 -translate-y-1/2 animate-spin text-navy/70 sm:hidden" aria-hidden />
        )}
      </O>
      {dangChuyen && (
        <span className="sr-only" role="status">
          {tc('dangChuyenLop')}
        </span>
      )}
    </div>
  );
}
