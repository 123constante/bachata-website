import { describe, expect, it } from 'vitest';
import { declinedRequests } from '../accessRequestModel';
import type { MyAccessRequest } from '../selfServeApi';

const NOW = new Date('2026-10-05T12:00:00Z');
const req = (over: Partial<MyAccessRequest>): MyAccessRequest => ({
  requestId: 'r1',
  organiserId: 'o1',
  organiserName: 'Walk Mismatch Socials',
  status: 'declined',
  createdAt: '2026-10-03T10:00:00Z',
  resolvedAt: '2026-10-04T10:00:00Z',
  ...over,
});

describe('declinedRequests (S4)', () => {
  it('returns a recently declined request', () => {
    expect(declinedRequests([req({})], NOW).map((r) => r.requestId)).toEqual(['r1']);
  });
  it('ignores open and granted requests', () => {
    expect(declinedRequests([req({ status: 'open', resolvedAt: null }), req({ requestId: 'r2', organiserId: 'o2', status: 'granted' })], NOW)).toEqual([]);
  });
  it('a newer open request for the same organiser supersedes the decline', () => {
    const rows = [req({}), req({ requestId: 'r2', status: 'open', resolvedAt: null, createdAt: '2026-10-05T09:00:00Z' })];
    expect(declinedRequests(rows, NOW)).toEqual([]);
  });
  it('an older decline does not hide behind nothing: newest per organiser only', () => {
    const rows = [req({ requestId: 'old', createdAt: '2026-10-01T00:00:00Z', resolvedAt: '2026-10-02T00:00:00Z' }), req({ requestId: 'new' })];
    expect(declinedRequests(rows, NOW).map((r) => r.requestId)).toEqual(['new']);
  });
  it('drops a decline older than 30 days', () => {
    expect(declinedRequests([req({ createdAt: '2026-08-01T00:00:00Z', resolvedAt: '2026-08-02T00:00:00Z' })], NOW)).toEqual([]);
  });
});
