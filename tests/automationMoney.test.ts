// Slice 2 (foundations-web), PART 2: the money set and isMoney() (drill A16). The function table
// (paths AND changed lines AND migration statements, whole-identifier rule, anchored key regexes,
// fail closed), then the A16 cases on every auto path that exists in this repo: the autopilot lane
// (run() against a fake GitHub), bot-automerge (classify()), the Dependabot lane (the CLI the
// workflow step runs). Each wiring has a mutant that must turn its test red.
// Doc: docs/automation-foundations.md.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, stringify } from 'yaml';
import { isMoney, parseMoneySet, MONEY_SET_PATH } from '../scripts/lib/is-money.mjs';
import { mergeVerdict } from '../scripts/lib/autopilot-merge.mjs';
import { run } from '../scripts/autopilot-step.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { classify, BOT_LOGIN, LABEL_OK } from '../scripts/automerge-classify.mjs';
import { main as moneyCli } from '../scripts/automation-money-check.mjs';
import { NOT_PAUSED, FOUNDATIONS_OK } from './autopilotTable';
import { fakeGitHub, green, ENV, NOW, type FakeFile } from './automationFakeGitHub';

const ROOT = path.resolve(__dirname, '..');
const SET_TEXT = readFileSync(path.join(ROOT, MONEY_SET_PATH), 'utf8');
const SET = parseMoneySet(SET_TEXT);
const REQ = JSON.parse(readFileSync(path.join(ROOT, '.github/automation/required-jobs.json'), 'utf8'));
const patchOf = (added: string[], removed: string[] = []) => `@@ -1,${removed.length + 1} +1,${added.length + 1} @@\n ctx\n${removed.map((l) => `-${l}`).join('\n')}${removed.length ? '\n' : ''}${added.map((l) => `+${l}`).join('\n')}`;
const file = (filename: string, added: string[], removed: string[] = [], extra: Partial<FakeFile> = {}): FakeFile => ({
  filename, status: 'modified', additions: added.length, deletions: removed.length, changes: added.length + removed.length, patch: patchOf(added, removed), ...extra,
});

// ---------------------------------------------------------------- the set file
describe('money-set.json (PART 2.1)', () => {
  it('seeded from fact 6: flags, env names, the seed paths, the admin table / function names', () => {
    for (const f of ['organiserTicketing', 'publicTicketing', 'VITE_ENABLE_ORGANISER_TICKETING', 'VITE_ENABLE_PUBLIC_TICKETING']) expect(SET.flags).toContain(f);
    for (const e of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PUBLISHABLE_KEY']) expect(SET.env).toContain(e);
    for (const p of ['src/modules/tickets/**', 'src/modules/organiser/p3/tickets/**', 'src/modules/organiser/tickets/**', 'src/components/TicketCard.tsx', 'src/lib/ticketBookingFee.ts',
      'src/modules/event-page/bento/StickyTicketButton.tsx', 'src/modules/event-page/sections/EventTicketsSection.tsx', 'src/modules/organiser/p3/shell/youTickets.tsx', MONEY_SET_PATH]) expect(SET.paths).toContain(p);
    for (const t of ['ticket_orders', 'tickets', 'ticket_types', 'ticket_promo_codes', 'ticket_webhook_events', 'ticket_checkout_attempts', 'organiser_stripe_accounts', 'ticket_status_reads', 'ticket_promo_*']) expect(SET.tables).toContain(t);
    for (const f of ['ticket_*_v1', '_ticket_*_v1', 'my_tickets_v1', 'my_ticket_order_qr_v1', 'stripe-webhook', 'stripe-connect-onboard', 'ticket-checkout', 'ticket-email', 'ticket-refund']) expect(SET.functions).toContain(f);
  });
  // F15 (review-1370-r1): every list is pinned, so dropping ANY entry of the live file is red (MS02, MS09).
  it('the live paths and keys lists are pinned entry by entry', () => {
    expect(SET.paths).toEqual([
      MONEY_SET_PATH, 'src/modules/tickets/**', 'src/modules/organiser/p3/tickets/**', 'src/modules/organiser/tickets/**', 'src/modules/organiser/p3/door/**',
      'src/components/TicketCard.tsx', 'src/lib/ticketBookingFee.ts', 'src/modules/event-page/bento/StickyTicketButton.tsx',
      'src/modules/event-page/sections/EventTicketsSection.tsx', 'src/modules/organiser/p3/shell/youTickets.tsx', 'src/modules/organiser/p3/tickets/GetPaid.tsx',
      'src/**/*ticket*', 'src/**/*ticket*/**', 'app/**/*ticket*', 'supabase/functions/stripe-webhook/**', 'supabase/functions/stripe-connect-onboard/**',
      'supabase/functions/ticket-checkout/**', 'supabase/functions/ticket-email/**', 'supabase/functions/ticket-refund/**',
      '**/*stripe*', '**/*stripe*/**', '**/*payout*', '**/*payout*/**', '**/*refund*', '**/*refund*/**',
    ]);
    expect(SET.keys).toEqual([
      'STRIPE_CHECKOUT_PREFIX', 'STRIPE_MODE', 'BOOKING_FEE_PENCE',
      { regex: '^price_(?=[A-Za-z0-9]*[0-9])[A-Za-z0-9]{14,}$', why: expect.any(String) },
    ]);
  });
  it('never holds a secret VALUE (names only)', () => {
    expect(SET_TEXT).not.toMatch(/sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|pk_(live|test)_[A-Za-z0-9]/);
  });
  it.each([
    ['not JSON', '{'],
    ['wrong version', JSON.stringify({ ...JSON.parse(SET_TEXT), version: 2 })],
    ['a list missing', JSON.stringify({ ...JSON.parse(SET_TEXT), env: undefined })],
    ['an empty name', JSON.stringify({ ...JSON.parse(SET_TEXT), tables: [''] })],
    ['an unanchored key regex', JSON.stringify({ ...JSON.parse(SET_TEXT), keys: [{ regex: 'price_[0-9]+', why: 'x' }] })],
    ['a key regex that will not compile', JSON.stringify({ ...JSON.parse(SET_TEXT), keys: [{ regex: '^(price$', why: 'x' }] })],
    ['an unknown key', JSON.stringify({ ...JSON.parse(SET_TEXT), extra: [] })],
  ])('parseMoneySet fails closed: %s', (_n, text) => expect(() => parseMoneySet(text)).toThrow());
});

// ---------------------------------------------------------------- isMoney
const M = (files: object[], statements?: string[], set: unknown = SET) => isMoney({ files, statements, set });
const DOC = (lines: string[]) => [{ path: 'docs/a.md', added: lines, removed: [] }];
const FN_ROWS: [string, object[], string[] | undefined, boolean, string][] = [
  ['a plain docs line', DOC(['nothing to see here']), undefined, false, ''],
  ['a path under the set', [{ path: 'src/modules/tickets/TicketsBlock.tsx', added: ['x'] }], undefined, true, 'money set: src/modules/tickets/**'],
  ['a path glob is case-insensitive', [{ path: 'Src/Modules/Tickets/X.ts', added: ['x'] }], undefined, true, 'money set: src/modules/tickets/**'],
  ['a docs path with a table name in an ADDED line', DOC(['we read ticket_orders here']), undefined, true, 'money set: ticket_orders'],
  ['a REMOVED line counts too', [{ path: 'docs/a.md', added: [], removed: ['call my_tickets_v1'] }], undefined, true, 'money set: my_tickets_v1'],
  // F1: the LIVE shape (a GitHub pull-file object, patch only) with removed lines only (IM09).
  ['a REMOVED line in a GitHub patch (live shape) names the hit', [file('docs/a.md', [], ['call my_tickets_v1'])], undefined, true, 'money set: my_tickets_v1'],
  // F5: a NESTED file under a `**`-terminated glob of the real set (IM15).
  ['a two-level path under a ** glob', [file('src/modules/organiser/p3/door/scan/Camera.tsx', ['x'])], undefined, true, 'money set: src/modules/organiser/p3/door/**'],
  // F4: directory forms; the file name itself carries no money word.
  ['a stripe DIRECTORY (any case)', [file('src/Stripe/Client.ts', ['x'])], undefined, true, 'money set: **/*stripe*/**'],
  ['a payout DIRECTORY', [file('lib/payouts/run.ts', ['x'])], undefined, true, 'money set: **/*payout*/**'],
  ['a refund DIRECTORY', [file('app/refunds/run.ts', ['x'])], undefined, true, 'money set: **/*refund*/**'],
  ['a ticket DIRECTORY under src', [file('src/modules/ticketing/List.tsx', ['x'])], undefined, true, 'money set: src/**/*ticket*/**'],
  // F6: a FULL unified diff's +++/--- headers are not changed lines (fail closed on the short count).
  ['a full unified diff: the +++/--- headers are not counted', [{ filename: 'docs/a.md', changes: 3, patch: '--- a/docs/a.md\n+++ b/docs/a.md\n@@ -1 +1,2 @@\n ctx\n+plain' }], undefined, true, 'money set: unreadable (truncated patch for docs/a.md: 1 of 3 changed lines)'],
  ['inside a hunk a removed `---` rule IS a changed line', [{ filename: 'docs/a.md', changes: 1, patch: '@@ -1,2 +1 @@\n ctx\n----' }], undefined, false, ''],
  ['a .json path is not exempt', [{ path: 'docs/x.json', added: ['"flag": "VITE_ENABLE_PUBLIC_TICKETING"'] }], undefined, true, 'money set: VITE_ENABLE_PUBLIC_TICKETING'],
  ['whole identifier: ticket_orders_x is NOT a hit', DOC(['ticket_orders_x and xticket_orders']), undefined, false, ''],
  ['whole identifier: punctuation around the name is a hit', DOC(['(ticket_orders).id']), undefined, true, 'money set: ticket_orders'],
  ['names are case-sensitive in LINES: TICKET_ORDERS is not the table', DOC(['TICKET_ORDERS']), undefined, false, ''],
  ['names are case-sensitive in PATHS: docs/TICKET_ORDERS.md is not the table', [file('docs/TICKET_ORDERS.md', ['x'])], undefined, false, ''],
  // F3: Postgres folds unquoted identifiers, so a STATEMENT matches names case-insensitively.
  ['statements: names are case-INsensitive (Postgres folds unquoted identifiers)', DOC(['x']), ['ALTER TABLE Ticket_Orders RENAME COLUMN x TO y'], true, 'money set: Ticket_Orders'],
  ['statements: TICKET_PROMO_X matches the ticket_promo_* entry', DOC(['x']), ['DROP TABLE public.TICKET_PROMO_X'], true, 'money set: TICKET_PROMO_X'],
  ['statements: still a whole identifier (Ticket_Orders_x is not a hit)', DOC(['x']), ['CREATE TABLE Ticket_Orders_x (id uuid)'], false, ''],
  ['a * entry: ticket_*_v1 matches ticket_type_upsert_v1', DOC(['rpc ticket_type_upsert_v1']), undefined, true, 'money set: ticket_type_upsert_v1'],
  ['a * entry needs the whole shape: ticket_type_upsert_v2 is not ticket_*_v1', DOC(['rpc ticket_type_upsert_v2']), undefined, false, ''],
  ['edge function name with a hyphen', DOC(['deploy stripe-webhook today']), undefined, true, 'money set: stripe-webhook'],
  ['env name', DOC(['STRIPE_WEBHOOK_SECRET=']), undefined, true, 'money set: STRIPE_WEBHOOK_SECRET'],
  ['flag name', DOC(['flags.organiserTicketing']), undefined, true, 'money set: organiserTicketing'],
  ['price id regex: a Stripe price id is a hit', DOC(['"price_1NqLzX2eZvKYlo2C8hKk3sTq"']), undefined, true, 'money set: price_1NqLzX2eZvKYlo2C8hKk3sTq'],
  ['price id regex: price_currency is NOT a hit (anchored, needs a digit and length)', DOC(['price_currency, price_display, price_12']), undefined, false, ''],
  ['a patch string is parsed (+ and - lines, not context)', [{ filename: 'docs/a.md', changes: 1, patch: '@@ -1 +1,2 @@\n ticket_orders in context\n+plain' }], undefined, false, ''],
  ['a patch + line hits', [{ filename: 'docs/a.md', changes: 1, patch: '@@ -1 +1,2 @@\n ctx\n+uses ticket_orders' }], undefined, true, 'money set: ticket_orders'],
  ['statements (case 3): a migration renaming a payments column', DOC(['x']), ['ALTER TABLE public.ticket_orders RENAME COLUMN amount TO amount_pence'], true, 'money set: ticket_orders'],
  ['statements (case 4): a migration adding a table named by the set', DOC(['x']), ['CREATE TABLE public.ticket_promo_redemptions (id uuid)'], true, 'money set: ticket_promo_redemptions'],
  ['statements: an unrelated migration', DOC(['x']), ['CREATE TABLE public.dancers_x (id uuid)'], false, ''],
  ['case 8: a revert diff of a money commit is a hit', [{ path: 'src/modules/tickets/TicketsBlock.tsx', added: ['old'], removed: ['new'] }], undefined, true, 'money set: src/modules/tickets/**'],
  // FAIL CLOSED
  ['no patch and changes > 0 (GitHub omits big patches)', [{ filename: 'docs/big.md', changes: 5000 }], undefined, true, 'money set: unreadable (no patch for docs/big.md)'],
  ['a truncated patch (fewer +/- lines than changes)', [{ filename: 'docs/a.md', changes: 9, patch: '@@ -1 +1,2 @@\n+one' }], undefined, true, 'money set: unreadable (truncated patch for docs/a.md: 1 of 9 changed lines)'],
  ['a binary / rename-only file (changes 0, no patch) is read as no lines', [{ filename: 'docs/a.png', changes: 0 }], undefined, false, ''],
  ['an unreadable set', DOC(['x']), undefined, true, 'money set: unreadable (set: not a money set)'],
  ['no files', [], undefined, true, 'money set: unreadable (no changed files read)'],
  ['a file without a path', [{ added: ['x'] }], undefined, true, 'money set: unreadable (a changed file without a path)'],
  ['statements not a list of strings', DOC(['x']), [3 as unknown as string], true, 'money set: unreadable (statements are not strings)'],
];
describe('isMoney (PART 2.2): paths AND lines AND statements; first hit is the reason', () => {
  it.each(FN_ROWS)('%s', (n, files, statements, money, reason) => {
    const v = M(files, statements, n === 'an unreadable set' ? null : SET);
    expect(v.money).toBe(money);
    expect(v.reason).toBe(reason);
    if (money && !/unreadable/.test(reason)) expect(v.names).toContain(reason.replace('money set: ', ''));
    if (money && !/unreadable/.test(reason)) expect(v.names[0]).toBe(reason.replace('money set: ', ''));
  });
  it('a previous_filename of a rename is scanned too', () => {
    expect(M([{ filename: 'docs/moved.md', previous_filename: 'src/modules/tickets/old.ts', changes: 0, status: 'renamed' }]).reason).toBe('money set: src/modules/tickets/**');
  });
  it('every hit is listed in names, first hit first', () => {
    const v = M(DOC(['ticket_orders then organiserTicketing']));
    expect(v.names).toEqual(['ticket_orders', 'organiserTicketing']);
  });
});

describe('mergeVerdict takes facts.money (PART 2.3, lane)', () => {
  it('absent = refuse (fail closed)', () => {
    const f: Record<string, unknown> = { ...FOUNDATIONS_OK.facts };
    delete f.money;
    expect(mergeVerdict(f).reasons).toContain('money set not checked (fail closed)');
  });
  it('a hit refuses with the reason verbatim', () => {
    expect(mergeVerdict({ ...FOUNDATIONS_OK.facts, money: M(DOC(['ticket_orders'])) }).reasons).toContain('money set: ticket_orders');
  });
});

// ---------------------------------------------------------------- A16 on every auto path
// The cases a bot PR labelled automerge-ok + review-passed can carry here (8.3 cases 1, 2, 5, 6, 7).
// Case 6: Website has NO soft-app class (SOFT_APP_ALLOW is empty), so case 6 is the one class the
// lane accepts positively (docs): a path-only "docs" verdict is overridden by a content hit.
const A16: [string, FakeFile, string][] = [
  ['1 a Stripe price constant in a .json (docs-looking path)', file('docs/config/plans.json', ['  "monthly": "price_1NqLzX2eZvKYlo2C8hKk3sTq"']), 'money set: price_1NqLzX2eZvKYlo2C8hKk3sTq'],
  ['2 docs-only PR whose diff mentions a money-set function', file('docs/handover/x.md', ['The page calls my_tickets_v1 on load.']), 'money set: my_tickets_v1'],
  ['5 a Stripe webhook edge function change', file('supabase/functions/stripe-webhook/index.ts', ['  return ok;']), 'money set: supabase/functions/stripe-webhook/**'],
  ['6 content hit inside a file the lane classifies by path (docs)', file('docs/notes.md', ['Turn on VITE_ENABLE_PUBLIC_TICKETING first.']), 'money set: VITE_ENABLE_PUBLIC_TICKETING'],
  ['7 an innocuous PR adding a name to the money-set file', file(MONEY_SET_PATH, ['    "ticket_new_thing",']), `money set: ${MONEY_SET_PATH}`],
];
const RECORD: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RunFn = (env: any, opts: any) => Promise<number>;
async function lane(runFn: RunFn, f: FakeFile) {
  const gh = fakeGitHub({ n: 91, files: [f], checkRuns: (h) => green(h, REQ.pr_head) });
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { lines.push(a.map(String).join(' ')); });
  try { await runFn(ENV, { ...FOUNDATIONS_OK.armingOpts, pauseReader: NOT_PAUSED.pauseReader, now: NOW, fetch: gh.fetchImpl }); } finally { spy.mockRestore(); }
  return { merges: gh.merges().length, out: lines.join('\n') };
}
const basePr = { state: 'open', draft: false, user: BOT_LOGIN, headRef: 'claude/x', headRepo: 'o/r', baseRepo: 'o/r', baseRef: 'main', labels: [LABEL_OK, 'review-passed'], body: 'x' };
const classifyCase = (f: FakeFile, cls = classify) => cls({
  pr: { ...basePr, additions: f.additions, deletions: f.deletions, changedFiles: 1 }, files: [f], labelActor: BOT_LOGIN, importedByShipped: () => false, moneySet: SET,
});
const CLI_HEAD = 'c'.repeat(40);
async function dependabot(f: FakeFile, cli = moneyCli) {
  const outputs: string[] = [];
  const fetchImpl = async (url: string) => {
    const u = new URL(url);
    if (/\/pulls\/\d+$/.test(u.pathname)) return new Response(JSON.stringify({ changed_files: 1, head: { sha: CLI_HEAD } }), { status: 200 });
    if (/\/pulls\/\d+\/files$/.test(u.pathname)) return new Response(JSON.stringify(Number(u.searchParams.get('page')) === 1 ? [f] : []), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  const code = await cli({ GH_TOKEN: 't', REPO: 'o/r', PR_NUMBER: '5', HEAD_SHA: CLI_HEAD }, { fetch: fetchImpl, writeOutput: (l: string) => outputs.push(l), out: () => {}, err: () => {} });
  return { code, outputs };
}

describe('A16: every (case, auto path) pair is refused with `money set: <name>`', () => {
  it.each(A16)('lane (autopilot merge lane): %s', async (n, f, reason) => {
    const r = await lane(run as RunFn, f);
    expect(r.merges).toBe(0);
    expect(r.out).toContain(reason);
    RECORD.push(`${n.split(' ')[0]} | lane | refused | ${reason}`);
  });
  it.each(A16)('bot-automerge (classify): %s', (n, f, reason) => {
    const v = classifyCase(f);
    expect(v.qualifies).toBe(false);
    expect(v.reasons).toContain(reason);
    RECORD.push(`${n.split(' ')[0]} | bot-automerge | refused | ${reason}`);
  });
  it.each(A16)('Dependabot lane (automation-money-check CLI): %s', async (n, f, reason) => {
    const r = await dependabot(f);
    expect(r.code).toBe(0);
    expect(r.outputs).toContain('money=true');
    expect(r.outputs).toContain(`money_reason=${reason}`);
    RECORD.push(`${n.split(' ')[0]} | dependabot | refused | ${reason}`);
  });
  it('controls: a plain docs PR is NOT refused by any path (no new refusal on a legitimate docs PR)', async () => {
    const f = file('docs/a.md', ['a plain line']);
    const r = await lane(run as RunFn, f);
    expect(r.merges).toBe(1);
    expect(classifyCase(f).qualifies).toBe(true);
    expect((await dependabot(f)).outputs).toContain('money=false');
  });
  it('the pass record lists every pair as refused', () => {
    expect(RECORD).toHaveLength(A16.length * 3);
    expect(RECORD.every((r) => r.includes('| refused |'))).toBe(true);
  });
});

describe('Dependabot CLI fails closed', () => {
  it('a files read failure = money=true, exit 0 (no auto-merge, not a red run)', async () => {
    const outputs: string[] = [];
    const code = await moneyCli({ GH_TOKEN: 't', REPO: 'o/r', PR_NUMBER: '5', HEAD_SHA: CLI_HEAD }, { fetch: async () => new Response('{}', { status: 403 }), writeOutput: (l: string) => outputs.push(l), out: () => {}, err: () => {} });
    expect(code).toBe(0);
    expect(outputs).toContain('money=true');
    expect(outputs.join('\n')).toMatch(/money_reason=money set: unreadable \(/);
  });
  it('a file count that disagrees with the PR = unreadable', async () => {
    const outputs: string[] = [];
    const fetchImpl = async (url: string) => new Response(JSON.stringify(/\/files$/.test(new URL(url).pathname) ? [] : { changed_files: 2, head: { sha: CLI_HEAD } }), { status: 200 });
    await moneyCli({ GH_TOKEN: 't', REPO: 'o/r', PR_NUMBER: '5', HEAD_SHA: CLI_HEAD }, { fetch: fetchImpl, writeOutput: (l: string) => outputs.push(l), out: () => {}, err: () => {} });
    expect(outputs).toContain('money=true');
  });
  it('missing config = exit 2 and money=true', async () => {
    const outputs: string[] = [];
    expect(await moneyCli({}, { fetch: async () => new Response('{}'), writeOutput: (l: string) => outputs.push(l), out: () => {}, err: () => {} })).toBe(2);
    expect(outputs).toContain('money=true');
  });
});

// ---------------------------------------------------------------- the Dependabot workflow step
const WF = path.join(ROOT, '.github/workflows/dependabot-automerge.yml');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Step = Record<string, any>;
function dependabotProblems(text: string) {
  const out: string[] = [];
  const steps: Step[] = parse(text).jobs.enable.steps;
  const iDecide = steps.findIndex((s) => s.id === 'decide');
  const iMoney = steps.findIndex((s) => s.id === 'money');
  const iEnable = steps.findIndex((s) => /^Enable auto-merge/.test(String(s.name || '')));
  if (iMoney < 0) return ['no money step'];
  if (!(iDecide < iMoney && iMoney < iEnable)) out.push('money step is not between Decide and Enable');
  const m = steps[iMoney];
  if (!/scripts\/automation-money-check\.mjs/.test(String(m.run))) out.push('money step does not run the CLI');
  if (/\$\{\{/.test(String(m.run))) out.push('money step interpolates into run');
  if (m.env?.GH_TOKEN !== '${{ github.token }}') out.push('money step not on github.token');
  if (m.env?.HEAD_SHA !== '${{ github.event.pull_request.head.sha }}') out.push('money step does not pin the event head sha (F9)');
  if (m['continue-on-error']) out.push('money step hides a crash');
  if (!/steps\.money\.outputs\.money == 'false'/.test(String(steps[iEnable].if))) out.push('Enable does not require money == false');
  const dis = steps.find((s) => /^Disable auto-merge/.test(String(s.name || '')));
  if (!dis || !/steps\.money\.outputs\.money != 'false'/.test(String(dis.if))) out.push('an armed auto-merge is not disarmed on a money hit');
  const co = steps.findIndex((s) => /^actions\/checkout@/.test(String(s.uses || '')));
  if (co < 0 || co > iMoney || steps[co].with?.ref !== 'main' || steps[co].with?.['persist-credentials'] !== false) out.push('no main checkout without credentials before the money step');
  return out;
}
describe('dependabot-automerge.yml: the money step gates Enable (PART 2.3)', () => {
  const raw = readFileSync(WF, 'utf8');
  it('structure', () => expect(dependabotProblems(raw)).toEqual([]));
  it('no new permission: the workflow block is unchanged', () => {
    expect(parse(raw).permissions).toEqual({ contents: 'write', 'pull-requests': 'write', issues: 'read' });
  });
  it('MUTANT: an Enable step that ignores the money output fails the structure test', () => {
    const wf = parse(raw);
    const en = wf.jobs.enable.steps.find((s: Step) => /^Enable auto-merge/.test(String(s.name || '')));
    en.if = String(en.if).replace(/ && steps\.money\.outputs\.money == 'false'/, '');
    expect(dependabotProblems(stringify(wf))).toContain('Enable does not require money == false');
  });
  it('MUTANT: a money step without HEAD_SHA fails the structure test (F9)', () => {
    const wf = parse(raw);
    delete wf.jobs.enable.steps.find((s: Step) => s.id === 'money').env.HEAD_SHA;
    expect(dependabotProblems(stringify(wf))).toContain('money step does not pin the event head sha (F9)');
  });
});

// ---------------------------------------------------------------- mutants of the code wiring
const lf = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
let seq = 0;
async function loadBeside(file: string, src: string) {
  const f = path.join(path.dirname(file), `.money-mutant-${process.pid}-${seq++}.mjs`);
  writeFileSync(f, src);
  try { return await import(/* @vite-ignore */ pathToFileURL(f).href); } finally { rmSync(f, { force: true }); }
}
const STEP = path.join(ROOT, 'scripts/autopilot-step.mjs');
const CLASSIFY = path.join(ROOT, 'scripts/automerge-classify.mjs');
const CLI = path.join(ROOT, 'scripts/automation-money-check.mjs');
const STEP_CALL = 'money: foundations.money(f),';
const CLASSIFY_CALL = '  const mv = moneyCheck({ files: list, set: moneySet });';
const CLI_CALL = 'const v = isMoney({ files, set });';
describe('MUTANTS: removing the isMoney wiring from any auto path turns A16 red', () => {
  const case2 = A16[1];
  it('lane: a step that never computes the money fact merges case 2', async () => {
    const src = lf(STEP);
    expect(src.split(STEP_CALL).length).toBe(2);
    const m = await loadBeside(STEP, src.replace(STEP_CALL, "money: { money: false, names: [], reason: '' },"));
    const r = await lane(m.run, case2[1]);
    expect(r.merges).toBe(1);
  });
  it('bot-automerge: a classify() without the money check qualifies case 2', async () => {
    const src = lf(CLASSIFY);
    expect(src.split(CLASSIFY_CALL).length).toBe(2);
    const m = await loadBeside(CLASSIFY, src.replace(CLASSIFY_CALL, "  const mv = { money: false, names: [], reason: '' };"));
    expect(classifyCase(case2[1], m.classify).qualifies).toBe(true);
  });
  it('Dependabot: a CLI without isMoney says money=false for case 2', async () => {
    const src = lf(CLI);
    expect(src.split(CLI_CALL).length).toBe(2);
    const m = await loadBeside(CLI, src.replace(CLI_CALL, "const v = { money: false, names: [], reason: '' };"));
    expect((await dependabot(case2[1], m.main)).outputs).toContain('money=false');
  });
});
