// D50: the wizard nudge's marks (Finish later, Not now) live in per-user
// localStorage. Every read and write is wrapped: a blocked or cleared storage
// only means the helpful prompt shows again, never an error.
import { EMPTY_NUDGE, type NudgeState } from './wizardModel';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const key = (userId: string) => `bc:profile-wizard-nudge:v1:${userId}`;

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function readNudge(userId: string, store: StorageLike | null = storage()): NudgeState {
  try {
    const raw = store?.getItem(key(userId));
    if (!raw) return EMPTY_NUDGE;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return { finishLaterAt: num(o.finishLaterAt), notNowAt: num(o.notNowAt), notNowCount: num(o.notNowCount) ?? 0 };
  } catch {
    return EMPTY_NUDGE;
  }
}

function write(userId: string, next: NudgeState, store: StorageLike | null): void {
  try {
    store?.setItem(key(userId), JSON.stringify(next));
  } catch {
    // Private mode, quota: the prompt simply shows again.
  }
}

export function markFinishLater(userId: string, now: number = Date.now(), store: StorageLike | null = storage()): void {
  write(userId, { ...readNudge(userId, store), finishLaterAt: now }, store);
}

export function markNotNow(userId: string, now: number = Date.now(), store: StorageLike | null = storage()): NudgeState {
  const prev = readNudge(userId, store);
  const next = { ...prev, notNowAt: now, notNowCount: prev.notNowCount + 1 };
  write(userId, next, store);
  return next;
}
