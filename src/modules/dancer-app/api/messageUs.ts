import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';

/**
 * "Message us" links for dancers: the site's one direct WhatsApp chat (the number in
 * WHATSAPP_GET_LISTED_URL, read from that constant, never copied) with a DANCER message,
 * not the organiser "list my events" prefill. Static: lib/contactLinks already rides the
 * chunk every route loads (GlobalHeader, BottomNav), so the href is there on first render.
 */
export const dancerMessageUsUrl = (text: string): string => {
  const base = new URL(WHATSAPP_GET_LISTED_URL);
  return `${base.origin}${base.pathname}?text=${encodeURIComponent(text)}`;
};

export const NOT_ME_MESSAGE = 'Hi! The dancer profile linked to my Bachata Calendar account is not me.';
export const ADD_CITY_MESSAGE = 'Hi! Please add my city to Bachata Calendar. My city is: ';
export const NO_PROFILE_MESSAGE = 'Hi! My Bachata Calendar account has no dancer profile yet. Please can you set one up?';
export const PROFILE_HELP_MESSAGE = 'Hi! I need help with my Bachata Calendar dancer profile.';
