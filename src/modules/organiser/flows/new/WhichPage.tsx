import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { OrganiserShell } from '@/modules/organiser/shell/OrganiserShell';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { PrimaryButton } from '@/modules/organiser/ui';
import { WHICH_PAGE_TITLE, pageChosenHref } from './whichPageModel';

/**
 * Arc 1 flow 7b: the login runs 2 or more pages, so New event first asks which
 * one. The page Home (or the page itself) opened it for starts ticked; one tap
 * on Continue keeps it.
 */
export function WhichPageStep({ organisers, selectedId }: { organisers: HomeOrganiser[]; selectedId: string | null }) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(selectedId ?? organisers[0]?.id ?? null);
  return (
    <OrganiserShell title={WHICH_PAGE_TITLE} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-new-page">
      <div className="flex flex-col gap-[12px] p-[12px]">
        <div role="radiogroup" aria-label="Pages" className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--card)]">
          {organisers.map((o) => {
            const on = o.id === chosen;
            const Icon = on ? Check : Circle;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                data-org={o.id}
                data-testid="org-new-page-row"
                onClick={() => setChosen(o.id)}
                className="flex min-h-[56px] w-full items-center gap-[12px] border-b border-[var(--line)] px-[16px] text-left last:border-b-0"
              >
                <Icon aria-hidden="true" className={on ? 'h-[20px] w-[20px] shrink-0 text-[var(--gold)]' : 'h-[20px] w-[20px] shrink-0 text-[var(--mut)]'} />
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[var(--fg)]">{o.name}</span>
              </button>
            );
          })}
        </div>
        <PrimaryButton disabled={!chosen} onClick={() => chosen && navigate(pageChosenHref(ORG_PATHS.newWhat, chosen))} testId="org-new-page-continue">
          Continue
        </PrimaryButton>
      </div>
    </OrganiserShell>
  );
}
