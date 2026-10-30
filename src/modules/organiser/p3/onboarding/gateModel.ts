// The A1 gate screen's facts (plan Appendix A1), pure. The count and the codes are graceModel's ONE count
// (onboardingLeft / onboardingMissing), the row words are Review's ONE mapping (pageModel reviewRow), and the
// Continue target is the same Review link Home's banner uses (p3StartReview): never a second copy of any.
import { graceStatusFrom, onboardingLeft, onboardingMissing, thingsLeft } from './graceModel';
import { reviewRow } from './pageModel';
import { p3StartReview } from '../shell/paths';

export const GATE_COPY = {
  title: 'A few details first',
  body: 'We ask everyone who runs a page. It takes about five minutes and you only do it once.',
  go: 'Continue',
  notNow: 'Not now',
  readFailed: 'We couldn\u2019t load your details. Try again.',
  retry: 'Try again',
  loading: 'Checking what\u2019s left\u2026',
  done: 'Your details are finished now, so you can make changes again.',
  close: 'Close',
} as const;

export type GateView =
  /** The gate never holds an admin (the server returns before checking): the sheet is never shown. */
  | { kind: 'admin' }
  /** The status read says nothing is left (it caught up after the refusal): no Continue, just close and save again. */
  | { kind: 'done' }
  /** Something left: the count, one row per code, Continue to that page's Review. */
  | { kind: 'left'; count: string; rows: string[]; to: string }
  /** Status not read (loading or failed): Continue still goes to the page the server named. */
  | { kind: 'unknown'; to: string };

/**
 * `raw` = organiser_onboarding_status_v1() for every page (statusQuery), undefined while it is not read;
 * `organiserId` = the page the refusal named (gate.ts refusalOrganiser), or null. The page shown is the
 * one the server named; with none named, graceModel's own choice (the first page still missing something).
 */
export function gateView(raw: unknown, organiserId: string | null): GateView {
  const s = raw === undefined ? null : graceStatusFrom(raw, organiserId);
  if (!s) return { kind: 'unknown', to: p3StartReview(organiserId) };
  if (s.isAdmin) return { kind: 'admin' };
  const n = onboardingLeft(s);
  if (n === 0) return { kind: 'done' };
  return {
    kind: 'left',
    count: thingsLeft(n),
    rows: onboardingMissing(s).map((c) => reviewRow(c).label),
    to: p3StartReview(s.firstId ?? organiserId),
  };
}
