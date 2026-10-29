import { Link } from 'react-router-dom';
import { MESSAGE_US, type Gate } from '@/modules/organiser/shared/teamRules';
import { ORG_PATHS } from '../shell/paths';

/** A refused control's reason (teamRules), with Message us when only the Bachata Calendar team can do it. */
export function GateReason({ gate, id, testId }: { gate: Gate; id: string; testId: string }) {
  if (gate.ok || !gate.reason) return null;
  return (
    <p id={id} className="text-[13px] text-[var(--mut)]" data-testid={testId}>
      {gate.reason}
      {gate.messageUs && <>{' '}<Link to={ORG_PATHS.help} className="font-semibold underline">{MESSAGE_US}</Link></>}
    </p>
  );
}
