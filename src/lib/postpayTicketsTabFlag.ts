/**
 * Post-pay lands on the Tickets tab (brief postpay-tickets-tab, option A).
 * ON: a signed-in buyer returning from checkout goes to /app/tickets?o= (not /app/home); the tab
 * opens with a "You're booked" bar, the ticket card shows event + date only, and the account-link
 * panel lives on the Me tab. OFF (default): exactly as before. Rollback = flag off.
 */
export const POSTPAY_TICKETS_TAB_ENABLED: boolean = import.meta.env.VITE_ENABLE_POSTPAY_TICKETS_TAB === 'true';
