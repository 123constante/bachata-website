import { useId, useMemo, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVenueOptions, venueName } from './publicVenues';
import { emptyVenueRequest, submitVenueRequest, venueRequestProblems, type VenueRequestForm } from '../venueRequest';

/**
 * Pick a venue the calendar knows (every venue, drafts included: useVenueOptions). A venue
 * it does not know yet is the team's to add; "Ask the team to add it" sends the request to
 * their Listing requests queue (venueRequest.ts) rather than taking free text here.
 * Fields are a literal 16px at every width: iOS zooms into anything smaller, and the fluid
 * root makes text-base less than 16px.
 */

interface Props {
  id: string;
  value: string | null;
  onChange: (venueId: string) => void;
  /** Shown when the current value is not in the list. */
  fallbackLabel?: string;
  /** Who is asking, carried in a venue request so the team knows whose event it is. */
  organiserName?: string | null;
}

export function VenuePicker({ id, value, onChange, fallbackLabel = 'Venue set by the Bachata Calendar team', organiserName = null }: Props) {
  const venues = useVenueOptions();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const current = venueName(venues.data, value) ?? (value ? fallbackLabel : 'No venue yet');

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return (venues.data ?? [])
      .filter((v) =>
        [v.name, v.neighbourhood, v.city_name, v.postcode].some((f) => (f ?? '').toLowerCase().includes(term)),
      )
      .slice(0, 8);
  }, [query, venues.data]);

  return (
    <div className="space-y-1.5" data-testid={`${id}-picker`}>
      <div className="flex items-center gap-2 text-sm">
        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate" data-testid={`${id}-current`}>{current}</span>
        {/* Closed, the field's <label> points here, so it is never a label for nothing; the
            name keeps "Change venue" first and says which venue is set now. */}
        <button
          type="button"
          id={open ? undefined : id}
          className="text-xs text-primary shrink-0 tap-link disabled:text-muted-foreground"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? undefined : value ? `Change venue, now ${current}` : 'Change venue, none chosen yet'}
        >
          {open ? (value ? 'Keep this venue' : 'Close') : 'Change venue'}
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
              placeholder="Search venues by name or area"
              className="h-9 text-[16px] md:text-[16px] pl-8"
              autoComplete="off"
              enterKeyHint="search"
              // Opened on purpose to search: go straight to the box.
              autoFocus
            />
          </div>
          {venues.isLoading && <p className="text-xs text-muted-foreground">Loading venues&hellip;</p>}
          {venues.isError && <p className="text-xs text-destructive" role="alert">Could not load the venues. Try again in a moment.</p>}
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
                      setAsking(false);
                    }}
                  >
                    <span className="block font-medium">{v.name}</span>
                    {(v.neighbourhood || v.city_name || v.postcode) && (
                      <span className="block text-xs text-muted-foreground">{[v.neighbourhood, v.city_name, v.postcode].filter(Boolean).join(', ')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !venues.isLoading && matches.length === 0 && !asking && (
            <p className="text-xs text-muted-foreground" role="status" data-testid="venue-no-match">
              No venue matches &ldquo;{query.trim()}&rdquo;.{' '}
              <button type="button" className="text-primary font-medium tap-link-inline" onClick={() => setAsking(true)} data-testid="venue-request-open">
                Ask the team to add it
              </button>
            </p>
          )}
          {asking && <VenueRequest key={query} initialName={query.trim()} organiserName={organiserName} onClose={() => setAsking(false)} />}
        </div>
      )}
    </div>
  );
}

function VenueRequest({ initialName, organiserName, onClose }: { initialName: string; organiserName: string | null; onClose: () => void }) {
  const [form, setForm] = useState<VenueRequestForm>(() => emptyVenueRequest(initialName));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = venueRequestProblems(form);
  const set = (key: keyof VenueRequestForm, v: string) => setForm((f) => ({ ...f, [key]: v }));
  const ids = useId();

  const send = async () => {
    if (problems.length > 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const outcome = await submitVenueRequest(form, organiserName);
      if (outcome.ok) setSent(true);
      else setError(outcome.message);
    } catch {
      setError('The request did not go through. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <p className="rounded-md border border-border bg-muted/30 p-3 text-xs" role="status" data-testid="venue-request-sent">
        Sent. The Bachata Calendar team will add {form.venueName.trim()} and message you, usually within a day. Save a draft meanwhile, then pick the venue and submit it for review.
      </p>
    );
  }

  // A <div>, not a <form>: the picker sits inside the create form, and forms cannot nest.
  return (
    <div className="rounded-md border border-border p-3 space-y-2" data-testid="venue-request">
      <p className="text-xs font-medium">Ask the team to add a venue</p>
      {/* Visible labels: a placeholder-only field loses its name as soon as it is typed in. */}
      <div className="space-y-1">
        <Label htmlFor={`${ids}-name`} className="text-xs">Venue name</Label>
        <Input id={`${ids}-name`} value={form.venueName} onChange={(e) => set('venueName', e.target.value)} className="h-9 text-[16px] md:text-[16px]" data-testid="venue-request-name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${ids}-link`} className="text-xs">Link to the venue</Label>
        <Input id={`${ids}-link`} value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="Google Maps or the venue&rsquo;s website" inputMode="url" autoComplete="url" className="h-9 text-[16px] md:text-[16px]" data-testid="venue-request-link" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${ids}-phone`} className="text-xs">Your phone number</Label>
        <Input id={`${ids}-phone`} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="The team replies on WhatsApp" type="tel" inputMode="tel" autoComplete="tel" className="h-9 text-[16px] md:text-[16px]" data-testid="venue-request-phone" />
      </div>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="button" size="sm" disabled={problems.length > 0 || sending} onClick={() => void send()} data-testid="venue-request-send">
          {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Send to the team
        </Button>
      </div>
      {problems.length > 0 && <p className="text-[11px] text-muted-foreground text-right">Add {problems.join(', ')}.</p>}
    </div>
  );
}
