import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- .mjs guard script, no type declarations (same as the
// other script-under-test specs in this directory).
import { isEntryPoint } from '../scripts/lib/entry-point.mjs';
// @ts-expect-error -- as above.
import { selfTest } from '../scripts/prove-entry-point-dispatch.mjs';

/**
 * isEntryPoint decides whether the CLI scripts in this repo run at all --
 * including ship-gate.mjs, pre-ship.mjs, the review-stamp writer and both
 * session hooks. (No count here: scripts/prove-entry-point-dispatch.mjs's
 * TARGETS is the instrument, and a number copied into prose drifts off it.)
 * Before this spec its only proof was `prove-entry-point-dispatch.mjs
 * --self-test`, which nothing was obliged to run, so an edit to the predicate
 * could have disarmed every one of them with nothing going red.
 *
 * The full sweep (junction arms, spawned processes) stays out of the unit gate
 * -- it needs link-creation rights and takes seconds. The canary does not: it
 * is in-process, offline, and its one link-dependent case skips rather than
 * fails where links are unavailable. Same shape as tests/reworkShare.test.ts,
 * which drives that script's selfTest in-process for the same reason.
 */
describe('entry-point predicate', () => {
  it('passes its own self-test in-process', async () => {
    const code = await selfTest();
    expect(code).toBe(0);
  });

  // Not a duplicate of the canary: this pins the two directions the REST of the
  // repo depends on, so a future refactor of the canary cannot quietly drop
  // them. Importing this spec is itself the negative case -- if isEntryPoint
  // were true on import, the CLI tails of both imported modules would have
  // fired and taken the test runner's exit code with them.
  // fileURLToPath, NOT a hand-stripped pathname. The first version wrote
  // `url.pathname.replace(/^\//, '')`, which is right on Windows
  // (/C:/dev/... -> C:/dev/...) and WRONG everywhere else: on Linux
  // /home/runner/... becomes home/runner/..., a RELATIVE path that resolves
  // against cwd and does not exist, so the predicate correctly returned false
  // and the test failed. Caught by CI's Linux runner, not by any local run --
  // the same Windows-only-assumption class the sibling PR hit in its own
  // canary cases.
  it('is true for its own module path and false for another file', () => {
    const self = fileURLToPath(new URL('../scripts/lib/entry-point.mjs', import.meta.url));
    const other = fileURLToPath(new URL('../scripts/ship-gate.mjs', import.meta.url));
    const selfUrl = new URL('../scripts/lib/entry-point.mjs', import.meta.url).href;
    expect(isEntryPoint(selfUrl, { argv: ['node', self] })).toBe(true);
    expect(isEntryPoint(selfUrl, { argv: ['node', other] })).toBe(false);
  });
});

/**
 * The prover is only worth having if something RUNS it.
 *
 * This is the same failure the prover itself exists for, one level up. #235's
 * missing TARGETS row went unnoticed for days because `prove:entry-point`
 * appeared in no workflow, no lint chain and no pre-ship -- the detector
 * existed and was offline. Wiring it into architecture-guard.yml and asserting
 * nothing about that would rebuild the identical hole one merge later.
 *
 * PARSED, NOT SCRAPED, and that distinction was measured rather than reasoned.
 * The first version of this spec matched raw yaml TEXT, so putting a `#` in
 * front of both commands left every assertion green while the prover ran
 * NOWHERE. A battery that had killed step deletion three separate ways never
 * tried commenting it out.
 *
 * WHOLE BODY, not membership, and that is the second lesson. Matching the two
 * command lines anywhere in a step's script is satisfied by a step that wraps
 * them in `if [ "${{ github.event_name }}" = "schedule" ]; then ... fi` -- the
 * lines survive the trim, the assertions pass, and the prover runs on no PR at
 * all. That shape is not hypothetical: unit-tests.yml already uses it. So the
 * step's script must be EXACTLY these two commands in this order, and anything
 * wrapped around them reds. Shell control flow is not re-implemented here;
 * it is refused.
 *
 * A STEP THAT CANNOT FAIL THE JOB IS NOT A GATE. `if:`, continue-on-error,
 * `needs:` and an overridden `shell:` all disqualify, at whichever level they
 * appear. Every one of those rules is blunt on purpose: GitHub expressions are
 * not evaluated in this process, so "never fires" cannot be decided, and a rule
 * that admits what it cannot check is the fail-open this spec exists to
 * prevent. Adding a legitimate one means updating this spec deliberately.
 */
describe('the entry-point prover is actually invoked', () => {
  interface Step {
    run?: unknown;
    uses?: unknown;
    if?: unknown;
    shell?: unknown;
    'continue-on-error'?: unknown;
  }
  interface Job {
    steps?: Step[];
    if?: unknown;
    needs?: unknown;
    'continue-on-error'?: unknown;
  }
  interface Workflow { on?: unknown; jobs?: Record<string, Job> }

  // Every read and every parse happens INSIDE an it(). At describe-body level a
  // rename, a mid-edit file or a broken `yaml` devDependency fails the whole
  // FILE at collection -- which would take the prover's own selfTest offline
  // behind one red line, reporting 8 tests as 0. That spec needs no yaml at all,
  // and must not be able to lose its gate to this one's dependency.
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL('../' + rel, import.meta.url)), 'utf8');

  const loadWorkflow = async (): Promise<Workflow> => {
    const { parse } = await import('yaml');
    return parse(read('.github/workflows/architecture-guard.yml')) as Workflow;
  };

  /**
   * A node whose failure can be absolved is not a gate.
   *
   * ANY continue-on-error other than the boolean literal `false` disqualifies.
   * An earlier version tested `=== true`, which is the value yaml yields for
   * `continue-on-error: true` and for NOTHING else: `"true"` is a string, and a
   * `${{ ... }}` expression reaches this process as an unevaluated string too.
   * GitHub coerces both into a live continue-on-error, so matching only the
   * literal counted a non-gating step as a gate. `continue-on-error: false` is
   * still a gate, and the fixture below pins that edge so this cannot quietly
   * degrade into "reject everything".
   */
  const absolved = (node: Step | Job) =>
    node['continue-on-error'] !== undefined && node['continue-on-error'] !== false;

  /**
   * The scripts of steps that can actually fail the job, each as its trimmed
   * non-empty lines, in run order.
   *
   * `needs:` is disqualifying at job level for the same reason `if:` is: a job
   * downstream of one that skips is itself skipped, so the gate ceases to exist
   * without anything here changing. `shell:` is disqualifying at step level
   * because the default is `bash -e {0}` and the two commands share one script
   * -- override it with something lacking `-e` and the step's status becomes the
   * LAST command's, so a failing canary no longer stops the job.
   */
  const liveScripts = (doc: Workflow): string[][] => {
    const scripts: string[][] = [];
    for (const job of Object.values(doc.jobs ?? {})) {
      if (job.if !== undefined || job.needs !== undefined || absolved(job)) continue;
      for (const step of job.steps ?? []) {
        if (typeof step.run !== 'string') continue;
        if (step.if !== undefined || step.shell !== undefined || absolved(step)) continue;
        scripts.push(step.run.split('\n').map((l) => l.trim()).filter((l) => l !== ''));
      }
    }
    return scripts;
  };

  /**
   * `on:` normalised to a name -> configuration map.
   *
   * Three legal spellings reach here -- `on: push`, `on: [push, pull_request]`
   * and the block map -- and only the third has keys. Reading Object.keys of the
   * raw node false-reds on the other two, which is a red with no defect behind
   * it and trains a reader to edit the spec rather than believe it.
   */
  const triggers = (doc: Workflow): Record<string, unknown> => {
    const on = doc.on;
    if (typeof on === 'string') return { [on]: null };
    if (Array.isArray(on)) return Object.fromEntries(on.map((k) => [String(k), null]));
    return (on ?? {}) as Record<string, unknown>;
  };

  /** The script this whole change exists to put on the board, exactly. */
  const REQUIRED_SCRIPT = [
    'npm run prove:entry-point:self-test',
    'npm run prove:entry-point',
  ];

  it('architecture-guard.yml runs the sweep and its canary, as a gating step', async () => {
    const scripts = liveScripts(await loadWorkflow());
    // Whole-SCRIPT equality, and it carries three of this file's assertions at
    // once: both commands present, the canary first, and nothing wrapped around
    // them. Membership could not do the third, and whole-line equality within a
    // membership test could not do it either.
    //
    // Never `includes` on the command text: "npm run prove:entry-point" is a
    // PREFIX of the self-test row, so a substring test is satisfied by a step
    // wiring only the canary -- which drives the predicate in-process and never
    // spawns a target through a link.
    const matching = scripts.filter(
      (s) => s.length === REQUIRED_SCRIPT.length && s.every((l, i) => l === REQUIRED_SCRIPT[i]),
    );
    expect(matching).toEqual([REQUIRED_SCRIPT]);
  });

  /**
   * The sweep is the only step here that spawns processes, and its worst case
   * (targets x arms x the prover's own per-arm timeout) is far larger than the
   * job's budget. Unbounded, a few stalled arms get the JOB cancelled -- which
   * kills every step behind it and prints no verdict at all, because a
   * cancellation is not a failure anything reports.
   *
   * Pinned as an INVARIANT, not a magic number: a bound that is not smaller
   * than the job's own is not a bound. Retuning either value sensibly keeps
   * this green; deleting the step's, or setting it at or above the job's,
   * does not.
   */
  it('the sweep step is bounded more tightly than the job it runs in', async () => {
    const doc = await loadWorkflow();
    const job = (doc.jobs ?? {})['integrity'] as (Job & { 'timeout-minutes'?: unknown });
    const step = (job?.steps ?? []).find(
      (s) => typeof s.run === 'string' && s.run.includes('npm run prove:entry-point'),
    ) as (Step & { 'timeout-minutes'?: unknown }) | undefined;
    expect(step, 'the sweep step is gone entirely').toBeDefined();
    expect(typeof step!['timeout-minutes']).toBe('number');
    expect(typeof job['timeout-minutes']).toBe('number');
    expect(step!['timeout-minutes'] as number).toBeLessThan(job['timeout-minutes'] as number);
  });

  it('the workflow is a PR gate, and no filter narrows it away', async () => {
    const on = triggers(await loadWorkflow());
    expect(Object.keys(on)).toContain('pull_request');
    expect(Object.keys(on)).toContain('push');

    // Presence of the key is NOT the gate. `paths:` or `types:` under
    // pull_request switches this workflow off on exactly the PRs most able to
    // break the prover -- one that touches only scripts/ under a `src/**` path
    // filter sails through with the gate never queued, which is #235's shape
    // wearing a trigger's clothes. `branches:` is the one narrowing this repo
    // intends, and it is asserted by value below rather than merely allowed.
    const pr = (on['pull_request'] ?? {}) as Record<string, unknown>;
    expect(Object.keys(pr).sort()).toEqual(['branches']);
    expect(pr['branches']).toEqual(['main', 'master']);
  });

  // The ARGS, not just the id. A row degraded to "... --self-test" runs the
  // canary and sweeps nothing at all, and an id-only assertion cannot see it.
  it('the npm scripts are the sweep and the canary, not two canaries', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['prove:entry-point']).toBe('node scripts/prove-entry-point-dispatch.mjs');
    expect(pkg.scripts['prove:entry-point:self-test']).toBe(
      'node scripts/prove-entry-point-dispatch.mjs --self-test',
    );
  });

  /**
   * The prover CLI's own argument routing, end to end.
   *
   * Nothing else drives it. The in-process case at the top of this file calls
   * selfTest() directly, so it cannot reach the dispatch tail, and both drifts
   * available there are SILENT: `slice(2) -> slice(3)` leaves an empty argv,
   * which is the ordinary run, and deleting the `--self-test` route sends that
   * flag to the same place. Either way the workflow's canary command runs the
   * SWEEP, exits 0, and the canary never executes in CI -- a check that is
   * offline rather than passing, which is the incident this change exists for.
   *
   * NOT in-process and NOT offline, whatever an earlier draft of this comment
   * claimed: the first spawn runs the real canary in a grandchild process and
   * creates five links under the temp directory. It duplicates the 55 cases
   * driven above ON PURPOSE, because what it proves is not the cases but WHICH
   * function the flag reaches. The link side effect is not new -- selfTest()
   * above already makes those five links in this same test file, and refuses to
   * finish green having left one behind.
   *
   * Both spawns are bounded. spawnSync cannot be preempted by vitest's test
   * timeout, so an unbounded hang here blocks its worker until the job cap with
   * no named cause -- the whole failure class this file is about.
   */
  const SPAWN = { encoding: 'utf8' as const, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 };

  it('the prover CLI routes --self-test to the canary, not to the sweep', () => {
    const prover = fileURLToPath(
      new URL('../scripts/prove-entry-point-dispatch.mjs', import.meta.url),
    );
    const canary = spawnSync(process.execPath, [prover, '--self-test'], SPAWN);
    // Name the bound explicitly. Without this a timeout kill reports as a
    // missing marker and reads as a routing defect.
    expect(canary.error, String(canary.error)).toBeUndefined();
    expect(canary.stdout + canary.stderr).toContain('self-test --');
    // The sweep's own banner. Its ABSENCE is what says the flag did not fall
    // through to main(), which a positive-only assertion cannot establish.
    expect(canary.stdout).not.toContain('Entry-point proof PASSED');
    expect(canary.status).toBe(0);
  });

  it('the prover CLI passes its own arguments through to the flag check', () => {
    const prover = fileURLToPath(
      new URL('../scripts/prove-entry-point-dispatch.mjs', import.meta.url),
    );
    // An unknown flag has to REACH the flag check. A dropped argument means an
    // empty argv, which is the ordinary run: the full sweep, exit 0, and no
    // "Unknown flag" anywhere.
    const bogus = spawnSync(process.execPath, [prover, '--not-a-flag'], SPAWN);
    expect(bogus.error, String(bogus.error)).toBeUndefined();
    expect(bogus.stderr).toContain('Unknown flag');
    expect(bogus.status).toBe(2);
  });

  /**
   * The extractor's own canary.
   *
   * Without it `liveScripts` could return every raw line in the file and the
   * assertions above would still pass -- the real workflow does contain those
   * commands. This drives the EIGHT ways a step can be present in yaml and not
   * be a gate, none of which the real file can exercise while it is healthy,
   * plus the two ways it can look disqualified and not be.
   *
   * An earlier version drove three of the eight and left the job-level
   * continue-on-error and the `uses:` branch unexercised, so both could be
   * replaced by constants with the spec still green. A step with no `run:` is in
   * here for that second reason: delete the run-type check and `undefined.split`
   * throws; turn it into an unconditional `continue` and the list empties.
   */
  it('a step that cannot fail the job is not counted as running the prover', async () => {
    const { parse } = await import('yaml');
    const FIXTURE = [
      'on:',
      '  pull_request:',
      'jobs:',
      '  live:',
      '    steps:',
      '      - uses: actions/checkout@v7',
      '      - run: |',
      '          npm run real-gate',
      '          # npm run commented-gate',
      '      - run: npm run soft-gate',
      '        continue-on-error: true',
      '      - run: npm run stringy-soft-gate',
      '        continue-on-error: "true"',
      '      - run: npm run expression-soft-gate',
      '        continue-on-error: ${{ github.event_name == \'push\' }}',
      '      - run: npm run conditional-gate',
      '        if: github.event_name == "never"',
      '      - run: npm run unshelled-gate',
      '        shell: bash --noprofile --norc {0}',
      '  gated-job:',
      '    if: false',
      '    steps:',
      '      - run: npm run job-gated-command',
      '  soft-job:',
      '    continue-on-error: true',
      '    steps:',
      '      - run: npm run job-soft-command',
      '  dependent-job:',
      '    needs: [gated-job]',
      '    steps:',
      '      - run: npm run job-needs-command',
      '  explicit-gate-job:',
      '    continue-on-error: false',
      '    steps:',
      '      - run: npm run explicit-gate',
      '        continue-on-error: false',
    ].join('\n');

    const scripts = liveScripts(parse(FIXTURE) as Workflow);
    // Exact list, not eight `not.toContain`s. Equality is what makes the `uses:`
    // step load-bearing and what catches an extractor that starts emitting
    // something new.
    expect(scripts).toEqual([
      [
        'npm run real-gate',
        // NOT stripped, and that is the honest answer rather than a tidy one. A
        // `#` inside a `run: |` body is a SHELL comment: it really is a line of
        // that step's script, so an extractor claiming otherwise would assert a
        // rule nothing here tests. What disarms it is equality upstream --
        // '# npm run x' never equals 'npm run x'.
        '# npm run commented-gate',
      ],
      // The second edges, and they have to be REACHABLE: an explicit
      // `continue-on-error: false` at BOTH levels is still a gate, and a job
      // with no `needs:` is not disqualified by the needs rule. Without this
      // row `absolved = () => true` passes every assertion in this file.
      ['npm run explicit-gate'],
    ]);
    expect(scripts.flat()).not.toContain('npm run commented-gate');
  });

  /**
   * Wrapping, which whole-line membership could not see.
   *
   * This is finding 5 as an executable case rather than a comment. The two
   * commands are both present, both on their own lines, in the right order, in
   * a step with no `if:` and no continue-on-error -- and the prover runs on no
   * pull request at all. The shape is taken from unit-tests.yml, which uses it
   * today, so it is a spelling a future editor will reach for by example.
   */
  it('a step that WRAPS the commands in shell control flow is not the gate', async () => {
    const { parse } = await import('yaml');
    const WRAPPED = [
      'on:',
      '  pull_request:',
      'jobs:',
      '  live:',
      '    steps:',
      '      - run: |',
      '          if [ "${{ github.event_name }}" = "schedule" ]; then',
      '            npm run prove:entry-point:self-test',
      '            npm run prove:entry-point',
      '          fi',
    ].join('\n');

    const scripts = liveScripts(parse(WRAPPED) as Workflow);
    // Both commands ARE present -- membership would have accepted this.
    expect(scripts.flat()).toContain('npm run prove:entry-point');
    expect(scripts.flat()).toContain('npm run prove:entry-point:self-test');
    // Whole-script equality is what refuses it.
    const matching = scripts.filter(
      (s) => s.length === REQUIRED_SCRIPT.length && s.every((l, i) => l === REQUIRED_SCRIPT[i]),
    );
    expect(matching).toEqual([]);
  });
});
