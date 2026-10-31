// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useState, type ReactNode } from 'react';

/*
 * P3-GATE (plan Appendix A1, scope D8 / slice 4): every P3 event write that the server refuses with
 * `onboarding_incomplete` opens "A few details first" with Continue into that page's onboarding and Not now;
 * a plain error keeps its words; a success shows neither. The gate flag is OFF on prod, so the refusal is
 * simulated here exactly as _require_onboarding_complete_v1 raises it (read on prod 2026-10-30):
 * P0001, message onboarding_incomplete, DETAIL {"missing":[...],"organiser_id":...}, HINT "Finish your details".
 *
 * Status shapes are organiser_onboarding_status_v1() as the prod survey (2026-10-30, counts only) found them:
 * 15 members, 18 owner rows and 45 manager rows, 0 progress rows, 0 complete, between 2 and 10 codes missing
 * per person and page; "complete" and "1 missing" are the shapes the arc will reach, simulated.
 */

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => [{ key: 'weather', label: 'Weather' }],
}));

import { commandErrorMessage, ONBOARDING_REFUSAL, isOnboardingRefusal } from '../../../shared/selfServeErrors';
import type { OwnerCommand } from '../../../shared/seriesCommands';
import type { EventWorkspace } from '../../../events/eventModel';
import { closeGate, gatedCopy, getGate, refusalFacts, subscribeGate } from '../gate';
import { GateHost } from '../GateHost';
import { GATE_COPY, gateView } from '../gateModel';
import { REVIEW_ROWS } from '../pageModel';
import { EditTray, useSaveRun } from '../../screens/EditTray';
import { CancelEventSheet } from '../../screens/CancelEventSheet';
import { useToast } from '../../screens/Toast';
import { useDateSend, useEverySend } from '../../data/sessions';
import { sendPlan, type DatePlan } from '../../data/dates';
import { previewRepeat } from '../../data/repeat';
import { useEventSend } from '../../../flows/event/useEventSend';
import { useGatedCopy } from '../gate';

afterEach(() => {
  cleanup();
  act(() => closeGate());
  rpc.mockReset();
  auth.user = { id: 'u1' };
});

// ---- the shapes ------------------------------------------------------------------------------------

type Role = 'owner' | 'manager' | 'contributor';
type Shape = 'complete' | 'one' | 'many' | 'admin' | 'failed';
const ROLES: Role[] = ['owner', 'manager', 'contributor'];
const SHAPES: Shape[] = ['complete', 'one', 'many', 'admin', 'failed'];

const PERSON: Record<Exclude<Shape, 'failed'>, string[]> = {
  complete: [],
  one: ['nationality'],
  many: ['nationality', 'languages', 'teach_answer'],
  admin: ['nationality', 'languages'],
};
const PAGE: Record<Exclude<Shape, 'failed'>, string[]> = { complete: [], one: [], many: ['org_logo', 'contact_confirm'], admin: ['org_logo'] };

/** A contributor is on the series through another page, not a member of o1: o1 is not in their status. */
function statusOf(shape: Exclude<Shape, 'failed'>, role: Role): unknown {
  const person = PERSON[shape];
  const page = PAGE[shape];
  const orgs = role === 'contributor' ? [] : [{ id: 'o1', name: 'Salsa Nights', role, lifecycle: 'live', complete: person.length + page.length === 0, missing: page, about: { done: false, skipped: false } }];
  return { v: 1, gate_on: true, is_admin: shape === 'admin', person: { complete: person.length === 0, missing: person }, organisers: orgs, complete: orgs.length ? person.length + page.length === 0 : person.length === 0 };
}
const fetcherOf = (shape: Shape, role: Role) => (shape === 'failed' ? () => Promise.reject(new Error('Failed to fetch')) : () => Promise.resolve(statusOf(shape, role)));

const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['nationality'], organiser_id: 'o1' }), hint: 'Finish your details' };
const PLAIN = { code: 'P0001', message: 'version_conflict: expected 7, found 8' };
type Outcome = 'refusal' | 'plain' | 'success';
const OUTCOMES: Outcome[] = ['refusal', 'plain', 'success'];
const errorOf = (o: Outcome) => (o === 'refusal' ? REFUSAL : o === 'plain' ? PLAIN : null);

/** What the sheet must show, per shape and role (the ONE count: person codes plus o1's, each once). */
// A refused write never reads "finished": with nothing left in the status read, the refusal's own codes show.
// A contributor (o1 not theirs) gets their own codes plus the refusal's; Continue goes to their own details, or is
// off with a reason when nothing of their own is missing (never a page they cannot edit).
const REFUSED = ['nationality'];
function expected(shape: Shape, role: Role): { kind: 'none' | 'left' | 'failed'; n?: number; to?: string | null } {
  const review = '/account/p3/start?o=o1&at=review';
  if (shape === 'admin') return { kind: 'none' };
  if (shape === 'failed') return { kind: 'failed', to: review };
  if (role === 'contributor') {
    const n = new Set([...PERSON[shape], ...REFUSED]).size;
    return { kind: 'left', n, to: PERSON[shape].length ? '/account/p3/you/details' : null };
  }
  const n = PERSON[shape].length + PAGE[shape].length;
  return { kind: 'left', n: n || REFUSED.length, to: review };
}

// ---- the write surfaces, each through its real catch ------------------------------------------------

const CMD = { kind: 'series.set_details', payload: { name: 'x' } } as unknown as OwnerCommand;

function wrap(node: ReactNode, shape: Shape, role: Role) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1/details']}>
        <div className="p3-theme" data-testid="surface">{node}</div>
        <GateHost fetcher={fetcherOf(shape, role)} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function rpcAnswers(outcome: Outcome) {
  rpc.mockImplementation(async () => (outcome === 'success' ? { data: { ok: true, new_version: 8 }, error: null } : { data: null, error: errorOf(outcome) }));
}

function TrayHarness() {
  const s = useSaveRun('ser-1');
  return <EditTray lines={['Name']} elsewhere={false} problem={null} busy={s.busy} error={s.error} onSave={() => void s.run([CMD], 7)} onUndo={() => {}} onRestart={() => {}} />;
}

function ToastHarness() {
  const t = useToast('ser-1', 7);
  const [shown, setShown] = useState(false);
  return (
    <>
      {!shown && <button type="button" data-testid="arm" onClick={() => { setShown(true); t.show({ text: 'Hidden.', undo: CMD, version: 7 }); }}>arm</button>}
      {t.node}
    </>
  );
}

/** SeriesOrganisers' real send path (F-10): useEventSend with the gate hook, as the screen wires it for P3. */
function OrganisersHarness() {
  const gated = useGatedCopy();
  const { sendThenDone, error, conflict } = useEventSend('ser-1', gated);
  return (
    <>
      <button type="button" data-testid="org-save" onClick={() => void sendThenDone(7, CMD, { title: 'Saved', message: 'Saved' })}>Save</button>
      {(error || conflict) && <p data-testid="org-send-error">{error ?? commandErrorMessage(PLAIN)}</p>}
    </>
  );
}

type Surface = { name: string; mount: () => ReactNode; act: () => Promise<void>; errorTestId: string | null };
const SURFACES: Surface[] = [
  {
    name: 'EditTray save (Details, Prices)',
    mount: () => <TrayHarness />,
    act: async () => { await act(async () => { fireEvent.click(screen.getByTestId('p3-save')); }); },
    errorTestId: 'p3-save-error',
  },
  {
    name: 'SeriesOrganisers save (useEventSend)',
    mount: () => <OrganisersHarness />,
    act: async () => { await act(async () => { fireEvent.click(screen.getByTestId('org-save')); }); },
    errorTestId: 'org-send-error',
  },
  {
    name: 'CancelEventSheet',
    mount: () => (
      <CancelEventSheet name="Halloween Party" plan={{ dateId: 'o-1', day: 'Saturday 31 October' }}
        send={async (c, k) => { const { runSeriesCommand } = await import('../../../shared/selfServeApi'); return runSeriesCommand({ target_id: 'ser-1', expected_version: 7, idempotency_key: k, command: c } as never); }}
        onDone={() => {}} onClose={() => {}} />
    ),
    act: async () => {
      await waitFor(() => screen.getByRole('button', { name: 'Weather' }));
      fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
      await act(async () => { fireEvent.click(screen.getByTestId('p3-cancel-confirm')); });
    },
    errorTestId: 'p3-sheet-error',
  },
  {
    name: 'Toast Undo',
    mount: () => <ToastHarness />,
    act: async () => {
      fireEvent.click(screen.getByTestId('arm'));
      await act(async () => { fireEvent.click(screen.getByTestId('p3-undo')); });
    },
    errorTestId: 'p3-toast',
  },
];

describe('every write surface x {refusal, plain error, success} x status x role', () => {
  for (const s of SURFACES) {
    for (const outcome of OUTCOMES) {
      for (const shape of SHAPES) {
        for (const role of ROLES) {
          it(`${s.name} | ${outcome} | ${shape} | ${role}`, async () => {
            rpcAnswers(outcome);
            wrap(s.mount(), shape, role);
            await s.act();
            await waitFor(() => expect(rpc).toHaveBeenCalled());
            // never the refusal words with no control that goes there
            const surface = screen.getByTestId('surface');
            expect(surface.textContent).not.toContain(ONBOARDING_REFUSAL);
            if (outcome === 'plain') {
              await waitFor(() => expect(surface.textContent).toContain(commandErrorMessage(PLAIN)));
              expect(getGate()).toBeNull();
              expect(screen.queryByTestId('p3-gate')).toBeNull();
              return;
            }
            if (outcome === 'success') {
              expect(getGate()).toBeNull();
              expect(screen.queryByTestId('p3-gate')).toBeNull();
              if (s.errorTestId === 'p3-toast') expect(screen.getByTestId('p3-toast').textContent).toContain('Undone.');
              else if (s.errorTestId) expect(screen.queryByTestId(s.errorTestId)).toBeNull();
              return;
            }
            // refusal: the gate opened on the page the server named, and no error line is left behind
            if (shape !== 'admin') expect(getGate()?.organiserId).toBe('o1');
            if (s.errorTestId === 'p3-toast') expect(screen.queryByTestId('p3-toast')).toBeNull();
            else if (s.errorTestId) expect(screen.queryByTestId(s.errorTestId)).toBeNull();
            const want = expected(shape, role);
            if (want.kind === 'none') {
              // an admin is never routed here: the sheet closes itself before drawing
              await waitFor(() => expect(getGate()).toBeNull());
              expect(screen.queryByTestId('p3-gate')).toBeNull();
              return;
            }
            await screen.findByTestId('p3-gate');
            expect(screen.getByText(GATE_COPY.title)).toBeTruthy();
            expect(screen.getByTestId('p3-gate-body').textContent).toBe(GATE_COPY.body);
            if (want.kind === 'failed') {
              await screen.findByTestId('p3-gate-read-failed');
              expect(screen.getByTestId('p3-gate-retry')).toBeTruthy();
            } else {
              await waitFor(() => expect(screen.getByTestId('p3-gate-count').textContent).toBe(want.n === 1 ? '1 thing left' : `${want.n} things left`));
              expect(screen.getByTestId('p3-gate-rows').querySelectorAll('li')).toHaveLength(want.n as number);
            }
            const go = screen.getByTestId('p3-gate-go');
            if (want.to) {
              expect(go.getAttribute('href')).toBe(want.to);
            } else {
              // no page here the person can finish: Continue is off and says why
              expect((go as HTMLButtonElement).disabled).toBe(true);
              expect(screen.getByTestId('p3-gate-why').textContent).toBe(GATE_COPY.notYours);
            }
            // Not now: back to where they were, the screen still there, nothing pointing nowhere
            fireEvent.click(screen.getByTestId('p3-gate-not-now'));
            await waitFor(() => expect(screen.queryByTestId('p3-gate')).toBeNull());
            expect(getGate()).toBeNull();
            expect(screen.getByTestId('surface').textContent).not.toContain(ONBOARDING_REFUSAL);
          });
        }
      }
    }
  }
});

// ---- p3/data writes: a refusal reaches the screen as itself (never re-worded before the gate sees it) --

const WS = { series: { id: 'ser-1', version: 7 } } as unknown as EventWorkspace;

describe('p3/data writes keep the refusal so the screen can route it', () => {
  const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hook = <T,>(fn: () => T) => renderHook(fn, { wrapper: ({ children }) => <QueryClientProvider client={qc()}>{children}</QueryClientProvider> }).result.current;
  const caught = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return e; } };
  const WRITES: Array<{ name: string; send: () => Promise<unknown> }> = [
    { name: 'sessions useEverySend (series.set_program)', send: () => hook(() => useEverySend(WS))(CMD) },
    { name: 'sessions useDateSend (one date\u2019s programme)', send: () => hook(() => useDateSend(WS, 'occ-1'))(3, []) },
    { name: 'dates sendPlan, series command', send: () => sendPlan({ to: 'series', command: CMD } as unknown as DatePlan, ['k'], 7, { date: async () => { throw REFUSAL; }, series: async () => { throw REFUSAL; } }) },
    { name: 'dates sendPlan, first date command', send: () => sendPlan({ to: 'date', occurrenceId: 'occ-1', version: 3, commands: [CMD, CMD] } as unknown as DatePlan, ['k1', 'k2'], 7, { date: async () => { throw REFUSAL; }, series: async () => { throw REFUSAL; } }) },
    { name: 'repeat previewRepeat (dry run)', send: () => previewRepeat('ser-1', 7, CMD) },
  ];
  for (const w of WRITES) {
    it(`${w.name}: refusal -> gate; plain -> its words`, async () => {
      // a gate host is listening (as in the P3 frame); with none, openGate does nothing
      const off = subscribeGate(() => {});
      rpc.mockImplementation(async () => ({ data: null, error: REFUSAL }));
      const e = await caught(w.send());
      expect(isOnboardingRefusal(e)).toBe(true);
      expect(gatedCopy(e, commandErrorMessage)).toBeNull();
      expect(getGate()).toEqual({ organiserId: 'o1', missing: ['nationality'], at: null, seq: expect.any(Number) });
      act(() => closeGate());
      rpc.mockImplementation(async () => ({ data: null, error: PLAIN }));
      const p = await caught(w.name.startsWith('dates') ? sendPlan({ to: 'series', command: CMD } as unknown as DatePlan, ['k'], 7, { date: async () => { throw PLAIN; }, series: async () => { throw PLAIN; } }) : w.send());
      expect(isOnboardingRefusal(p)).toBe(false);
      expect(getGate()).toBeNull();
      off();
    });
  }
});

// ---- every P3 screen that shows a write's failure routes it through gatedCopy ----------------------------

describe('no P3 write catch shows a refusal as a bare error line', () => {
  const dir = resolve(__dirname, '../../screens');
  const COPY = /commandErrorMessage|saveErrorCopy|repeatFailure|previewFailure|programmeErrorCopy|\.message\b/;
  const UPLOAD = /upload(Flyer|EventPicture)\(/; // storage uploads: not writes the onboarding gate holds
  /** The block that starts at the `{` at `open` (brace matching; good enough for this code, which has no braces in strings here). */
  const block = (src: string, open: number) => {
    let depth = 0;
    for (let i = open; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
    }
    return src.slice(open);
  };
  /** Every write-failure handler in `src` that turns an error into words without going through the gate. */
  const bare = (src: string): string[] => {
    const out: string[] = [];
    for (const m of src.matchAll(/try \{/g)) {
      const tryBody = block(src, m.index! + 4);
      const after = src.slice(m.index! + 4 + tryBody.length);
      const c = after.match(/^\s*catch \(\w+\) \{/);
      if (!c) continue;
      const catchBody = block(after, c[0].length - 1);
      if (COPY.test(catchBody) && !/gated(Preview)?\(/.test(catchBody) && !UPLOAD.test(tryBody)) out.push(catchBody.slice(0, 80));
    }
    // promise rejections: (e) => { ... previewFailure(e) ... } outside a gate
    for (const m of src.matchAll(/\(e\) => \{[^\n]*\b(previewFailure|commandErrorMessage|repeatFailure)\(e\)[^\n]*/g)) {
      if (!/gated(Preview)?\(e, /.test(m[0])) out.push(m[0].slice(0, 80));
    }
    return out;
  };
  it('the checker catches a bare catch, and passes a gated one (self-test)', () => {
    expect(bare('try { await send(); } catch (e) { setError(commandErrorMessage(e)); }')).toHaveLength(1);
    expect(bare('try { await send(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }')).toHaveLength(1);
    expect(bare('preview().then((r) => ok(r), (e) => { setPv({ text: previewFailure(e) }); });')).toHaveLength(1);
    expect(bare('try { await send(); } catch (e) { setError(gated(e, commandErrorMessage)); }')).toEqual([]);
    expect(bare('try { await uploadFlyer(f); } catch (e) { setError(commandErrorMessage(e)); }')).toEqual([]);
  });
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
    it(`${file}: every write catch goes through the gate`, () => {
      expect(bare(readFileSync(resolve(dir, file), 'utf8'))).toEqual([]);
    });
  }
  it('SeriesOrganisers routes its refusals through the gate hook on P3 (F-10)', () => {
    const src = readFileSync(resolve(__dirname, '../../../events/SeriesOrganisers.tsx'), 'utf8');
    expect(src).toMatch(/useGatedCopy\(/);
    expect(src).toMatch(/useEventSend\(seriesId, kind === 'p3' \? gated : undefined\)/);
  });
  it('the seven write screens use the gate hook', () => {
    for (const f of ['EditTray.tsx', 'CancelEventSheet.tsx', 'Toast.tsx', 'StatusSheet.tsx', 'DateSheet.tsx', 'SessionSheet.tsx', 'RepeatSheet.tsx']) {
      expect(readFileSync(resolve(dir, f), 'utf8'), f).toMatch(/useGatedCopy\(/);
    }
  });
  it('Cover "Go live" with profile questions left (#1202): goes to P3 Review BEFORE any write, so no refusal reaches the gate', () => {
    // One owner per refusal: NewFlow asks first and never sends the live write while questions are open; the gate
    // only answers writes the server refused. NewFlow does not use the gate, so the two cannot both fire.
    const src = readFileSync(resolve(__dirname, '../../../flows/new/NewFlow.tsx'), 'utf8');
    const left = src.indexOf('await profileQuestionsLeft(seriesId)');
    const review = src.indexOf("kind === 'p3' ? p3StartReview(", left);
    const write = src.indexOf('await send(liveCommands())', left);
    expect(left).toBeGreaterThan(-1);
    expect(review).toBeGreaterThan(left);
    expect(write).toBeGreaterThan(review);
    expect(src).not.toMatch(/useGatedCopy|gatedCopy|openGate/);
  });
});

// ---- the screen's facts (pure) ----------------------------------------------------------------------

describe('gateView: Continue target, count and rows per shape', () => {
  for (const shape of SHAPES) {
    for (const role of ROLES) {
      it(`${shape} | ${role}`, () => {
        const v = gateView(shape === 'failed' ? undefined : statusOf(shape, role), 'o1', REFUSED);
        const want = expected(shape, role);
        if (want.kind === 'none') return expect(v).toEqual({ kind: 'admin' });
        if (want.kind === 'failed') return expect(v).toEqual({ kind: 'unknown', to: want.to });
        if (v.kind !== 'left') throw new Error(`expected left, got ${v.kind}`);
        expect(v.to).toBe(want.to);
        expect(v.rows).toHaveLength(want.n as number);
        expect(v.count).toBe(want.n === 1 ? '1 thing left' : `${want.n} things left`);
        // the row words are Review's (one mapping), never re-worded here
        for (const r of v.rows) expect(Object.values(REVIEW_ROWS).map((x) => x.label)).toContain(r);
      });
    }
  }

  it('a person on two pages, one complete: Continue goes to the unfinished page the server named', () => {
    const raw = {
      v: 1, is_admin: false, complete: false, person: { complete: false, missing: ['nationality'] },
      organisers: [
        { id: 'oA', name: 'A', role: 'owner', complete: false, missing: [] },
        { id: 'oB', name: 'B', role: 'manager', complete: false, missing: ['org_logo', 'org_link'] },
      ],
    };
    expect(gateView(raw, 'oB')).toEqual({ kind: 'left', count: '3 things left', rows: ['Nationality', 'Page logo', 'Page link'], to: '/account/p3/start?o=oB&at=review', why: null });
    // no page named: graceModel's own pick, the first page still missing something
    expect(gateView(raw, null)).toMatchObject({ kind: 'left', to: '/account/p3/start?o=oB&at=review' });
  });

  it('the refusal names its page and codes from DETAIL; anything unreadable is null / []', () => {
    const none = { organiserId: null, missing: [] };
    expect(refusalFacts(REFUSAL)).toEqual({ organiserId: 'o1', missing: ['nationality'] });
    expect(refusalFacts({ message: 'onboarding_incomplete' })).toEqual(none);
    expect(refusalFacts({ message: 'onboarding_incomplete', details: 'not json' })).toEqual(none);
    expect(refusalFacts({ message: 'onboarding_incomplete', details: '{"organiser_id":42,"missing":"x"}' })).toEqual(none);
    expect(refusalFacts({ message: 'onboarding_incomplete', details: '{"missing":["a","a",3,""]}' })).toEqual({ organiserId: null, missing: ['a'] });
    const off = subscribeGate(() => {});
    expect(gatedCopy({ message: 'permission_denied: onboarding_incomplete' }, () => 'x')).toBeNull();
    expect(getGate()).toEqual({ ...none, at: null, seq: expect.any(Number) });
    off();
  });

  it('no copy points at a control that is not on the sheet', () => {
    // title, body and the not-yours reason name no control; read failed names Try again, its button
    for (const words of [GATE_COPY.title, GATE_COPY.body, GATE_COPY.notYours]) expect(words).not.toMatch(/tap|button|press|below|above|save again|try again|close/i);
    expect(GATE_COPY).not.toHaveProperty('done');
    expect(GATE_COPY.readFailed).toMatch(/Try again/);
    expect(GATE_COPY.retry).toBe('Try again');
  });

  it('leaving the refused screen closes the sheet, so it never reappears over another screen', async () => {
    rpcAnswers('refusal');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { Link: RLink } = await import('react-router-dom');
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account/p3/events/ser-1/details']}>
          <div className="p3-theme"><TrayHarness /><RLink to="/account/p3/events" data-testid="away">away</RLink></div>
          <GateHost fetcher={fetcherOf('many', 'owner')} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await act(async () => { fireEvent.click(screen.getByTestId('p3-save')); });
    await screen.findByTestId('p3-gate-rows');
    fireEvent.click(screen.getByTestId('away'));
    await waitFor(() => expect(screen.queryByTestId('p3-gate')).toBeNull());
    expect(getGate()).toBeNull();
  });

  it('signed out (no user): the status is never read, the sheet says it could not load and still offers Continue', async () => {
    auth.user = null;
    rpcAnswers('refusal');
    wrap(<TrayHarness />, 'one', 'owner');
    await act(async () => { fireEvent.click(screen.getByTestId('p3-save')); });
    await screen.findByTestId('p3-gate-read-failed');
    expect(screen.getByTestId('p3-gate-go').getAttribute('href')).toBe('/account/p3/start?o=o1&at=review');
  });
});
