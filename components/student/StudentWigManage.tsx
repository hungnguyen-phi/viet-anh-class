'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {inputInline, btnNavy, btnGhost} from '@/components/ui/Field';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {SubmitButton} from '@/components/ui/SubmitButton';
import {
  editStudentWig,
  deleteStudentWig,
  editStudentLead,
  deleteStudentLead,
  removeLeadEntry,
} from '@/app/[locale]/(dashboard)/student/actions';

export type ManageWig = {
  id: string;
  areaLabel: string;
  periodLabel: string; // đã dịch: "Năm"/"Tuần · W38"
  isYear: boolean;
  target: number;
  unit: string;
  period_label: string | null;
};
export type ManageLead = {
  id: string;
  wigId: string;
  title: string;
  target: number;
  unit: string | null;
  entries: {id: string; date: string}[];
};

// Man hoc sinh -> dung bo dieu khien chung 44px: vua thang hang (truoc day o ~36px dung canh
// nut h-8 = 32px), vua dat nguong vung cham cho tay tre con tren dien thoai.
const inp = inputInline;
const navyBtn = btnNavy;
const ghost = btnGhost;
const danger =
  'grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-[8px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]';

export function StudentWigManage({
  studentId,
  wigs,
  leads,
}: {
  studentId: string;
  wigs: ManageWig[];
  leads: ManageLead[];
}) {
  const t = useTranslations('studentWig');
  const [editWigId, setEditWigId] = useState<string | null>(null);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);

  const leadsByWig = new Map<string, ManageLead[]>();
  for (const l of leads) {
    const arr = leadsByWig.get(l.wigId) ?? [];
    arr.push(l);
    leadsByWig.set(l.wigId, arr);
  }
  const weekWigs = wigs.filter((w) => !w.isYear);

  if (wigs.length === 0) return null;

  return (
    <details className="glass rounded-[20px] p-[18px]">
      <summary className="cursor-pointer list-none font-display text-[15px] font-bold text-navy">
        ⚙ {t('manageTitle')}
      </summary>
      <p className="mb-3 mt-1 text-[11.5px] italic text-grey-mid">{t('manageHint')}</p>

      {/* WIG năm */}
      <div className="flex flex-col gap-2">
        {wigs
          .filter((w) => w.isYear)
          .map((w) => (
            <WigRowEdit
              key={w.id}
              w={w}
              studentId={studentId}
              editing={editWigId === w.id}
              onEdit={() => setEditWigId(w.id)}
              onCancel={() => setEditWigId(null)}
              t={t}
            />
          ))}
      </div>

      {/* WIG tuần + lead + lượt tick */}
      {weekWigs.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-navy/[0.08] pt-3">
          {weekWigs.map((w) => (
            <div key={w.id} className="rounded-[12px] border-[1.5px] border-navy/10 p-2.5">
              <WigRowEdit
                w={w}
                studentId={studentId}
                editing={editWigId === w.id}
                onEdit={() => setEditWigId(w.id)}
                onCancel={() => setEditWigId(null)}
                t={t}
              />
              <div className="mt-2 flex flex-col gap-1.5">
                {(leadsByWig.get(w.id) ?? []).map((l) =>
                  editLeadId === l.id ? (
                    <form
                      key={l.id}
                      action={editStudentLead}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <input type="hidden" name="student_id" value={studentId} />
                      <input type="hidden" name="lead_measure_id" value={l.id} />
                      <input name="title"
                aria-label={t('titleLabel')} defaultValue={l.title} className={`${inp} min-w-[140px] flex-1`} required />
                      <input name="target_value" aria-label={t('target')} type="number" step="any" min="0.01" defaultValue={l.target} className={`${inp} w-20`} required />
                      <input name="unit" defaultValue={l.unit ?? ''} placeholder={t('unit')} aria-label={t('unit')} className={`${inp} min-w-[112px] flex-1`} />
                      <SubmitButton className={navyBtn}>{t('save')}</SubmitButton>
                      <button type="button" onClick={() => setEditLeadId(null)} className={ghost}>{t('cancel')}</button>
                    </form>
                  ) : (
                    <div key={l.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-bold text-navy">{l.title}</span>
                      <span className="text-[11px] font-semibold text-grey-mid">
                        ({l.entries.length}/{l.target} {l.unit ?? ''})
                      </span>
                      {/* Lượt tick — gỡ từng cái nếu sai */}
                      {l.entries.map((e) => (
                        <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-bold text-txt">
                          {e.date.slice(5)}
                          <form action={removeLeadEntry} className="contents">
                            <input type="hidden" name="student_id" value={studentId} />
                            <input type="hidden" name="entry_id" value={e.id} />
                            <button type="submit" title={t('removeTick')} className="cursor-pointer text-status-bad hover:opacity-70">✕</button>
                          </form>
                        </span>
                      ))}
                      <span className="ml-auto flex items-center gap-1.5">
                        <button type="button" onClick={() => setEditLeadId(l.id)} className={ghost}>{t('edit')}</button>
                        <form action={deleteStudentLead}>
                          <input type="hidden" name="student_id" value={studentId} />
                          <input type="hidden" name="lead_measure_id" value={l.id} />
                          <ConfirmButton message={t('confirmDeleteLead')} label={t('deleteLead')} className={danger}>✕</ConfirmButton>
                        </form>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

function WigRowEdit({
  w,
  studentId,
  editing,
  onEdit,
  onCancel,
  t,
}: {
  w: ManageWig;
  studentId: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (editing) {
    return (
      <form action={editStudentWig} className="flex flex-wrap items-center gap-1.5">
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="wig_id" value={w.id} />
        <span className="text-[12.5px] font-extrabold text-navy">{w.areaLabel}</span>
        <input name="target_value" aria-label={t('target')} type="number" step="any" min="0.01" defaultValue={w.target} className={`${inp} w-20`} required />
        <input name="unit" defaultValue={w.unit} placeholder={t('unit')} aria-label={t('unit')} className={`${inp} min-w-[112px] flex-1`} required />
        <input name="period_label" defaultValue={w.period_label ?? ''} placeholder={t('label')} aria-label={t('label')} className={`${inp} w-28`} />
        <SubmitButton className={navyBtn}>{t('save')}</SubmitButton>
        <button type="button" onClick={onCancel} className={ghost}>{t('cancel')}</button>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12.5px] font-extrabold text-navy">{w.areaLabel}</span>
      <span className="rounded-full bg-navy/[0.06] px-2 py-0.5 text-[10.5px] font-bold text-grey-mid">{w.periodLabel}</span>
      <span className="text-[11.5px] font-semibold text-grey-mid">{w.target} {w.unit}</span>
      <span className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={onEdit} className={ghost}>{t('edit')}</button>
        <form action={deleteStudentWig}>
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="wig_id" value={w.id} />
          <ConfirmButton message={t('confirmDeleteWig')} label={t('deleteWig')} className={danger}>✕</ConfirmButton>
        </form>
      </span>
    </div>
  );
}
