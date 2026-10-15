export const greeting = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
