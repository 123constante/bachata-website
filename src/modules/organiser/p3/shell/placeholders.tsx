import { L } from '../model/labels';
import type { P3Tab } from './paths';

/** W0 placeholder: the tab exists and says what comes; no data is read. */
export function P3Placeholder({ tab }: { tab: P3Tab }) {
  return (
    <div className="p3-card" data-testid={`p3-placeholder-${tab}`}>
      <strong>{L.tabs[tab]}</strong>
      Coming soon &mdash; this part of the new organiser area is being built.
    </div>
  );
}
