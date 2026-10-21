import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ARTIST_ROLES, LINEUP_EMPTY, MAX_ARTISTS, addArtist, lineupLine, removeArtist, setArtistRole, type ArtistRole, type FestivalDraft } from './festivalModel';
import { FIELD_CLASS, SearchField, useDebounced } from '../../ui';

export interface FestivalArtistsProps {
  draft: FestivalDraft;
  onChange: (next: FestivalDraft) => void;
  search: (term: string, role: 'teaching' | 'djing') => Promise<{ id: string; name: string }[]>;
}

const searchRoleOf = (role: ArtistRole): 'teaching' | 'djing' => (role === 'dj' ? 'djing' : 'teaching');

/** ONE artist list. Search people, pick a role; the list is the line-up. */
export function FestivalArtists({ draft, onChange, search }: FestivalArtistsProps) {
  const [role, setRole] = useState<ArtistRole>('teacher');
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<{ id: string; name: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const q = useDebounced(term.trim(), 250);
  useEffect(() => {
    let live = true;
    if (q.length < 2) return undefined;
    search(q, searchRoleOf(role)).then((r) => { if (live) { setHits(r); setFailed(false); } }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [q, role, search]);
  const full = draft.artists.length >= MAX_ARTISTS;
  return (
    <div className="space-y-[12px]" data-testid="festival-artists">
      <p className="text-[15px] text-[var(--fg)]" data-testid="festival-lineup">{draft.artists.length ? lineupLine(draft.artists) : LINEUP_EMPTY}</p>
      <ul className="space-y-[8px]">
        {draft.artists.map((a) => (
          <li key={a.personId} className="flex min-h-[52px] items-center gap-[8px] rounded-[var(--r-card,16px)] border border-[var(--line)] bg-[var(--card)] px-[12px]" data-testid={`festival-artist-${a.personId}`}>
            <span className="min-w-0 flex-1 truncate text-[16px] text-[var(--fg)]">{a.name}</span>
            <select aria-label={`Role of ${a.name}`} className={`${FIELD_CLASS} h-[44px] w-auto`} value={a.role} onChange={(e) => onChange(setArtistRole(draft, a.personId, e.target.value as ArtistRole))}>
              {ARTIST_ROLES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
            </select>
            <button type="button" aria-label={`Remove ${a.name}`} className="flex h-[44px] w-[44px] items-center justify-center" onClick={() => onChange(removeArtist(draft, a.personId))}>
              <X aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-[8px]" role="group" aria-label="Add as">
        {ARTIST_ROLES.map((r) => (
          <button key={r.role} type="button" aria-pressed={role === r.role} onClick={() => setRole(r.role)}
            className={`h-[44px] flex-1 rounded-[var(--r-ctl,12px)] border text-[15px] font-semibold ${role === r.role ? 'border-[var(--gold)] text-[var(--fg)]' : 'border-[var(--line-strong)] text-[var(--mut)]'}`}>{r.label}</button>
        ))}
      </div>
      {!full && <SearchField value={term} onChange={setTerm} aria-label={`Search for a ${ARTIST_ROLES.find((r) => r.role === role)?.label.toLowerCase()}`} testId="festival-artist-search" />}
      {full && <p className="text-[13px] text-[var(--mut)]">At most {MAX_ARTISTS} artists</p>}
      {failed && <p role="alert" className="text-[13px] text-[var(--danger)]">Search failed. Try again.</p>}
      {q.length >= 2 && !failed && hits.length === 0 && <p className="text-[13px] text-[var(--mut)]">No one found. Try another name.</p>}
      <ul>
        {(q.length < 2 ? [] : hits).filter((h) => !draft.artists.some((a) => a.personId === h.id)).map((h) => (
          <li key={h.id}>
            <button type="button" className="flex min-h-[52px] w-full items-center text-left text-[16px] text-[var(--fg)]" data-testid={`festival-hit-${h.id}`}
              onClick={() => { onChange(addArtist(draft, { personId: h.id, name: h.name, role })); setTerm(''); setHits([]); }}>{h.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
