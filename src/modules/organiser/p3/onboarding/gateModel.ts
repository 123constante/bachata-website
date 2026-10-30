// The A1 gate screen's facts (plan Appendix A1), pure. The count and the codes are graceModel's ONE count
// (onboardingLeft / onboardingMissing) whenever the status read holds the refused page, the row words are
// Review's ONE mapping (pageModel reviewRow), and the Continue target is the same Review link Home's banner uses
// (p3StartReview). The refusal's own codes (DETAIL.missing) are used only where the status read cannot answer.
import { graceStatusFrom, onboardingLeft, onboardingMissing, thingsLeft } from './graceModel';
import { reviewRow } from './pageModel';
import { P3_PATHS, p3StartReview } from '../shell/paths';

export const GATE_COPY = {
  title: 'A few details first',
  body: 'We ask everyone who runs a page. It takes about five minutes and you only do it once.',
  go: 'Continue',
  notNow: 'Not now',
  readFailed: 'We couldn\u2019t load your details. Try again.',
  retry: 'Try again',
  loading: 'Checking what\u2019s left\u2026',
  notYours: 'These details are for a page you don\u2019t run, so its team finishes them. Ask them, or the Bachata Calendar team.',
} as const;

export type GateView =
  /** The gate never holds an admin (the server returns before checking): the sheet is never shown. */
  | { kind: 'admin' }
  /**
   * Something left: the count, one row per code. `to` = where Continue goes; null = no page here the person can
   * finish (the refused page is not theirs and nothing of their own is missing): Continue is off with `why`.
   */
  | { kind: 'left'; count: string; rows: string[]; to: string | null; why: string | null }
  /** Status not read (loading or failed), or nobody can say what is left: Continue goes to the page the server named. */
  | { kind: 'unknown'; to: string };

const left = (codes: string[], to: string | null, why: string | null = null): GateView =>
  ({ kind: 'left', count: thingsLeft(codes.length), rows: codes.map((c) => reviewRow(c).label), to, why });

/**
 * `raw` = organiser_onboarding_status_v1() for every page (statusQuery), undefined while it is not read;
 * `organiserId` / `refused` = the page and codes the refusal named (gate.ts refusalFacts). A refused write never
 * reads "nothing left": when the status read has caught up to 0 (or lags), the refusal's own codes are shown.
 */
export function gateView(raw: unknown, organiserId: string | null, refused: readonly string[] = []): GateView {
  const s = raw === undefined ? null : graceStatusFrom(raw, organiserId);
  if (!s) return { kind: 'unknown', to: p3StartReview(organiserId) };
  if (s.isAdmin) return { kind: 'admin' };
  // graceModel names the shown page; a page the status read does not list comes back with no id.
  const listed = organiserId === null || s.firstId === organiserId;
  if (listed) {
    const codes = onboardingLeft(s) > 0 ? onboardingMissing(s) : [...new Set(refused)];
    if (codes.length === 0) return { kind: 'unknown', to: p3StartReview(s.firstId ?? organiserId) };
    return left(codes, p3StartReview(s.firstId ?? organiserId));
  }
  // Not one of the person's pages (e.g. a co-organised series): only their own details can be finished here.
  const own = s.missing;
  const codes = [...new Set([...own, ...refused])];
  if (codes.length === 0) return { kind: 'unknown', to: P3_PATHS.youDetails };
  return own.length > 0 ? left(codes, P3_PATHS.youDetails) : left(codes, null, GATE_COPY.notYours);
}
