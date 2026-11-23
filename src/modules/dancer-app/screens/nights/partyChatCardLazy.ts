import { lazyWithRetry } from '@/lib/lazyWithRetry';

/** The party card, lazy. One definition shared by NightsScreen and NightsOff (flag VITE_ENABLE_PARTY_CHAT). */
export const PartyChatCard = lazyWithRetry(() => import('./PartyChatCard').then((m) => ({ default: m.PartyChatCard })));
