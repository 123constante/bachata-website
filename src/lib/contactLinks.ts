// Outbound community/contact links shared by the site chrome (GlobalHeader,
// BottomNav, GlobalFooter). One copy, so a rotated invite link is a one-line
// change rather than a hunt across components.

export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DdbNEnPvRLDGTBMbzcuDcz?mode=gi_t';

export const INSTAGRAM_URL = 'https://www.instagram.com/bachata.calendar/';

const WHATSAPP_LISTING_NUMBER = '447577576006';
const WHATSAPP_LISTING_MESSAGE = "Hi! I'd like to list my events on Bachata Calendar.";

// Direct chat with a prefilled "list my events" message.
export const WHATSAPP_GET_LISTED_URL =
  `https://wa.me/${WHATSAPP_LISTING_NUMBER}?text=${encodeURIComponent(WHATSAPP_LISTING_MESSAGE)}`;
