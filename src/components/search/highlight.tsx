import type { ReactNode } from 'react';

const BACKSLASH = String.fromCharCode(92);
const SPECIALS = new Set(('.*+?^${}()|[]' + BACKSLASH).split(''));

// Escape regex metacharacters. Built without a backslash-laden literal on
// purpose (this build path mangles doubled backslashes); behaviourally
// identical to the classic metacharacter-escaping replace used before.
export const escapeRegExp = (s: string): string =>
  Array.from(s).map((ch) => (SPECIALS.has(ch) ? BACKSLASH + ch : ch)).join('');

// Wrap matched query tokens in an amber mark. Cosmetic only: the RPC already
// ranked the match, so a client-side miss (e.g. diacritics) just renders plain
// text. Shared by the overlay and the results cards.
export function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return text;
  let re: RegExp;
  try {
    re = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
  } catch {
    return text;
  }
  const lower = new Set(tokens.map((t) => t.toLowerCase()));
  return text.split(re).filter(Boolean).map((part, i) =>
    lower.has(part.toLowerCase())
      ? <mark key={i} className="bg-transparent font-bold text-primary">{part}</mark>
      : <span key={i}>{part}</span>,
  );
}
