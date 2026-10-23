// "It's live" (invite journey W2): after Go live, ONE optional card per role
// page the person has (or just said Yes to), linking into that role's editor.
// "Maybe later" hides the card; nothing is saved either way.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_AREA_PATHS } from '@/modules/areas/shared/paths';
import type { OfferRole } from './doneState';

export const OFFER_TITLE: Record<OfferRole, string> = {
  teacher: 'Make your teacher page stand out',
  dj: 'Make your DJ page stand out',
};
export const OFFER_LINE: Record<OfferRole, string> = {
  teacher: 'Add your experience, classes and a photo, so dancers know who they are learning from.',
  dj: 'Add a photo and the music you play, so dancers know whose set they are coming to.',
};
export const OFFER_OPEN_LABEL: Record<OfferRole, string> = { teacher: 'Open my teacher page', dj: 'Open my DJ page' };
export const MAYBE_LATER_LABEL = 'Maybe later';

export function ItsLiveOffer({ roles }: { roles: readonly OfferRole[] }) {
  const [hidden, setHidden] = useState<OfferRole[]>([]);
  const shown = roles.filter((r) => !hidden.includes(r));
  if (shown.length === 0) return null;
  return (
    <div className="space-y-3" data-testid="org-done-offer">
      {shown.map((r) => (
        <section key={r} aria-labelledby={`offer-${r}`} data-testid={`org-done-offer-${r}`} className="space-y-2 rounded-[12px] border border-[var(--line)] p-3">
          <h2 id={`offer-${r}`} className="text-[15px] font-bold text-[var(--fg)]">{OFFER_TITLE[r]}</h2>
          <p className="text-[13px] text-[var(--mut)]">{OFFER_LINE[r]}</p>
          <div className="flex items-center gap-3">
            <Link to={DEFAULT_AREA_PATHS[r].profile} data-testid={`org-done-offer-${r}-open`} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--gold)] underline underline-offset-4">
              {OFFER_OPEN_LABEL[r]}
            </Link>
            <button type="button" data-testid={`org-done-offer-${r}-later`} onClick={() => setHidden((h) => [...h, r])} className="inline-flex min-h-[44px] items-center px-2 text-[15px] font-semibold text-[var(--mut)]">
              {MAYBE_LATER_LABEL}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
