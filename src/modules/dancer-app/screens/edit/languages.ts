/**
 * The Languages picker's list and its pure helpers. Imported ONLY by LanguagePicker (itself lazy), so the
 * dancer-app first-load chunk does not carry it. ISO 639-1 English names; no "Other": a stored value the list
 * does not know stays visible as a tick (see selectedLanguages), so nothing is lost on save.
 * The draft stays the comma text the save path has always taken (parseLanguages in ../me/model).
 */

/**
 * Same rule as parseLanguages in ../me/model (split on commas, trim, drop empties, dedupe case-insensitively),
 * restated here ON PURPOSE: a lazy chunk that imports from the dancer-app chunk stops that chunk being the
 * src/modules/dancer-app/dancer-app.tsx manifest entry and check:bundle-budget loses the /app/* row (measured;
 * see screens/home/homeGoing.tsx). The test file asserts the two agree.
 */
const parseLanguages = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const item = raw.trim();
    const key = item.toLowerCase();
    if (item === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

export const LANGUAGES: readonly string[] = [
  'Abkhazian',
  'Afar',
  'Afrikaans',
  'Akan',
  'Albanian',
  'Amharic',
  'Arabic',
  'Aragonese',
  'Armenian',
  'Assamese',
  'Avaric',
  'Avestan',
  'Aymara',
  'Azerbaijani',
  'Bambara',
  'Bashkir',
  'Basque',
  'Belarusian',
  'Bengali',
  'Bislama',
  'Bosnian',
  'Breton',
  'Bulgarian',
  'Burmese',
  'Catalan',
  'Central Khmer',
  'Chamorro',
  'Chechen',
  'Chichewa',
  'Chinese',
  'Church Slavonic',
  'Chuvash',
  'Cornish',
  'Corsican',
  'Cree',
  'Croatian',
  'Czech',
  'Danish',
  'Divehi',
  'Dutch',
  'Dzongkha',
  'English',
  'Esperanto',
  'Estonian',
  'Ewe',
  'Faroese',
  'Fijian',
  'Finnish',
  'French',
  'Fulah',
  'Gaelic',
  'Galician',
  'Ganda',
  'Georgian',
  'German',
  'Greek',
  'Guarani',
  'Gujarati',
  'Haitian Creole',
  'Hausa',
  'Hebrew',
  'Herero',
  'Hindi',
  'Hiri Motu',
  'Hungarian',
  'Icelandic',
  'Ido',
  'Igbo',
  'Indonesian',
  'Interlingua',
  'Interlingue',
  'Inuktitut',
  'Inupiaq',
  'Irish',
  'Italian',
  'Japanese',
  'Javanese',
  'Kalaallisut',
  'Kannada',
  'Kanuri',
  'Kashmiri',
  'Kazakh',
  'Kikuyu',
  'Kinyarwanda',
  'Kirghiz',
  'Komi',
  'Kongo',
  'Korean',
  'Kuanyama',
  'Kurdish',
  'Lao',
  'Latin',
  'Latvian',
  'Limburgish',
  'Lingala',
  'Lithuanian',
  'Luba-Katanga',
  'Luxembourgish',
  'Macedonian',
  'Malagasy',
  'Malay',
  'Malayalam',
  'Maltese',
  'Manx',
  'Maori',
  'Marathi',
  'Marshallese',
  'Mongolian',
  'Nauru',
  'Navajo',
  'Ndonga',
  'Nepali',
  'North Ndebele',
  'Northern Sami',
  'Norwegian',
  'Norwegian Bokmal',
  'Norwegian Nynorsk',
  'Occitan',
  'Ojibwa',
  'Oriya',
  'Oromo',
  'Ossetian',
  'Pali',
  'Pashto',
  'Persian',
  'Polish',
  'Portuguese',
  'Punjabi',
  'Quechua',
  'Romanian',
  'Romansh',
  'Rundi',
  'Russian',
  'Samoan',
  'Sango',
  'Sanskrit',
  'Sardinian',
  'Serbian',
  'Shona',
  'Sichuan Yi',
  'Sindhi',
  'Sinhala',
  'Slovak',
  'Slovenian',
  'Somali',
  'South Ndebele',
  'Southern Sotho',
  'Spanish',
  'Sundanese',
  'Swahili',
  'Swati',
  'Swedish',
  'Tagalog',
  'Tahitian',
  'Tajik',
  'Tamil',
  'Tatar',
  'Telugu',
  'Thai',
  'Tibetan',
  'Tigrinya',
  'Tonga',
  'Tsonga',
  'Tswana',
  'Turkish',
  'Turkmen',
  'Twi',
  'Uighur',
  'Ukrainian',
  'Urdu',
  'Uzbek',
  'Venda',
  'Vietnamese',
  'Volapuk',
  'Walloon',
  'Welsh',
  'Western Frisian',
  'Wolof',
  'Xhosa',
  'Yiddish',
  'Yoruba',
  'Zhuang',
  'Zulu',
];

/** The text a save sends for a set of ticks. */
export const joinLanguages = (selected: readonly string[]): string => selected.join(', ');

/** Stored text -> ticks: each value takes the list's spelling when it matches case-insensitively, else stays as stored. */
export const selectedLanguages = (text: string | null | undefined): string[] => {
  const byKey = new Map(LANGUAGES.map((n) => [n.toLowerCase(), n]));
  return parseLanguages(text ?? '').map((v) => byKey.get(v.toLowerCase()) ?? v);
};

/** Tick or untick one language; returns the new draft text. */
export const toggleLanguage = (text: string, name: string): string => {
  const cur = selectedLanguages(text);
  const k = name.toLowerCase();
  return joinLanguages(cur.some((c) => c.toLowerCase() === k) ? cur.filter((c) => c.toLowerCase() !== k) : [...cur, name]);
};

/** Case-insensitive filter as you type; blank query = whole list. */
export const filterLanguages = (query: string, list: readonly string[] = LANGUAGES): string[] => {
  const q = query.trim().toLowerCase();
  return q === '' ? [...list] : list.filter((n) => n.toLowerCase().includes(q));
};

/** Letter groups (A-Z) for the rows shown; a name that starts with a non-letter goes under '#'. */
export const groupByInitial = (names: readonly string[]): Array<{ letter: string; names: string[] }> => {
  const out: Array<{ letter: string; names: string[] }> = [];
  for (const n of names) {
    const c = n.charAt(0).toUpperCase();
    const letter = c >= 'A' && c <= 'Z' ? c : '#';
    const last = out[out.length - 1];
    if (last && last.letter === letter) last.names.push(n);
    else out.push({ letter, names: [n] });
  }
  return out;
};
