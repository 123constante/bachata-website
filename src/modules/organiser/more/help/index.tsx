import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { OrganiserShell } from '../../shell';
import { ORG_PATHS } from '../../shell/paths';
import { Card } from '../../ui';
import { HELP_ROWS } from './helpRows';

/** /account/o/more/help (C41): the short list of jobs, each a link into its flow. */
export default function HelpPage() {
  return (
    <OrganiserShell title="Help" back={{ to: ORG_PATHS.more, label: 'More' }} testId="org-page-help">
      <Card testId="help-rows">
        {HELP_ROWS.map((row) => (
          <Link
            key={row.id}
            to={row.to}
            className="flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[14px] text-[15px] text-[var(--fg)]"
            data-testid={`help-${row.id}`}
          >
            <span className="flex-1">{row.label}</span>
            <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
          </Link>
        ))}
      </Card>
    </OrganiserShell>
  );
}
