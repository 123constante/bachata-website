import { useState } from 'react';
import { useP3Home } from '../data/useP3Data';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { useOrganiserChoiceFrom } from '../../switch/useOrganiserChoice';

/** Page scope (F-26): the page Home, Events and Stats show, and a way to change it from the same screen. */
export function usePageScope() {
  const c = useOrganiserChoiceFrom(useP3Home());
  const seriesIds = new Set((c.selected?.series ?? []).map((s) => s.id));
  return { ...c, pageId: c.selected?.id ?? null, seriesIds };
}

/** The page name at the top; with 2+ pages a Switch page control that keeps the person on this screen. */
export function PageHeader({ selected, organisers, onChoose }: {
  selected: HomeOrganiser | null;
  organisers: readonly HomeOrganiser[];
  onChoose: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!selected) return null;
  const many = organisers.length >= 2;
  return (
    <div className="p3-page-scope" data-testid="p3-page-scope">
      <div className="p3-h2-row">
        <span className="p3-row-t" style={{ minWidth: 0, overflowWrap: 'anywhere' }} data-testid="p3-page-name">{selected.name}</span>
        {many && (
          <button type="button" className="p3-link p3-nowrap" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="p3-page-switch">
            Switch page
          </button>
        )}
      </div>
      {many && open && (
        <ul className="p3-card p3-list" aria-label="Your pages" data-testid="p3-page-list">
          {organisers.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="p3-row p3-row-link"
                aria-current={o.id === selected.id ? 'true' : undefined}
                onClick={() => { onChoose(o.id); setOpen(false); }}
                data-testid={`p3-page-pick-${o.id}`}
              >
                <span className="p3-row-t" style={{ overflowWrap: 'anywhere' }}>{o.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
