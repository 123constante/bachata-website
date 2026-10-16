import { useNavigate } from 'react-router-dom';
import { dateLock } from '@/modules/organiser/shared/eventState';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { PrimaryButton } from '../ui';

/** eventState's past-date refusal, read from its source so it never drifts (C34). */
export const STALE_DATE_TEXT = dateLock('live', '1970-01-01', '1970-01-02') ?? '';

/**
 * C34, the shared refusal shape: a link to a date that has passed shows the
 * past-date text verbatim and ONE button, Home. S2/S3 import it from here.
 */
export function StaleLink({ title = 'Home' }: { title?: string }) {
  const navigate = useNavigate();
  return (
    <OrganiserShell title={title} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-stale-link" topBarEnd={<span aria-hidden="true" className="w-[44px]" />}>
      <div className="space-y-[16px]">
        <p data-testid="stale-link-text" className="text-[15px] text-[var(--fg)]">{STALE_DATE_TEXT}</p>
        <PrimaryButton onClick={() => navigate(ORG_PATHS.home)} testId="stale-link-home">Home</PrimaryButton>
      </div>
    </OrganiserShell>
  );
}
