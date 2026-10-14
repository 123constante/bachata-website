/**
 * eventCategory.ts -- byte-identical twin: admin lib/eventCategory.ts and Website src/lib/eventCategory.ts.
 *
 * Event-truth arc P1 (owner decision 2026-10-12, "there is no logic in asking"):
 * event_series_p5.category is DERIVED from the programme sessions. Nobody is asked.
 * This file is THE derivation on the client side; _derive_series_category_v1 is its SQL
 * twin. Keep it dependency-free, LF, ASCII only, so both repos hold the same bytes.
 *
 * Inputs are raw programme vocabulary from three sources: series section kinds
 * (event_series_program_section_p5.kind), series item types (event_series_program_item_p5.type),
 * and date-only sessions (event_occurrence_added_session_p5 section_kind and type), which is
 * where an organiser's sessions live. Anything outside the mapped values is ignored, never an
 * error.
 *
 * Two readings, never mixed:
 * - the SET (deriveCategories) answers "is it listed under Parties / Classes?" and needs the
 *   programme;
 * - the WORD (wordForStored) is what a single-word surface shows, and reads the stored mirror,
 *   so every screen shows the same word whether or not it loaded the programme.
 */

/** A genre a programme implies. The public calendar's Parties / Classes tabs read these. */
export type DerivedGenre = 'party' | 'class' | 'masterclass';

/** The one word a UI shows for a series. */
export type CategoryWord = 'festival' | 'course' | 'night' | 'masterclass' | 'class';

/** The CHECK vocabulary of event_series_p5.category. */
export type StoredCategory = 'party' | 'class' | 'workshop' | 'masterclass';

export interface DerivedCategories {
    /** Stable order: party, class, masterclass; only the members the programme implies. */
    set: DerivedGenre[];
    /** null when the format gives no word and the programme has no session. */
    word: CategoryWord | null;
}

const GENRE_ORDER: DerivedGenre[] = ['party', 'class', 'masterclass'];

function genresOf(value: unknown): DerivedGenre[] {
    switch (value) {
        case 'party':
        case 'social':
            return ['party'];
        case 'classes':
        case 'class':
        case 'workshop':
            return ['class'];
        case 'masterclass':
            return ['class', 'masterclass'];
        default:
            return [];
    }
}

/**
 * The genre set from section kinds and item types together (a party section with no item
 * still counts), and the single word the programme implies.
 */
export function deriveCategories(
    format: string | null | undefined,
    sectionKinds: ReadonlyArray<string | null | undefined> | null | undefined,
    itemTypes: ReadonlyArray<string | null | undefined> | null | undefined,
): DerivedCategories {
    const found = new Set<DerivedGenre>();
    for (const kind of sectionKinds ?? []) for (const g of genresOf(kind)) found.add(g);
    for (const type of itemTypes ?? []) for (const g of genresOf(type)) found.add(g);
    const set = GENRE_ORDER.filter((g) => found.has(g));
    return { set, word: categoryWord(format, set) };
}

/** The single word: the format first (festival, course), else the strongest genre. */
export function categoryWord(format: string | null | undefined, set: ReadonlyArray<DerivedGenre>): CategoryWord | null {
    if (format === 'festival') return 'festival';
    if (format === 'course') return 'course';
    if (set.includes('party')) return 'night';
    if (set.includes('masterclass')) return 'masterclass';
    if (set.includes('class')) return 'class';
    return null;
}

/** Whether a stored category agrees with a derived set. A null category agrees with nothing. */
export function categoryAgrees(stored: string | null | undefined, set: ReadonlyArray<DerivedGenre>): boolean {
    if (stored === 'party') return set.includes('party');
    if (stored === 'class' || stored === 'workshop') return set.includes('class');
    if (stored === 'masterclass') return set.includes('masterclass');
    return false;
}

/**
 * The value the event_series_p5.category mirror holds for a set: the current value when it
 * still agrees (so a stored workshop survives and nothing churns), else the first of
 * party > masterclass > class, and null for an empty set (an honest "not set": the series
 * has no session). A client-sent value therefore survives only when the sessions already
 * agree with it.
 */
export function storedCategory(current: string | null | undefined, set: ReadonlyArray<DerivedGenre>): StoredCategory | null {
    if (categoryAgrees(current, set)) return current as StoredCategory;
    if (set.includes('party')) return 'party';
    if (set.includes('masterclass')) return 'masterclass';
    if (set.includes('class')) return 'class';
    return null;
}

/** The genres a stored mirror value stands for (the inverse of storedCategory's pick). */
export function setForStored(stored: string | null | undefined): DerivedGenre[] {
    if (stored === 'party') return ['party'];
    if (stored === 'class' || stored === 'workshop') return ['class'];
    if (stored === 'masterclass') return ['class', 'masterclass'];
    return [];
}

/** The single word every single-word surface shows: the format, else the stored mirror. */
export function wordForStored(format: string | null | undefined, stored: string | null | undefined): CategoryWord | null {
    return categoryWord(format, setForStored(stored));
}

/** How a word reads as a label (a field value, a chip). */
export const CATEGORY_WORD_LABEL: Record<CategoryWord, string> = {
    festival: 'Festival',
    course: 'Course',
    night: 'Night',
    masterclass: 'Masterclass',
    class: 'Class',
};

/** The label for a series with no word: no session yet, so nothing to derive from. */
export const NOT_SET_LABEL = 'Not set';

/** The label a series shows: its word, or NOT_SET_LABEL. */
export function categoryLabelFor(format: string | null | undefined, stored: string | null | undefined): string {
    const word = wordForStored(format, stored);
    return word ? CATEGORY_WORD_LABEL[word] : NOT_SET_LABEL;
}
