export const greeting = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

/**
 * Audit L14: ONE verb for going to the events listing ("Browse events", the same
 * noun the site header uses) and ONE noun for what a person saved ("nights", the
 * tab name). Home and Nights read these; never a second spelling.
 */
export const BROWSE_EVENTS_LABEL = 'Browse events';
