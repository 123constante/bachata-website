const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shape check only (something@something.tld). Shared by the organiser team screen and the admin access page. */
export const isPlausibleEmail = (v: string) => EMAIL_RE.test(v.trim());
