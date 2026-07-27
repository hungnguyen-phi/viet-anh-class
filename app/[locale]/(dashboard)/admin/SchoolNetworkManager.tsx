import {getTranslations} from 'next-intl/server';
import {Wifi, MapPin, Trash2} from 'lucide-react';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {
  addSchoolNetwork,
  addCurrentSchoolIp,
  setSchoolNetworkActive,
  deleteSchoolNetwork,
} from './network-actions';

type Network = {
  id: string;
  label: string;
  cidr: string;
  campus_id: string | null;
  is_active: boolean;
};
type Campus = {id: string; name: string};

const inp =
  'min-w-0 rounded-[10px] border-[1.5px] border-navy/15 bg-white px-3 py-2 text-[13px] font-semibold text-navy outline-none transition-all focus:border-navy';
const navyBtn =
  'h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] bg-navy px-3.5 text-[12px] font-extrabold text-white transition-all hover:bg-navy-700';
const gold =
  'btn-gold h-10 shrink-0 inline-flex items-center cursor-pointer whitespace-nowrap rounded-[10px] px-3.5 text-[12px] font-extrabold transition-all';

// Quản lý mạng/IP trường (cổng check-in). Server component: đọc IP hiện tại của admin từ header.
export async function SchoolNetworkManager({
  networks,
  campuses,
  currentIp,
}: {
  networks: Network[];
  campuses: Campus[];
  currentIp: string | null;
}) {
  const t = await getTranslations('admin');
  const campusName = new Map(campuses.map((c) => [c.id, c.name]));
  const activeCount = networks.filter((n) => n.is_active).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-grey-mid">{t('networkHint')}</p>

      {/* Cảnh báo: chưa cấu hình → không chặn ai */}
      {activeCount === 0 && (
        <div className="rounded-[12px] border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-[12.5px] font-bold text-navy">
          {t('networkNoneWarn')}
        </div>
      )}

      {/* IP hiện tại + thêm nhanh */}
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border-[1.5px] border-navy/10 bg-white/50 p-3">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-navy">
          <MapPin size={15} strokeWidth={2.2} className="text-gold-deep" />
          {t('yourIp')}:{' '}
          <code className="rounded-md bg-navy/[0.06] px-2 py-0.5 font-mono text-[12.5px]">
            {currentIp ?? '—'}
          </code>
        </span>
        {currentIp && (
          <form action={addCurrentSchoolIp} className="ml-auto flex items-center gap-2">
            <input type="hidden" name="label" value={t('thisDeviceIp')} />
            <select name="campus_id" aria-label={t('campus')} defaultValue="" className={`cursor-pointer ${inp} h-10`}>
              <option value="">{t('allCampuses')}</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className={gold}>
              + {t('addThisIp')}
            </button>
          </form>
        )}
      </div>

      {/* Thêm dải IP thủ công */}
      <form action={addSchoolNetwork} className="flex flex-wrap items-end gap-2">
        <input name="label" placeholder={t('networkLabel')} aria-label={t('networkLabel')} className={`${inp} min-w-[160px] flex-1`} required />
        <input name="cidr" placeholder={t('networkCidr')} aria-label={t('networkCidr')} className={`${inp} w-[190px] font-mono`} required />
        <select name="campus_id" aria-label={t('campus')} defaultValue="" className={`cursor-pointer ${inp} h-10`}>
          <option value="">{t('allCampuses')}</option>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className={navyBtn}>
          + {t('addNetwork')}
        </button>
      </form>

      {/* Danh sách */}
      <div className="overflow-hidden rounded-[14px] border-[1.5px] border-navy/10">
        {networks.map((n, i) => (
          <div
            key={n.id}
            className={`flex flex-wrap items-center gap-2 px-3.5 py-2.5 ${
              i > 0 ? 'border-t border-navy/[0.08]' : ''
            } ${n.is_active ? '' : 'opacity-55'}`}
          >
            <Wifi size={15} strokeWidth={2.2} className="shrink-0 text-gold-deep" />
            <span className="text-[13px] font-bold text-navy">{n.label}</span>
            <code className="rounded-md bg-navy/[0.06] px-2 py-0.5 font-mono text-[12px] text-txt">
              {n.cidr}
            </code>
            <span className="text-[11.5px] font-semibold text-grey-mid">
              {n.campus_id ? campusName.get(n.campus_id) ?? '' : t('allCampuses')}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <form action={setSchoolNetworkActive}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="active" value={(!n.is_active).toString()} />
                <button
                  type="submit"
                  className="h-8 cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] border-navy/20 bg-white px-2.5 text-[11.5px] font-extrabold text-navy transition-all hover:border-navy"
                >
                  {n.is_active ? t('turnOff') : t('turnOn')}
                </button>
              </form>
              <form action={deleteSchoolNetwork}>
                <input type="hidden" name="id" value={n.id} />
                <ConfirmButton
                  message={t('confirmDeleteNetwork')}
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                >
                  <Trash2 size={13} strokeWidth={2.2} />
                </ConfirmButton>
              </form>
            </span>
          </div>
        ))}
        {networks.length === 0 && (
          <div className="px-3.5 py-3 text-[13px] text-grey-mid">{t('none')}</div>
        )}
      </div>
    </div>
  );
}
