import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';

/**
 * Where "Get listed" / "Join" sends an organiser. Sign-in, the organiser area and onboarding go
 * live together, so with organiserSelfServe OFF nothing may link to /auth or /account/new: the
 * WhatsApp listing link the other CTAs already use is the working route.
 */
export function getListedTarget(selfServe: boolean): { external: boolean; href: string } {
  return selfServe
    ? { external: false, href: '/account/new' }
    : { external: true, href: WHATSAPP_GET_LISTED_URL };
}
