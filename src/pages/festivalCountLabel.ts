export function festivalCountLabel(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n === 1 ? '1 upcoming festival' : `${n} upcoming festivals`;
}
