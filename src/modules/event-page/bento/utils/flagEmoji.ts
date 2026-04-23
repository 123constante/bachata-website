// Converts an ISO 3166-1 alpha-2 country code ("GB", "ES", "PT", …) into the
// corresponding flag emoji by mapping each letter to its Unicode regional
// indicator symbol (A → 🇦, B → 🇧, …). The two letters combined render as a
// flag in fonts that support emoji. Returns null for malformed input so the
// caller can choose a fallback.
export const iso2ToFlagEmoji = (code: string | null | undefined): string | null => {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  const [a, b] = trimmed;
  const base = 0x1f1e6; // 🇦
  const offset = (ch: string) => ch.charCodeAt(0) - 'A'.charCodeAt(0);
  return String.fromCodePoint(base + offset(a)) + String.fromCodePoint(base + offset(b));
};
