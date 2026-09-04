import {getTranslations} from 'next-intl/server';
import {Check} from 'lucide-react';
import type {Area, AreaMeta} from '@/lib/areas';
import {ngayVN} from '@/lib/dates';
import {DonutRing} from '@/components/charts/DonutRing';
import {NutTaoMucTieuToi} from '@/components/wig/NutTaoMucTieuToi';
import {NutThemCamKetToi} from '@/components/wig/NutThemCamKetToi';
import {SuaCamKetToi} from '@/components/wig/SuaCamKetToi';
import {TickCuaToi} from '@/components/wig/TickCuaToi';
import {SuaThuocToi} from '@/components/wig/SuaThuocToi';
import {GhiSoToi} from '@/components/wig/GhiSoToi';
import {ChamCamKetToi} from '@/components/wig/ChamCamKetToi';
import {NutThemThuoc} from '@/components/wig/NutThemThuoc';
import {BieuDoThat} from '@/components/wig/TheMucTieuLop';
import type {DonViChon, MucTieuLopChon} from '@/components/student/FormMucTieu';
import {dinhSo, type CamKetToi, type DayNoi, type LichSuTuan, type MucTieuV, type ThuocToi} from '@/components/wig/kieu-wig';

// KHU "MỤC TIÊU CỦA TÔI" (0181) — thầy cô CHỦ NHIỆM có mục tiêu cá nhân như em, nối vào mục tiêu
// lớp; cam kết tuần + thước đo dẫn dắt treo ở đây. Tách khỏi wig/page.tsx (04/09).
export async function KhuMucTieuToi({
  mucTieuToi,
  areaMeta,
  noiCuaToi,
  tenWigLop,
  lichSu,
  camKetCuaToi,
  thuocTheoCamKet,
  daTickTheoThuoc,
  tongSoTheoThuoc,
  weekDays,
  dayShort,
  todayVN,
  laTuanNay,
  tuongLai,
  monday,
  weekQ,
  classId,
  profileId,
  donViList,
  nhanTheoArea,
  mucTieuLopChon,
}: {
  mucTieuToi: MucTieuV[];
  areaMeta: Record<Area, AreaMeta>;
  noiCuaToi: Map<string, DayNoi>;
  tenWigLop: Map<string, string>;
  lichSu: Map<string, LichSuTuan>;
  camKetCuaToi: Map<string, CamKetToi[]>;
  thuocTheoCamKet: Map<string, ThuocToi[]>;
  daTickTheoThuoc: Map<string, string[]>;
  tongSoTheoThuoc: Map<string, number>;
  weekDays: string[];
  dayShort: string[];
  todayVN: string;
  laTuanNay: boolean;
  tuongLai: boolean;
  monday: string;
  weekQ: string;
  classId: string;
  profileId: string;
  donViList: DonViChon[];
  nhanTheoArea: Record<string, string>;
  mucTieuLopChon: MucTieuLopChon[];
}) {
  const t = await getTranslations('lopMucTieu');
  const tMt = await getTranslations('mucTieu');
  const tCk = await getTranslations('camKet');

  return (
    <section className="glass flex flex-col gap-3 rounded-[20px] p-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-[15px] font-bold text-navy">{t('khuMucTieuToi')}</h2>
        <div className="ml-auto">
          <NutTaoMucTieuToi teacherId={profileId} classId={classId} nhanTheoArea={nhanTheoArea} donViList={donViList} mucTieuLop={mucTieuLopChon} />
        </div>
      </div>
      {mucTieuToi.length === 0 ? (
        <p className="text-[12.5px] font-semibold text-grey-mid">{t('mucTieuToiTrong')}</p>
      ) : (
        mucTieuToi.map((m) => {
          const meta = areaMeta[(m.linh_vuc ?? 'knowledge') as Area];
          const dv = m.ten_don_vi ?? '';
          const day = noiCuaToi.get(m.id);
          const ls = lichSu.get(m.id) ?? [];
          return (
            <div
              key={m.id}
              style={{borderColor: `color-mix(in srgb, ${meta.hex} 30%, white)`, background: `color-mix(in srgb, ${meta.hex} 6%, white)`}}
              className="flex flex-col gap-2 rounded-[14px] border-[1.5px] p-3.5"
            >
              <div className="flex flex-wrap items-start gap-3.5">
                {m.pct != null ? (
                  <DonutRing pct={Number(m.pct)} color={meta.hex} size={54} />
                ) : (
                  <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-navy/[0.05] text-[11px] font-extrabold text-grey-mid">—</span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="font-display text-[15px] font-bold text-navy">{m.ten ?? ''}</span>
                  <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-grey-mid">
                    {m.loai_moc === 'do_luong' && m.y_so != null ? (
                      <span className="text-[13.5px] font-extrabold tabular-nums text-navy">
                        {m.so != null ? dinhSo(m.so) : '—'}
                        <span className="font-bold text-grey-mid">
                          {' / '}
                          {dinhSo(m.y_so)} {dv}
                        </span>
                      </span>
                    ) : null}
                    <span>{tMt('denHan', {ngay: ngayVN(m.ket_thuc)})}</span>
                  </p>
                  {day && (
                    <p className="mt-0.5 text-[11.5px] font-semibold text-grey-mid">
                      {t('huongLop', {ten: tenWigLop.get(day.chaId) ?? ''})}
                      {day.gop ? ` · ${t('congVaoLop')}` : ''}
                    </p>
                  )}
                </div>
                {m.y_so != null && ls.length >= 2 && (
                  <div className="ml-auto shrink-0 self-center">
                    <BieuDoThat lichSu={ls} dich={Number(m.y_so)} mau={meta.hex} />
                  </div>
                )}
              </div>

              {/* CAM KẾT TUẦN của tôi cho mục tiêu này. */}
              <div className="mt-1 flex flex-col gap-1.5 rounded-[12px] bg-white/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-grey-mid">{t('camKetToiNhan')}</p>
                  <NutThemCamKetToi classId={classId} weekQ={weekQ} monday={monday} mucTieuId={m.id} tenMucTieu={m.ten ?? ''} tenDonVi={m.ten_don_vi} />
                </div>
                {(camKetCuaToi.get(m.id) ?? []).length === 0 ? (
                  <p className="text-[11.5px] font-semibold italic text-grey-mid">{t(tuongLai ? 'camKetToiTuLan' : 'camKetToiTrong')}</p>
                ) : (
                  (camKetCuaToi.get(m.id) ?? []).map((c) => (
                    <div key={c.id} className="flex flex-col gap-2 rounded-[10px] border border-navy/10 bg-white p-2.5">
                      {/* Tiêu đề TRỌN HÀNG; chip xuống hàng hai — hết cảnh một-từ-một-dòng ở 360 px. */}
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 text-[13.5px] font-bold leading-snug text-navy">{c.noi_dung}</span>
                        <SuaCamKetToi camKetId={c.id ?? ''} noiDung={c.noi_dung ?? ''} soHua={c.so_hua} tenDonVi={c.ten_don_vi} classId={classId} weekQ={weekQ} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.so_hua != null && (
                          <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[11px] font-bold tabular-nums text-grey-mid">
                            {tCk('chipSo', {dat: c.so_dat ?? 0, hua: c.so_hua, dv: c.ten_don_vi ?? ''})}
                          </span>
                        )}
                        {c.ket_qua === 'thang' && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-extrabold text-success-dark">
                            <Check size={10} strokeWidth={3} />
                            {tCk('thang')}
                          </span>
                        )}
                        {c.ket_qua === 'thua' && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-status-bad/[0.12] px-2 py-0.5 text-[10.5px] font-extrabold text-status-bad">{tCk('thua')}</span>
                        )}
                      </div>
                      <ChamCamKetToi
                        camKetId={c.id ?? ''}
                        soHua={c.so_hua != null ? Number(c.so_hua) : null}
                        soDat={c.so_dat != null ? Number(c.so_dat) : null}
                        ketQua={c.ket_qua ?? null}
                        tenDonVi={c.ten_don_vi}
                      />
                      {/* CHÙM THƯỚC ĐO DẪN DẮT của cam kết (0185: nhiều thước) — tick hoặc ghi số. */}
                      {(thuocTheoCamKet.get(c.id ?? '') ?? []).map((th) => (
                        <div key={th.id} className="rounded-[8px] bg-navy/[0.03] p-2">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-[12px] font-extrabold text-navy">{th.ten}</p>
                            <SuaThuocToi
                              thuocId={th.id}
                              ten={th.ten}
                              cachGhi={th.cach_ghi}
                              chiTieu={Number(th.chi_tieu_ky ?? 0)}
                              ngayApDung={th.ngay_ap_dung ?? [1, 2, 3, 4, 5]}
                              donViId={th.don_vi_id}
                              classId={classId}
                              weekQ={weekQ}
                              coLuot={(daTickTheoThuoc.get(th.id) ?? []).length > 0 || (tongSoTheoThuoc.get(th.id) ?? 0) > 0}
                              donViList={donViList}
                            />
                          </div>
                          {th.cach_ghi === 'cham' ? (
                            <TickCuaToi
                              leadId={th.id}
                              studentId={profileId}
                              ngayApDung={th.ngay_ap_dung ?? [1, 2, 3, 4, 5, 6, 7]}
                              days={weekDays}
                              daTick={daTickTheoThuoc.get(th.id) ?? []}
                              today={todayVN}
                              moKhoa={laTuanNay}
                              dayShort={dayShort}
                            />
                          ) : (
                            <GhiSoToi leadId={th.id} studentId={profileId} today={todayVN} tongTuan={tongSoTheoThuoc.get(th.id) ?? 0} chiTieu={Number(th.chi_tieu_ky ?? 0)} donVi={c.ten_don_vi ?? ''} />
                          )}
                        </div>
                      ))}
                      {laTuanNay && !c.ket_qua && (
                        <NutThemThuoc mode="toi" camKetId={c.id ?? ''} classId={classId} weekQ={weekQ} monday={monday} donViList={donViList} />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
