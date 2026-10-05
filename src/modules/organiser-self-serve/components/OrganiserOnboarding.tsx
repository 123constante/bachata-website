import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Search } from 'lucide-react';
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

/** Light client-side check; the server (invalid_instagram) stays the authority. */
export function instagramProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?/i.test(v) ? null : 'Enter an Instagram handle or a full https:// link.';
  return /^@?[A-Za-z0-9._]{1,30}$/.test(v) ? null : 'Enter an Instagram handle or a full https:// link.';
}

export function websiteProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.') ? null : 'Enter a full website address starting with https://.';
  } catch {
    return 'Enter a full website address starting with https://.';
  }
}

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

const ACTION_HINT: Record<ClaimHint, string | null> = {
  yours: null,
  managed: 'Request: the team checks your note',
  email_matches: 'Claim: instant, we check your sign-in email',
  email_differs: 'Request: the team checks your note',
  no_email: 'Request: the team checks your note',
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

  const [touched, setTouched] = useState({ instagram: false, website: false });
  const instagramError = touched.instagram ? instagramProblem(form.instagram) : null;
  const websiteError = touched.website ? websiteProblem(form.website) : null;
  const formInvalid = !!instagramProblem(form.instagram) || !!websiteProblem(form.website);

  // The request note is kept when a panel closes or switches; it is cleared
  // only after a successful send.
  const open = (next: Panel) => {
    setPanel(next);
    setFailure(null);
    if (next?.kind === 'create') setForm((f) => (f.name.trim() ? f : { ...f, name: query.trim() }));
  };

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

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
      setNote('');
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
          <li className="text-sm text-muted-foreground">
            No organiser called &ldquo;{term.trim()}&rdquo;.{' '}
            <button
              type="button"
              className="text-primary underline underline-offset-2 min-h-[44px] px-1"
              onClick={() => open({ kind: 'create' })}
              data-testid="create-from-search"
            >
              Create it
            </button>
            .
          </li>
        )}
        {rows.map(({ org, hint }) => {
          const active = panel && panel.kind !== 'create' && panel.org.id === org.id ? panel : null;
          return (
            <li key={org.id} className="rounded-lg border border-border bg-card p-3 space-y-2" data-testid="organiser-result">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{HINT_TEXT[hint]}</p>
                  {!requestedIds.has(org.id) && ACTION_HINT[hint] && (
                    <p className="text-xs text-muted-foreground" data-testid="action-hint">{ACTION_HINT[hint]}</p>
                  )}
                </div>
                {hint === 'yours' ? null : requestedIds.has(org.id) ? (
                  <span className="text-xs text-muted-foreground" data-testid="request-pending">Request sent</span>
                ) : hint === 'email_matches' ? (
                  <Button size="sm" className="rounded-full min-h-[44px]" onClick={() => open({ kind: 'claim', org })} data-testid="claim-open">
                    Claim
                  </Button>
                ) : (
                  // A claim needs the listed email to be yours; anything else
                  // would only be refused, so offer the request straight away.
                  <Button size="sm" variant="outline" className="rounded-full min-h-[44px]" onClick={() => open({ kind: 'request', org })} data-testid="request-open">
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
                          className="rounded-full min-h-[44px]"
                          disabled={busy}
                          onClick={() => void run(() => claimOrganiser(org.id), `${org.name} is yours. You can now manage it.`)}
                          data-testid="claim-confirm"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, claim it'}
                        </Button>
                        <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => open(null)}>
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
                      className="rounded-full min-h-[44px]"
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
                    <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => open(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {active && failure && (
                <p className="text-sm text-destructive" role="alert" data-testid={`onboarding-error-${org.id}`}>
                  {failure.message}
                </p>
              )}
            </li>
          );
        })}

        <li className="rounded-lg border border-dashed border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Create a new organiser</p>
              <p className="text-xs text-muted-foreground">Name, city, Instagram. The team checks new organisers within a day.</p>
            </div>
            {panel?.kind !== 'create' && (
              <Button size="sm" variant="outline" className="rounded-full min-h-[44px]" onClick={() => open({ kind: 'create' })} data-testid="create-open">
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
                <Label id="create-city-label" htmlFor="create-city" className="text-xs">City</Label>
                {/* CityPicker takes no id prop (owned elsewhere), so the group carries the label. */}
                <div id="create-city" role="group" aria-labelledby="create-city-label">
                  <CityPicker value={form.cityId} onChange={(cityId) => setForm((f) => ({ ...f, cityId }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-instagram" className="text-xs">Instagram (optional)</Label>
                <Input id="create-instagram" value={form.instagram} placeholder="@yourhandle" className="h-9 text-sm"
                  aria-invalid={!!instagramError} aria-describedby="create-instagram-help" data-testid="create-instagram"
                  onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, instagram: true }))} />
                <p id="create-instagram-help" className={instagramError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} data-testid="instagram-help">
                  {instagramError ?? 'A handle like @yourhandle, or a full https:// link.'}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-website" className="text-xs">Website (optional)</Label>
                <Input id="create-website" type="url" value={form.website} placeholder="https://" className="h-9 text-sm"
                  aria-invalid={!!websiteError} aria-describedby="create-website-help" data-testid="create-website"
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  onBlur={() => setTouched((t) => ({ ...t, website: true }))} />
                <p id="create-website-help" className={websiteError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} data-testid="website-help">
                  {websiteError ?? 'Starts with https://'}
                </p>
              </div>
              <label className="sm:col-span-2 flex items-center gap-3 text-xs text-muted-foreground min-h-[44px]">
                <input type="checkbox" className="h-6 w-6 shrink-0" checked={form.useMyEmail}
                  onChange={(e) => setForm((f) => ({ ...f, useMyEmail: e.target.checked }))} />
                Show {email || 'my email'} as the contact email
              </label>
              {failure && (
                <p className="sm:col-span-2 text-sm text-destructive" role="alert" data-testid="onboarding-error-create">
                  {failure.message}
                </p>
              )}
              <div className="sm:col-span-2 flex gap-2">
                <Button size="sm" type="submit" className="rounded-full min-h-[44px]" disabled={busy || !form.name.trim() || !form.cityId || formInvalid} data-testid="create-submit">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create organiser'}
                </Button>
                <Button size="sm" type="button" variant="ghost" className="min-h-[44px]" onClick={() => open(null)}>
                  Cancel
                </Button>
              </div>
              {failure?.next === 'reauth' && (
                <div className="sm:col-span-2">
                  <EmailCodeProof email={email} onProven={() => setFailure(null)} />
                </div>
              )}
            </form>
          )}
        </li>
      </ul>
    </section>
  );
}
