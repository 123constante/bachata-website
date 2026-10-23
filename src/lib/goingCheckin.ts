/**
 * ONE switch for every public "I'm going" surface (Going P2).
 *
 * OFF on production (owner decision; turning it on is the owner's call, not a
 * PR's). Off = nothing renders and no going RPC runs.
 *
 * The ONE override, for walks on a preview deploy: ON only when the build is a
 * Vercel PREVIEW (VERCEL_ENV === 'preview', exposed to the client by
 * vite.config.ts `define` as import.meta.env.VITE_VERCEL_ENV) AND the per-build
 * flag VITE_ENABLE_GOING_PREVIEW is exactly 'true' (the preview tool passes
 * VITE_ENABLE_*=true|false per build). Production, development, a local build
 * and a missing env are all OFF whatever VITE_ENABLE_GOING_PREVIEW says
 * (tests/client/goingSwitch.test.ts; tests/client/goingSwitchFold.test.ts runs a
 * real Vite build to prove the fold).
 */
export type GoingSwitchEnv = { vercelEnv?: string | null; goingPreview?: string | null };

/** The pure decision. */
export const goingSwitchOn = (env: GoingSwitchEnv): boolean =>
  env.vercelEnv === 'preview' && env.goingPreview === 'true';

// Both keys are `define`d in vite.config.ts, so a build replaces each access with
// a string literal (no env object is inlined) and this folds to a constant.
// import.meta.env is absent outside Vite (Playwright imports this file in Node): off.
const readSwitch = (): boolean => {
  try {
    return goingSwitchOn({
      vercelEnv: import.meta.env.VITE_VERCEL_ENV,
      goingPreview: import.meta.env.VITE_ENABLE_GOING_PREVIEW,
    });
  } catch {
    return false;
  }
};

export const GOING_CHECKIN_ENABLED: boolean = readSwitch();
