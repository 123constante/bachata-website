import { sanitizeReturnTo } from '@/lib/authRouting';
import { decodePhoto } from './decodeImage';
import { realPhotoDeps, type PhotoFlowDeps } from './photoFlow';

export const DEFAULT_RETURN = '/app/me';

/** Where to go after a successful save: ?return= when safe, else Me. Never back into the photo screen or the auth page. */
export const returnPathFor = (raw: string | null): string => sanitizeReturnTo(raw, { exclude: '/app/me/photo' }) ?? DEFAULT_RETURN;

/** The photo flow's dependencies, swappable by tests (the real ones are upload + save + delete). */
export const photoScreenDeps: { flow: PhotoFlowDeps; decode: typeof decodePhoto } = { flow: realPhotoDeps, decode: decodePhoto };

