import { TRACK, gate, stepOf, story, type Gate, type RaffleNight, type RaffleRead } from '../events/raffle/raffleModel';

/**
 * Board R4Raffle: the Open / Entries / Closed / Winner track, the Entered tile, the Locked card and
 * "Pick the winner" (off until doors close). Every fact comes from raffleModel (organiser_raffle_nights_v1,
 * behind ORGANISER_RAFFLE_LIVE); nothing is drawn without a read. The Website never draws: the draw is ours.
 */
export type StepState = 'done' | 'now' | 'next';

export type R4RaffleModel =
  | { kind: 'soon' }
  | { kind: 'none' }
  | {
    kind: 'night';
    chip: RaffleNight['chip'];
    steps: { word: string; state: StepState }[];
    /** Entered count: shown once a raffle is (or was) on this night; null hides the tile. */
    entered: number | null;
    /** The winner's first name once drawn ("Name not shown" without one); null before. */
    winner: string | null;
    /** The board's Locked card: someone entered, so it cannot be closed here. */
    locked: { title: string; body: string } | null;
    /** The status story for the shapes the board does not draw (off, draft, cancelled, nobody entered). */
    story: { title: string; body: string } | null;
    /** Pick the winner: always off on the Website; why says when / who. */
    pickWhy: string;
    /** The one open / close / message move (through the confirmation sheet), or null. */
    action: Gate | null;
  };

export const RAFFLE_COPY = {
  privacy: 'You see how many entered, never who.',
  pickBefore: 'Available when doors close.',
  pickPast: 'We draw the winner from our side and tell them.',
  pickDrawn: 'The winner is drawn.',
  pickOff: 'There is no raffle on this night to draw.',
  lockedBody: 'Once the first person enters, the raffle cannot be closed or changed. This keeps it fair for everyone who entered.',
  noName: 'Name not shown',
} as const;

export const lockedTitle = (n: number): string => `Locked: ${n === 1 ? '1 person has' : `${n} people have`} entered`;

export function r4RaffleOf(live: boolean, n: RaffleNight | null, read: Pick<RaffleRead, 'canEdit' | 'viewOnlyReason'> | null): R4RaffleModel {
  if (!live) return { kind: 'soon' };
  if (!n || !read) return { kind: 'none' };
  const step = stepOf(n);
  const steps = TRACK.map((word, i) => ({ word, state: (i < step ? 'done' : i === step ? 'now' : 'next') as StepState }));
  const ran = n.chip === 'open' || n.chip === 'locked' || n.chip === 'drawn' || (n.chip === 'past' && n.entries > 0);
  const entered = ran ? (n.chip === 'drawn' && n.winner?.entriesAtDraw != null ? n.winner.entriesAtDraw : n.entries) : null;
  const pickWhy = n.chip === 'drawn' ? RAFFLE_COPY.pickDrawn
    : n.chip === 'past' ? (n.entries > 0 ? RAFFLE_COPY.pickPast : RAFFLE_COPY.pickOff)
      : n.chip === 'open' || n.chip === 'locked' ? RAFFLE_COPY.pickBefore : RAFFLE_COPY.pickOff;
  const g = gate(n, read);
  const boardDraws = n.chip === 'open' || n.chip === 'locked' || n.chip === 'drawn' || (n.chip === 'past' && n.entries > 0);
  return {
    kind: 'night',
    chip: n.chip,
    steps,
    entered,
    winner: n.chip === 'drawn' ? n.winner?.firstName ?? RAFFLE_COPY.noName : null,
    locked: n.chip === 'locked' ? { title: lockedTitle(n.entries), body: RAFFLE_COPY.lockedBody } : null,
    story: boardDraws && n.chip !== 'past' ? null : story(n),
    pickWhy,
    action: g.action === 'none' ? null : g,
  };
}
