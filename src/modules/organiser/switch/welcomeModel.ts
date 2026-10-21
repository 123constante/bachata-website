// Pure, client-free: Arc 1 flow 7c, the welcome when an invite adds a SECOND page.

/** "A", "A and B", "A, B and C". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The variant that replaces the plain landing when the joined page is not the first; null for the first page. */
export function joinedWelcome(joinedName: string, otherNames: readonly string[]): { title: string; sub: string } | null {
  if (otherNames.length === 0) return null;
  return {
    title: `You now manage ${joinedName}`,
    sub: `You also manage ${namesList(otherNames)}. Switch any time from Home.`,
  };
}
