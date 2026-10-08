import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { Chip } from '../ui';

/**
 * A row of chips, one per organiser, shown only when there are several (the
 * old /account listed them and let you pick one). Wraps, never scrolls sideways.
 */
export function OrganiserSwitcher({ organisers, selectedId, onChoose }: {
  organisers: HomeOrganiser[];
  selectedId: string | null;
  onChoose: (id: string) => void;
}) {
  if (organisers.length < 2) return null;
  return (
    <div role="group" aria-label="Choose an organiser" className="flex flex-wrap gap-2" data-testid="org-switcher">
      {organisers.map((o) => (
        <Chip key={o.id} selected={o.id === selectedId} onToggle={() => onChoose(o.id)} testId={`org-switch-${o.id}`}>
          <span className="max-w-[14rem] truncate">{o.name}</span>
        </Chip>
      ))}
    </div>
  );
}
