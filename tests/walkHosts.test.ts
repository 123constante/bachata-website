// Slice 10 Part D: the walk host picker (scripts/lib/walk-hosts.mjs). Every row
// is a way two walks could share a machine, a walk could start on the Dell
// during CI or low RAM, or the queue could be served out of order. Mutants
// M1-M4 in the PR body were run against this suite.
import { describe, it, expect } from 'vitest';
import { WALK_HOST_RULES, DELL_MIN_FREE_RAM_GB, pickWalkHost, hostLockKey } from '../scripts/lib/walk-hosts.mjs';

const HEAD = 'a'.repeat(40);
const dell = (o: Record<string, unknown> = {}) => ({ name: 'dell', locked: false, isSecretsRunner: false, ciRunning: false, freeRamGb: 8, ...o });
const pc = (o: Record<string, unknown> = {}) => ({ name: 'pc', locked: false, isSecretsRunner: false, ownerBusy: false, ...o });
const laptop2 = (o: Record<string, unknown> = {}) => ({ name: 'laptop2', locked: false, isSecretsRunner: false, dayTestRunPassed: true, ...o });
const req = (id: string, requestedAt: unknown) => ({ id, requestedAt });
const Q1 = [req('r1', '2026-11-06T10:00:00Z')];

type Row = { name: string; hosts: unknown; queue: unknown; assign: { requestId: string; host: string } | null; waiting: Array<string | null>; reason?: RegExp };

const ROWS: Row[] = [
  { name: 'free Dell runs', hosts: [dell()], queue: Q1, assign: { requestId: 'r1', host: 'dell' }, waiting: [] },
  { name: 'Dell with CI running waits', hosts: [dell({ ciRunning: true })], queue: Q1, assign: null, waiting: ['r1'], reason: /ciRunning is true/ },
  { name: 'Dell at 3.0 GB waits', hosts: [dell({ freeRamGb: 3.0 })], queue: Q1, assign: null, waiting: ['r1'], reason: /freeRamGb 3 is not above 3/ },
  { name: 'Dell at 3.1 GB runs', hosts: [dell({ freeRamGb: 3.1 })], queue: Q1, assign: { requestId: 'r1', host: 'dell' }, waiting: [] },
  { name: 'Dell NaN RAM waits', hosts: [dell({ freeRamGb: NaN })], queue: Q1, assign: null, waiting: ['r1'], reason: /freeRamGb is not a finite number/ },
  { name: 'Dell missing RAM waits', hosts: [dell({ freeRamGb: undefined })], queue: Q1, assign: null, waiting: ['r1'], reason: /freeRamGb is not a finite number/ },
  { name: 'Dell string RAM waits', hosts: [dell({ freeRamGb: '8' })], queue: Q1, assign: null, waiting: ['r1'], reason: /freeRamGb is not a finite number/ },
  { name: 'Dell Infinity RAM waits', hosts: [dell({ freeRamGb: Infinity })], queue: Q1, assign: null, waiting: ['r1'], reason: /finite/ },
  { name: 'Dell NaN RAM falls through to free PC', hosts: [dell({ freeRamGb: NaN }), pc()], queue: Q1, assign: { requestId: 'r1', host: 'pc' }, waiting: [] },
  { name: 'Dell ciRunning missing waits (doubt)', hosts: [dell({ ciRunning: undefined })], queue: Q1, assign: null, waiting: ['r1'], reason: /ciRunning is not a boolean/ },
  { name: 'locked Dell waits', hosts: [dell({ locked: true })], queue: Q1, assign: null, waiting: ['r1'], reason: /locked is true/ },
  { name: 'locked as string waits', hosts: [pc({ locked: 'false' })], queue: Q1, assign: null, waiting: ['r1'], reason: /locked is not a boolean/ },
  { name: 'secrets-runner host skipped', hosts: [dell({ isSecretsRunner: true })], queue: Q1, assign: null, waiting: ['r1'], reason: /isSecretsRunner is true/ },
  { name: 'secrets-runner Dell skipped, PC taken', hosts: [dell({ isSecretsRunner: true }), pc()], queue: Q1, assign: { requestId: 'r1', host: 'pc' }, waiting: [] },
  { name: 'PC owner-busy waits', hosts: [pc({ ownerBusy: true })], queue: Q1, assign: null, waiting: ['r1'], reason: /ownerBusy is true/ },
  { name: 'PC free runs', hosts: [pc()], queue: Q1, assign: { requestId: 'r1', host: 'pc' }, waiting: [] },
  { name: 'laptop2 before a passed day run waits', hosts: [laptop2({ dayTestRunPassed: false })], queue: Q1, assign: null, waiting: ['r1'], reason: /dayTestRunPassed is false/ },
  { name: 'laptop2 day run unknown waits', hosts: [laptop2({ dayTestRunPassed: undefined })], queue: Q1, assign: null, waiting: ['r1'], reason: /dayTestRunPassed is not a boolean/ },
  { name: 'laptop2 after a passed day run runs', hosts: [laptop2()], queue: Q1, assign: { requestId: 'r1', host: 'laptop2' }, waiting: [] },
  { name: 'two requests, one free host: first runs, second waits', hosts: [dell()], queue: [req('r1', 1000), req('r2', 2000)], assign: { requestId: 'r1', host: 'dell' }, waiting: ['r2'], reason: /dell taken by r1/ },
  { name: 'FIFO by requestedAt (newer listed first)', hosts: [pc()], queue: [req('new', '2026-11-06T12:00:00Z'), req('old', '2026-11-06T09:00:00Z')], assign: { requestId: 'old', host: 'pc' }, waiting: ['new'] },
  { name: 'FIFO tie broken by id', hosts: [pc()], queue: [req('b', 5), req('a', 5)], assign: { requestId: 'a', host: 'pc' }, waiting: ['b'] },
  { name: 'FIFO waiting list keeps age order', hosts: [pc()], queue: [req('c', 3), req('a', 1), req('b', 2)], assign: { requestId: 'a', host: 'pc' }, waiting: ['b', 'c'] },
  { name: 'all hosts blocked: everyone waits oldest first', hosts: [dell({ ciRunning: true }), pc({ ownerBusy: true })], queue: [req('y', 2), req('x', 1)], assign: null, waiting: ['x', 'y'], reason: /no free walk host/ },
  { name: 'unknown host name: no assignment', hosts: [{ name: 'mac', locked: false, isSecretsRunner: false }, pc()], queue: Q1, assign: null, waiting: ['r1'], reason: /unknown host "mac"/ },
  { name: 'duplicate host: no assignment', hosts: [pc(), pc({ ownerBusy: true })], queue: Q1, assign: null, waiting: ['r1'], reason: /duplicate host pc/ },
  { name: 'host without name: no assignment', hosts: [{ locked: false }], queue: Q1, assign: null, waiting: ['r1'], reason: /hosts\[0\] has no name/ },
  { name: 'host not an object: no assignment', hosts: [null, pc()], queue: Q1, assign: null, waiting: ['r1'], reason: /hosts\[0\] is not an object/ },
  { name: 'empty hosts: request waits', hosts: [], queue: Q1, assign: null, waiting: ['r1'], reason: /no walk hosts reported/ },
  { name: 'empty queue: nothing to do', hosts: [dell(), pc()], queue: [], assign: null, waiting: [] },
  { name: 'hosts not an array', hosts: { dell: dell() }, queue: Q1, assign: null, waiting: ['r1'], reason: /hosts is not an array/ },
  { name: 'queue not an array', hosts: [pc()], queue: 'r1', assign: null, waiting: [null], reason: /queue is not an array/ },
  { name: 'request with bad requestedAt: no assignment', hosts: [pc()], queue: [req('r1', 'not a date')], assign: null, waiting: ['r1'], reason: /r1 has no valid requestedAt/ },
  { name: 'request with NaN requestedAt: no assignment', hosts: [pc()], queue: [req('r1', NaN)], assign: null, waiting: ['r1'], reason: /requestedAt/ },
  { name: 'request without id: no assignment', hosts: [pc()], queue: [{ requestedAt: 1 }, req('r2', 2)], assign: null, waiting: ['r2'], reason: /queue\[0\] has no id/ },
  { name: 'duplicate request id: no assignment', hosts: [pc()], queue: [req('r1', 1), req('r1', 2)], assign: null, waiting: ['r1'], reason: /duplicate request r1/ },
];

describe('pickWalkHost', () => {
  it.each(ROWS)('$name', (row) => {
    let out: ReturnType<typeof pickWalkHost> | undefined;
    expect(() => { out = pickWalkHost(row.hosts as never, row.queue as never); }).not.toThrow();
    expect(out!.assign).toEqual(row.assign);
    expect(out!.waiting.map((w) => w.requestId)).toEqual(row.waiting);
    for (const w of out!.waiting) expect(typeof w.reason === 'string' && w.reason.length > 0).toBe(true);
    if (row.reason) expect(out!.waiting[0].reason).toMatch(row.reason);
  });

  it('never assigns a host twice across a sequence of picks when the lock is honoured', () => {
    const hosts = [dell(), pc({ ownerBusy: true }), laptop2({ dayTestRunPassed: false })];
    const first = pickWalkHost(hosts, [req('r1', 1), req('r2', 2)]);
    expect(first.assign).toEqual({ requestId: 'r1', host: 'dell' });
    const second = pickWalkHost([dell({ locked: true }), hosts[1], hosts[2]], [req('r2', 2)]);
    expect(second.assign).toBeNull();
    const third = pickWalkHost(hosts, [req('r2', 2)]);
    expect(third.assign).toEqual({ requestId: 'r2', host: 'dell' });
  });

  it('prefers hosts in table order when several are free', () => {
    expect(pickWalkHost([laptop2(), pc(), dell()], Q1).assign).toEqual({ requestId: 'r1', host: 'dell' });
    expect(pickWalkHost([laptop2(), pc()], Q1).assign).toEqual({ requestId: 'r1', host: 'pc' });
  });

  it('does not mutate its inputs', () => {
    const hosts = [pc()];
    const queue = [req('b', 2), req('a', 1)];
    const snap = JSON.stringify({ hosts, queue });
    pickWalkHost(hosts, queue);
    expect(JSON.stringify({ hosts, queue })).toBe(snap);
  });
});

describe('WALK_HOST_RULES', () => {
  it('is frozen and lists exactly dell, pc, laptop2', () => {
    expect(Object.isFrozen(WALK_HOST_RULES)).toBe(true);
    expect(Object.keys(WALK_HOST_RULES)).toEqual(['dell', 'pc', 'laptop2']);
    for (const r of Object.values(WALK_HOST_RULES)) {
      expect(Object.isFrozen(r)).toBe(true);
      expect(Object.isFrozen(r.requires)).toBe(true);
      expect(r.requires).toMatchObject({ locked: false, isSecretsRunner: false });
    }
  });
  it('states each host rule', () => {
    expect(WALK_HOST_RULES.dell.requires).toMatchObject({ ciRunning: false, freeRamGbAbove: 3 });
    expect(DELL_MIN_FREE_RAM_GB).toBe(3);
    expect(WALK_HOST_RULES.pc.requires).toMatchObject({ ownerBusy: false });
    expect(WALK_HOST_RULES.laptop2.requires).toMatchObject({ dayTestRunPassed: true });
  });
});

describe('hostLockKey', () => {
  it('returns stable lock and build keys', () => {
    expect(hostLockKey('dell', HEAD)).toEqual({ lock: 'walk:dell', build: `build:${HEAD}` });
    expect(hostLockKey('dell', HEAD)).toEqual(hostLockKey('dell', HEAD));
  });
  it.each([
    ['empty host', '', HEAD, /host is empty/],
    ['blank host', '  ', HEAD, /host is empty/],
    ['non-string host', 7, HEAD, /host is empty/],
    ['unknown host', 'mac', HEAD, /unknown host/],
    ['short sha', 'pc', 'a'.repeat(39), /40 hex/],
    ['long sha', 'pc', 'a'.repeat(41), /40 hex/],
    ['non-hex sha', 'pc', 'g'.repeat(40), /40 hex/],
    ['missing sha', 'pc', undefined, /40 hex/],
  ])('throws on %s', (_n, host, sha, msg) => {
    expect(() => hostLockKey(host as never, sha as never)).toThrow(msg);
  });
});
