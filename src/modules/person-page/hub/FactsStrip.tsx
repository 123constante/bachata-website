import { HUB, WALL } from '../wall/tokens';

/** Only facts that exist; no strip at all when there are none (thin pages stay short). */
export function FactsStrip({ facts }: { facts: readonly string[] }) {
  if (facts.length === 0) return null;
  return (
    <ul
      data-testid="hub-facts"
      className="mt-3 flex flex-wrap gap-x-4 gap-y-1"
      style={{ color: WALL.text, fontSize: HUB.body, borderTop: `1px solid ${WALL.line}`, paddingTop: 10 }}
    >
      {facts.map((f) => (
        <li key={f} className="break-words">
          <span aria-hidden="true" style={{ color: WALL.muted }}>&bull;</span> {f}
        </li>
      ))}
    </ul>
  );
}
