// Pure, client-free: the welcome an accepted invite lands on. Arc 1 flow 1d
// (the first page) and 7c (a SECOND page).

/** "A", "A and B", "A, B and C". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface JoinedWelcome {
  /** 1d: the first page on the login; 7c: another page is already on it. */
  screen: '1d' | '7c';
  title: string;
  sub: string;
}

/** 1d with no other page; 7c replaces it when the joined page is not the first. `switchFrom`: where Switch lives (R1 Home, P3 You). */
export function joinedWelcome(joinedName: string, otherNames: readonly string[], switchFrom = 'Home'): JoinedWelcome {
  if (otherNames.length === 0) {
    return { screen: '1d', title: `You manage ${joinedName}`, sub: 'Add your first event whenever you are ready.' };
  }
  return {
    screen: '7c',
    title: `You now manage ${joinedName}`,
    sub: `You also manage ${namesList(otherNames)}. Switch any time from ${switchFrom}.`,
  };
}
