import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePublicVenues, venueName } from './publicVenues';

/**
 * Pick a venue from the venues listed on Bachata Calendar (the public venue
 * directory's read). A venue that is not listed yet is the team's to add; the
 * picker says so rather than taking free text.
 */

interface Props {
  id: string;
  value: string | null;
  onChange: (venueId: string) => void;
  /** Shown when the current value is not in the public list. */
  fallbackLabel?: string;
}

export function VenuePicker({ id, value, onChange, fallbackLabel = 'Venue set by the Bachata Calendar team' }: Props) {
  const venues = usePublicVenues();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const current = venueName(venues.data, value) ?? (value ? fallbackLabel : 'No venue yet');

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return (venues.data ?? [])
      .filter((v) => v.name.toLowerCase().includes(term) || (v.neighbourhood ?? '').toLowerCase().includes(term))
      .slice(0, 8);
  }, [query, venues.data]);

  return (
    <div className="space-y-1.5" data-testid={`${id}-picker`}>
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" data-testid={`${id}-current`}>{current}</span>
        <button type="button" className="text-xs text-primary shrink-0" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Keep this venue' : 'Change venue'}
        </button>
      </div>
      {open && (
        <div className="space-y-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" aria-hidden="true" />
            <Input
              id={id}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search venues by name"
              className="h-9 text-sm pl-8"
              autoComplete="off"
            />
          </div>
          {venues.isLoading && <p className="text-xs text-muted-foreground">Loading venues…</p>}
          {matches.length > 0 && (
            <ul className="rounded-md border border-border divide-y divide-border/60">
              {matches.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                    data-testid="venue-option"
                    onClick={() => {
                      onChange(v.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="block font-medium">{v.name}</span>
                    {(v.neighbourhood || v.city_name) && (
                      <span className="block text-xs text-muted-foreground">{[v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !venues.isLoading && matches.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No listed venue matches. Send the venue to the Bachata Calendar team and we will add it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
