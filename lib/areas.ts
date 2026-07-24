// Nguồn dữ liệu 4 lĩnh vực 4DX ("Môn"): đọc từ bảng area_config, có FALLBACK = đúng
// giá trị hiện tại → khi chưa cấu hình, giao diện y hệt bản cũ (parity, tôn trọng freeze).
import {BookOpen, Sparkles, Languages, Bike, GraduationCap, Star, Trophy, Heart, type LucideIcon} from 'lucide-react';

export const AREAS = ['knowledge', 'skills', 'english', 'physical'] as const;
export type Area = (typeof AREAS)[number];

// Tên icon (lưu trong area_config.icon_name) → component lucide. Danh sách cho phép ở form cấu hình.
export const AREA_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Sparkles,
  Languages,
  Bike,
  GraduationCap,
  Star,
  Trophy,
  Heart,
};
export const AREA_ICON_NAMES = Object.keys(AREA_ICON_MAP);

export type AreaMeta = {
  hex: string;
  soft: string;
  icon_name: string;
  label_vi: string;
  label_en: string;
  default_unit: string | null;
};

// FALLBACK = map SUBJ trong page.tsx + nhãn messages class.areas.* (bản hiện tại).
export const AREA_FALLBACK: Record<Area, AreaMeta> = {
  knowledge: {hex: '#3a62c9', soft: 'rgba(58,98,201,0.14)', icon_name: 'BookOpen', label_vi: 'Kiến thức', label_en: 'Knowledge', default_unit: null},
  skills: {hex: '#557f3c', soft: 'rgba(85,127,60,0.14)', icon_name: 'Sparkles', label_vi: 'Kỹ năng', label_en: 'Skills', default_unit: null},
  english: {hex: '#0e7c86', soft: 'rgba(14,124,134,0.14)', icon_name: 'Languages', label_vi: 'Tiếng Anh', label_en: 'English', default_unit: null},
  physical: {hex: '#cf5a42', soft: 'rgba(207,90,66,0.14)', icon_name: 'Bike', label_vi: 'Thể chất', label_en: 'Physical', default_unit: null},
};

export type AreaConfigRow = {
  area: string;
  color_hex: string;
  soft_rgba: string;
  icon_name: string;
  label_vi: string;
  label_en: string;
  default_unit: string | null;
  sort_order: number;
};

// Gộp config DB + fallback → map area→meta (thiếu row nào thì lấy fallback của area đó).
export function buildAreaMeta(rows: AreaConfigRow[] | null | undefined): Record<Area, AreaMeta> {
  const byArea = new Map((rows ?? []).map((r) => [r.area, r]));
  const out = {} as Record<Area, AreaMeta>;
  for (const a of AREAS) {
    const r = byArea.get(a);
    out[a] = r
      ? {
          hex: r.color_hex,
          soft: r.soft_rgba,
          icon_name: r.icon_name,
          label_vi: r.label_vi,
          label_en: r.label_en,
          default_unit: r.default_unit,
        }
      : AREA_FALLBACK[a];
  }
  return out;
}

export function areaLabel(meta: AreaMeta, locale: string): string {
  return locale === 'en' ? meta.label_en : meta.label_vi;
}

export function areaIcon(meta: AreaMeta): LucideIcon {
  return AREA_ICON_MAP[meta.icon_name] ?? BookOpen;
}
