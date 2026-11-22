/**
 * Nights ticket QR flag (brief #1920), its own file so NightsScreen's first load carries the flag
 * and nothing of the ticket matching (nightsTicket.ts pulls the ticket status code; only the lazy
 * chunk imports it). Read at render in NightsView so tests can flip it.
 */
export const NIGHTS_TICKET_QR_ENABLED: boolean = import.meta.env.VITE_ENABLE_NIGHTS_TICKET_QR === 'true';
