import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CityPicker } from '@/components/ui/city-picker';
import { EmailCodeProof } from './EmailCodeProof';
import {
  claimHint,
  claimOrganiser,
  createOrganiserProfile,
  requestOrganiserAccess,
  searchClaimableOrganisers,
  type ClaimCandidate,
  type ClaimHint,
} from '../selfServeApi';
import { selfServeErrorCopy, type SelfServeErrorCopy } from '../selfServeErrors';

interface Props {
  user: { id: string; email?: string | null };
  mailboxProven: boolean;
  myOrganiserIds: ReadonlySet<string>;
  /** Organisers the user already has an open access request on. */
  requestedIds: ReadonlySet<string>;
  /** First organiser: show the sign-up steps (mockup 06-B). */
  firstRun: boolean;
  /**
   * Called after any successful claim, request or create with the line to
   * confirm it. The PAGE shows it: a first organiser unmounts this component.
   * A create also names the new organiser, so the page opens its home, where
   * "Send for review" waits (mockup 05-A: a draft is sent as its own step).
   */
  onChanged: (confirmation: string, organiserId?: string) => void;
}

type Panel =
  | { kind: 'claim'; org: ClaimCandidate }
  | { kind: 'request'; org: ClaimCandidate }
  | { kind: 'create' }
  | null;

const HINT_TEXT: Record<ClaimHint, string> = {
  yours: 'You already manage this',
  managed: 'Managed by someone else',
  email_matches: 'Contact email matches yours',
  email_differs: 'Listed with a different email',
  no_email: 'No contact email listed',
};

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function OrganiserOnboarding({ user, mailboxProven, myOrganiserIds, requestedIds, firstRun, onChanged }: Props) {
  const [query, setQuery] = useState('');
  const term = useDebounced(query, 250);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelfServeErrorCopy | null>(null);
  const [note, setNote] = useState('');
  const [form, setForm] = useState({ name: '', cityId: '', useMyEmail: true, instagram: '', website: '' });

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['claimable-organisers', term],
    queryFn: () => searchClaimableOrganisers(term),
    enabled: term.trim().length >= 2,
    staleTime: 60_000,
  });

  const rows = useMemo(
    () => results.map((org) => ({ org, hint: claimHint(org, user, myOrganiserIds) })),
    [results, user, myOrganiserIds],
  );

  const open = (next: Panel) => {
    setPanel(next);
    setFailure(null);
    setNote('');
  };

  /**
   * Runs one claim, request or create. `focus` reads, off the action's result,
   * the organiser the page should open next (a create names the new one).
   */
  const run = async <T,>(action: () => Promise<T>, success: string, focus?: (result: T) => string | null) => {
    setBusy(true);
    setFailure(null);
    try {
      const result = await action();
      setPanel(null);
      onChanged(success, focus?.(result) ?? undefined);
    } catch (error) {
      const copy = selfServeErrorCopy(error);
      setFailure(copy);
      // A refusal that means "you can't claim this" turns the claim panel
      // into the request panel for the same organiser.
      if (copy.next === 'request_access' && panel && panel.kind === 'claim') {
        setPanel({ kind: 'request', org: panel.org });
      }
    } finally {
      setBusy(false);
    }
  };

  const email = user.email ?? '';

  return (
    <section className="space-y-3" data-testid="organiser-onboarding">
      {firstRun && (
      <ol className="flex items-center gap-2 text-xs text-muted-foreground" aria-label="Steps">
        <li className="text-primary">&#10003; Signed in</li>
        <li aria-hidden="true">&rsaquo;</li>
        <li className="font-semibold text-foreground">2 Your organiser</li>
        <li aria-hidden="true">&rsaquo;</li>
        <li>3 Your events</li>
      </ol>
      )}
      <div>
        <h2 className="text-base font-semibold">{firstRun ? 'Which organiser are you?' : 'Add another organiser'}</h2>
        <p className="text-sm text-muted-foreground">
          We&rsquo;ve probably already listed you. Find your name, or create a new organiser.
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search organisers by name"
          className="pl-9 h-9 text-sm"
          aria-label="Search organisers by name"
          data-testid="organiser-search"
        />
      </div>

      <ul className="space-y-2" data-testid="organiser-results">
        {isFetching && term.trim().length >= 2 && results.length === 0 && (
          <li className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Searching&hellip;
          </li>
        )}
        {!isFetching && term.trim().length >= 2 && results.length === 0 && (
          <li className="text-sm text-muted-foreground">No organiser called &ldquo;{term.trim()}&rdquo;. Create it below.</li>
        )}
        {rows.map(({ org, hint }) => {
          const active = panel && panel.kind !== 'create' && panel.org.id === org.id ? panel : null;
          return (
            <li key={org.id} className="rounded-md border border-border p-3 space-y-2" data-testid="organiser-result">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{HINT_TEXT[hint]}</p>
                </div>
                {hint === 'yours' ? null : requestedIds.has(org.id) ? (
                  <span className="text-xs text-muted-foreground" data-testid="request-pending">Request sent</span>
                ) : hint === 'email_matches' ? (
                  <Button size="sm" onClick={() => open({ kind: 'claim', org })} data-testid="claim-open">
                    Claim
                  </Button>
                ) : (
                  // A claim needs the listed email to be yours; anything else
                  // would only be refused, so offer the request straight away.
                  <Button size="sm" variant="outline" onClick={() => open({ kind: 'request', org })} data-testid="request-open">
                    Request access
                  </Button>
                )}
              </div>

              {active?.kind === 'claim' && (
                <div className="space-y-2">
                  {mailboxProven ? (
                    <>
                      <p className="text-sm">
                        You&rsquo;re signed in as <strong>{email}</strong>. If that is the contact email on this
                        listing, you can claim it now.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void run(() => claimOrganiser(org.id), `${org.name} is yours. You can now manage it.`)}
                          data-testid="claim-confirm"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, claim it'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => open(null)}>
                          Not me
                        </Button>
                      </div>
                    </>
                  ) : (
                    <EmailCodeProof email={email} onProven={() => void run(() => claimOrganiser(org.id), `${org.name} is yours. You can now manage it.`)} />
                  )}
                </div>
              )}

              {active?.kind === 'request' && (
                <div className="space-y-2">
                  <Label htmlFor={`note-${org.id}`} className="text-xs">
                    Tell the team who you are (optional)
                  </Label>
                  <Textarea
                    id={`note-${org.id}`}
                    value={note}
                    maxLength={500}
                    onChange={(e) => setNote(e.target.value)}
                    className="text-sm min-h-[64px]"
                    placeholder="e.g. I run the Tuesday classes with Ana"
                    data-testid="request-note"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => requestOrganiserAccess(org.id, note),
                          `Request sent. We'll check and add you to ${org.name}.`,
                        )
                      }
                      data-testid="request-send"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send request'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => open(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {active && failure && (
                <p className="text-xs text-destructive" role="alert" data-testid="onboarding-error">
                  {failure.message}
                </p>
              )}
            </li>
          );
        })}

        <li className="rounded-md border border-dashed border-border p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Create a new organiser</p>
              <p className="text-xs text-muted-foreground">Name, city, Instagram. The team checks new organisers within a day.</p>
            </div>
            {panel?.kind !== 'create' && (
              <Button size="sm" variant="outline" onClick={() => open({ kind: 'create' })} data-testid="create-open">
                <Plus className="w-4 h-4" /> Create
              </Button>
            )}
          </div>
          {panel?.kind === 'create' && (
            <form
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    createOrganiserProfile({
                      name: form.name,
                      cityId: form.cityId,
                      contactEmail: form.useMyEmail ? email : '',
                      instagram: form.instagram,
                      website: form.website,
                    }),
                  `${form.name.trim()} is saved as a draft. Send it for review below; the team checks new organisers within a day.`,
                  (created) => created.organiserId,
                );
              }}
              data-testid="create-form"
            >
              <div className="space-y-1">
                <Label htmlFor="create-name" className="text-xs">Organiser name</Label>
                <Input id="create-name" value={form.name} maxLength={80} required className="h-9 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="create-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <CityPicker value={form.cityId} onChange={(cityId) => setForm((f) => ({ ...f, cityId }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-instagram" className="text-xs">Instagram (optional)</Label>
                <Input id="create-instagram" value={form.instagram} placeholder="@yourhandle" className="h-9 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-website" className="text-xs">Website (optional)</Label>
                <Input id="create-website" value={form.website} placeholder="https://" className="h-9 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
              <label className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.useMyEmail}
                  onChange={(e) => setForm((f) => ({ ...f, useMyEmail: e.target.checked }))} />
                Show {email || 'my email'} as the contact email
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <Button size="sm" type="submit" disabled={busy || !form.name.trim() || !form.cityId} data-testid="create-submit">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create organiser'}
                </Button>
                <Button size="sm" type="button" variant="ghost" onClick={() => open(null)}>
                  Cancel
                </Button>
              </div>
              {failure && (
                <p className="sm:col-span-2 text-xs text-destructive" role="alert" data-testid="onboarding-error">
                  {failure.message}
                </p>
              )}
              {failure?.next === 'reauth' && (
                <div className="sm:col-span-2">
                  <EmailCodeProof email={email} onProven={() => setFailure(null)} />
                </div>
              )}
            </form>
          )}
        </li>
      </ul>

      <p className="text-xs text-muted-foreground flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
        Claiming checks the email you signed in with against the contact email on the listing. If it doesn&rsquo;t
        match, &ldquo;Request access&rdquo; sends your note to the Bachata Calendar team.
      </p>
    </section>
  );
}
