// Raffle v2 win-state table (D6): one row per state. R4/R5 extend it.
// A winner's name is public only once the place is locked or attended.
export const RAFFLE_WIN_STATES = {
  contacted: { showsPublicName: false },
  locked: { showsPublicName: true },
  attended: { showsPublicName: true },
  no_show: { showsPublicName: false },
  released: { showsPublicName: false },
  cancelled: { showsPublicName: false },
} as const;

export type RaffleWinState = keyof typeof RAFFLE_WIN_STATES;

export function showsPublicName(state: unknown): boolean {
  return typeof state === 'string' && Object.prototype.hasOwnProperty.call(RAFFLE_WIN_STATES, state)
    ? RAFFLE_WIN_STATES[state as RaffleWinState].showsPublicName
    : false;
}
