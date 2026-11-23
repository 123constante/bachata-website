/**
 * Party chat S1 flag (VITE_ENABLE_PARTY_CHAT, default OFF). Own file so the Nights first load carries
 * the flag and nothing of the card. Read at render so tests can flip it.
 */
export const PARTY_CHAT_ENABLED = (): boolean => import.meta.env.VITE_ENABLE_PARTY_CHAT === 'true';
