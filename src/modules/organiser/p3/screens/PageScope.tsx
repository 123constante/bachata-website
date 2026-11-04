import { useState } from 'react';
import { Link } from 'react-router-dom';
import { P3_PATHS } from '../shell/paths';
import { StateCard } from './parts';
import { useP3Home } from '../data/useP3Data';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { useOrganiserChoiceFrom } from '../../switch/useOrganiserChoice';

/** Page scope (F-26): the page Home, Events and Stats show, and a way to change it from the same screen. */
export function usePageScope() {
  const c = useOrganiserChoiceFrom(useP3Home());
  const seriesIds = new Set((c.selected?.series ?? []).map((s) => s.id));
  const noPage = !c.home.isPending && !c.home.isError && c.organisers.length === 0;
  // The choice is resolved only once the read is in and, with pages to choose from, one is selected:
  // until then no screen shows any page's data (an unresolved choice must never read as "all pages").
  const loading = !!c.home.isPending || (c.organisers.length > 0 && !c.selected);
  return { ...c, pageId: c.selected?.id ?? null, seriesIds, noPage, loading };
}

/** A person with no page at all, on Events or Stats: nothing to scope, so say how to get a page. */
export function NoPageCard({ testId, what }: { testId: string; what: string }) {
  return (
    <StateCard title="You don&rsquo;t have a page yet" testId={testId}>
      <p>{what} show here once you run a page. Find your page or create one to get started.</p>
      <Link className="p3-btn p3-btn-line p3-btn-link" to={P3_PATHS.start} data-testid="p3-nopage-start">Find or create a page</Link>
    </StateCard>
  );
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
                <span className="p3-row-t p3-grow" style={{ overflowWrap: 'anywhere' }}>{o.name}</span>
                {o.id === selected.id && <span aria-hidden="true" data-testid="p3-page-current">&#10003;</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
