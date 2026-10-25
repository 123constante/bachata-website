import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import type { DancerDelta, DancerGate, FeatureKey, FeedbackKind, FeedbackReceipt, MyDancerEdit, MyDancerStats, MyFeatureInterest, MyProfileViews, PublicDancerExtras } from './types';

/**
 * The SMALL half of api/: the backend slot and the gate read. It is all that
 * gate/useDancerArea (and so RedirectIfAllowed, which sits in the catchall's
 * every-route AnimatedRoutes chunk) needs, so the error copy and the profile
 * parsers in api/rpc.ts stay inside the lazy dancer-app chunk. Screens import
 * from api/rpc.ts, never from here.
 */
export type DancerBackend = {
  fetchGate(): Promise<DancerGate>;
  fetchMyDancerEdit(): Promise<MyDancerEdit>;
  saveMyDancerProfile(delta: DancerDelta): Promise<MyDancerEdit>;
  fetchPublicExtras(profileId: string): Promise<PublicDancerExtras>;
  fetchMyStats(): Promise<MyDancerStats>;
  fetchMyViews(): Promise<MyProfileViews>;
  submitFeedback(body: string, kind: FeedbackKind, page: string | null): Promise<FeedbackReceipt>;
  registerFeatureInterest(feature: FeatureKey): Promise<{ alreadyRegistered: boolean }>;
  fetchMyFeatureInterest(): Promise<MyFeatureInterest>;
};

export const DANCER_GATE_RPC = 'dancer_area_gate_v1';

let override: DancerBackend | null = null;

/** Tests only: route the four wrappers to an in-memory backend (null restores the real RPCs). */
export const setFakeBackend = (backend: DancerBackend | null): void => {
  override = backend;
};

export const backendOverride = (): DancerBackend | null => override;

/** Thrown for a gate answer that is not exactly {open: bool, allowed: bool}: the gate fails CLOSED. */
export const GATE_SHAPE_ERROR = 'dancer_area_gate_v1 returned an unexpected shape';

export const parseGate = (data: unknown): DancerGate => {
  const d = data as { open?: unknown; allowed?: unknown } | null;
  if (!d || typeof d !== 'object' || Array.isArray(d) || typeof d.open !== 'boolean' || typeof d.allowed !== 'boolean') {
    throw new Error(GATE_SHAPE_ERROR);
  }
  return { open: d.open, allowed: d.allowed };
};

/**
 * dancer_area_gate_v1, raw: rejects with a plain Error (the server message) on
 * any failure. useDancerArea needs no copy: every failure is "closed".
 * api/rpc.ts fetchGate wraps this with the error map for everyone else.
 */
export const fetchGateRaw = async (): Promise<DancerGate> => {
  const o = override;
  if (o) return o.fetchGate();
  const { data, error } = await rpcLoose(DANCER_GATE_RPC);
  if (error) throw new Error(error.message);
  return parseGate(data);
};
