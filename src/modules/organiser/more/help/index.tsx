import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useOrgSurface } from '../../shell/surface';
import { Card } from '../../ui';
import { helpRows } from './helpRows';

/** /account/o/more/help (C41), and P3's /you/help: the short list of jobs, each a link into its flow. */
export default function HelpPage() {
  const { Shell, paths, moreTitle } = useOrgSurface();
  return (
    <Shell title="Help" back={{ to: paths.more, label: moreTitle }} testId="org-page-help">
      <Card testId="help-rows">
        {helpRows(paths).map((row) => (
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
    </Shell>
  );
}
