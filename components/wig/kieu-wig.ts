// Kiểu dùng chung cho các khối của màn /wig (tách file 04/09 để page.tsx không còn 60 KB).
import type {Area} from '@/lib/areas';

export type MucTieuV = {
  id: string;
  ten: string | null;
  linh_vuc: Area | null;
  subject_id: string | null;
  mo_ta: string | null;
  don_vi_id: string | null;
  loai_moc: string | null;
  dat: boolean | null;
  trang_thai: string | null;
  trang_thai_do: string | null;
  nguon_so: string | null;
  kieu_dich: string | null;
  chieu: string | null;
  chua_do_x: boolean | null;
  ket_thuc: string | null;
  ky: string | null;
  x_so: number | null;
  x_chu: string | null;
  y_so: number | null;
  y_chu: string | null;
  ten_don_vi: string | null;
  so: number | null;
  le_ra: number | null;
  pct: number | null;
  dang_tap_trung: boolean | null;
  ly_do_tra_lai: string | null;
  student_id: string | null;
  /** 0193: nguon_so='dem_em' → số em đạt / tổng số em được đếm. Null với nguồn khác. */
  tu_so?: number | null;
  mau_so?: number | null;
};

export const MT_COLS =
  'id, ten, linh_vuc, subject_id, mo_ta, don_vi_id, loai_moc, dat, trang_thai, trang_thai_do, nguon_so, kieu_dich, chieu, chua_do_x, ket_thuc, ky, x_so, x_chu, y_so, y_chu, ten_don_vi, so, le_ra, pct, dang_tap_trung, ly_do_tra_lai, student_id, tu_so, mau_so';

export type TruongWig = {id: string; ten: string | null; don_vi_id: string | null; ten_don_vi: string | null; so: number | null; y_so: number | null};
export type BuocLop = {id: string; tieu_de: string; phan_tram: number; xong: boolean};
export type LichSuTuan = {tuan_ket: string; so: number}[];
export type DayNoi = {chaId: string; gop: boolean};

export type CamKetToi = {
  id: string | null;
  noi_dung: string | null;
  so_hua: number | null;
  so_dat: number | null;
  ket_qua: string | null;
  ten_don_vi: string | null;
  muc_tieu_id: string | null;
  thuoc_id: string | null;
  tuan_bat_dau: string | null;
  tuan_ket_thuc: string | null;
  so_tuan: number | null;
  trang_thai: string | null;
};
export type ThuocToi = {id: string; ten: string; cach_ghi: string; chi_tieu_ky: number | null; ngay_ap_dung: number[] | null; don_vi_id: string | null; cam_ket_id: string | null};

// Làm tròn số hiển thị: tối đa 1 chữ số thập phân (số đo tính từ tick hay ra 1.98…).
export function dinhSo(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
