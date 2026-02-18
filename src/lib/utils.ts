import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPhotoUrl(photoUrl: unknown): string | null {
  if (!photoUrl) return null;

  if (Array.isArray(photoUrl)) {
    return photoUrl.length > 0 && typeof photoUrl[0] === 'string' ? photoUrl[0] : null;
  }

  if (typeof photoUrl !== 'string') return null;

  // If it's a JSON array string, parse it and get the first URL
  if (photoUrl.startsWith('[')) {
    try {
      const urls = JSON.parse(photoUrl);
      return Array.isArray(urls) && urls.length > 0 ? urls[0] : null;
    } catch {
      return null;
    }
  }

  // Otherwise, treat it as a plain URL
  return photoUrl;
}

// Helper to get country code from nationality value (handles various formats)
export function getNationalityCode(nationality: string | null): string | null {
  if (!nationality) return null;
  const normalized = nationality.toLowerCase().trim();
  
  // Common nationality name to ISO code mappings
  const nationalityMap: Record<string, string> = {
    // Full country names
    'united kingdom': 'gb', 'uk': 'gb', 'britain': 'gb', 'great britain': 'gb', 'england': 'gb',
    'united states': 'us', 'usa': 'us', 'america': 'us', 'united states of america': 'us',
    'spain': 'es', 'spanish': 'es', 'españa': 'es',
    'france': 'fr', 'french': 'fr',
    'germany': 'de', 'german': 'de', 'deutschland': 'de',
    'italy': 'it', 'italian': 'it', 'italia': 'it',
    'brazil': 'br', 'brazilian': 'br', 'brasil': 'br',
    'portugal': 'pt', 'portuguese': 'pt',
    'mexico': 'mx', 'mexican': 'mx', 'méxico': 'mx',
    'colombia': 'co', 'colombian': 'co',
    'argentina': 'ar', 'argentinian': 'ar', 'argentine': 'ar',
    'dominican republic': 'do', 'dominican': 'do',
    'cuba': 'cu', 'cuban': 'cu',
    'puerto rico': 'pr', 'puerto rican': 'pr',
    'venezuela': 've', 'venezuelan': 've',
    'chile': 'cl', 'chilean': 'cl',
    'peru': 'pe', 'peruvian': 'pe',
    'ecuador': 'ec', 'ecuadorian': 'ec',
    'netherlands': 'nl', 'dutch': 'nl', 'holland': 'nl',
    'belgium': 'be', 'belgian': 'be',
    'poland': 'pl', 'polish': 'pl',
    'russia': 'ru', 'russian': 'ru',
    'ukraine': 'ua', 'ukrainian': 'ua',
    'canada': 'ca', 'canadian': 'ca',
    'australia': 'au', 'australian': 'au',
    'japan': 'jp', 'japanese': 'jp',
    'china': 'cn', 'chinese': 'cn',
    'south korea': 'kr', 'korean': 'kr', 'korea': 'kr',
    'india': 'in', 'indian': 'in',
    'philippines': 'ph', 'filipino': 'ph', 'filipina': 'ph',
    'vietnam': 'vn', 'vietnamese': 'vn',
    'thailand': 'th', 'thai': 'th',
    'indonesia': 'id', 'indonesian': 'id',
    'malaysia': 'my', 'malaysian': 'my',
    'singapore': 'sg', 'singaporean': 'sg',
    'ireland': 'ie', 'irish': 'ie',
    'scotland': 'gb-sct', 'scottish': 'gb-sct',
    'wales': 'gb-wls', 'welsh': 'gb-wls',
    'sweden': 'se', 'swedish': 'se',
    'norway': 'no', 'norwegian': 'no',
    'denmark': 'dk', 'danish': 'dk',
    'finland': 'fi', 'finnish': 'fi',
    'austria': 'at', 'austrian': 'at',
    'switzerland': 'ch', 'swiss': 'ch',
    'greece': 'gr', 'greek': 'gr',
    'turkey': 'tr', 'turkish': 'tr',
    'egypt': 'eg', 'egyptian': 'eg',
    'south africa': 'za', 'south african': 'za',
    'nigeria': 'ng', 'nigerian': 'ng',
    'kenya': 'ke', 'kenyan': 'ke',
    'morocco': 'ma', 'moroccan': 'ma',
    'israel': 'il', 'israeli': 'il',
    'lebanon': 'lb', 'lebanese': 'lb',
    'saudi arabia': 'sa', 'saudi': 'sa',
    'united arab emirates': 'ae', 'uae': 'ae', 'emirati': 'ae',
    'new zealand': 'nz', 'kiwi': 'nz',
    'czech republic': 'cz', 'czech': 'cz', 'czechia': 'cz',
    'hungary': 'hu', 'hungarian': 'hu',
    'romania': 'ro', 'romanian': 'ro',
    'bulgaria': 'bg', 'bulgarian': 'bg',
    'croatia': 'hr', 'croatian': 'hr',
    'serbia': 'rs', 'serbian': 'rs',
    'slovakia': 'sk', 'slovak': 'sk',
    'slovenia': 'si', 'slovenian': 'si',
    'latvia': 'lv', 'latvian': 'lv',
    'lithuania': 'lt', 'lithuanian': 'lt',
    'estonia': 'ee', 'estonian': 'ee',
    'iceland': 'is', 'icelandic': 'is',
    'luxembourg': 'lu', 'luxembourgish': 'lu',
    'malta': 'mt', 'maltese': 'mt',
    'cyprus': 'cy', 'cypriot': 'cy',
    'panama': 'pa', 'panamanian': 'pa',
    'costa rica': 'cr', 'costa rican': 'cr',
    'honduras': 'hn', 'honduran': 'hn',
    'el salvador': 'sv', 'salvadoran': 'sv',
    'guatemala': 'gt', 'guatemalan': 'gt',
    'nicaragua': 'ni', 'nicaraguan': 'ni',
    'bolivia': 'bo', 'bolivian': 'bo',
    'paraguay': 'py', 'paraguayan': 'py',
    'uruguay': 'uy', 'uruguayan': 'uy',
    'jamaica': 'jm', 'jamaican': 'jm',
    'trinidad and tobago': 'tt', 'trinidadian': 'tt',
    'barbados': 'bb', 'barbadian': 'bb', 'bajan': 'bb',
    'bahamas': 'bs', 'bahamian': 'bs',
    'haiti': 'ht', 'haitian': 'ht',
  };
  
  // Check if it's in the map
  if (nationalityMap[normalized]) {
    return nationalityMap[normalized];
  }
  
  // If it's already a 2-letter code, return it
  if (normalized.length === 2) {
    return normalized;
  }
  
  return null;
}

export function resolveEventImage(photoUrl: string[] | string | null | undefined, coverImageUrl: string | null | undefined): string | null {
  let candidate: string | null = null;

  if (Array.isArray(photoUrl)) {
    candidate = photoUrl.length > 0 ? photoUrl[0] : null;
  } else if (typeof photoUrl === 'string') {
    candidate = photoUrl;
  }

  // Handle double-encoded JSON strings (e.g. '["url"]') which sometimes happens
  if (candidate && candidate.startsWith('[')) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) {
        candidate = parsed[0];
      }
    } catch {
      // Ignore parse error, use original string
    }
  }

  if (!candidate && coverImageUrl) {
    candidate = coverImageUrl;
  }

  if (!candidate) return null;
  
  // Clean candidate
  candidate = candidate.trim();
  if (candidate === 'null' || candidate === 'undefined') return null;

  if (candidate.startsWith('http')) {
    return candidate;
  }

  // Add Supabase URL logic
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const baseUrl = supabaseUrl.replace(/\/$/, ''); // Remove trailing slash
  let cleanCandidate = candidate.startsWith('/') ? candidate.substring(1) : candidate;
  if (cleanCandidate.startsWith('events/')) {
    cleanCandidate = cleanCandidate.replace(/^events\//, '');
  }
  
  return `${baseUrl}/storage/v1/object/public/events/${cleanCandidate}`;
}

type PhotoInput = string | string[] | null | undefined;
const partnerDetailKeys = ['text', 'details', 'notes', 'value', 'description'];

export function normalizePhotoValue(photoUrl: PhotoInput): string {
  return getPhotoUrl(photoUrl) || '';
}

export function serializePhotoValue(photoUrl: PhotoInput): string[] | null {
  if (!photoUrl) return null;

  if (Array.isArray(photoUrl)) {
    const cleaned = photoUrl.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return cleaned.length ? cleaned : null;
  }

  if (typeof photoUrl !== 'string') return null;

  const trimmed = photoUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        return cleaned.length ? cleaned : null;
      }
    } catch {
      // Fall through to wrapping trimmed value
    }
  }

  return [trimmed];
}

export type PartnerDetailsValue = Record<string, unknown> | string | null | undefined;

export function parsePartnerDetails(value: PartnerDetailsValue): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    for (const key of partnerDetailKeys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return '';
}

export function serializePartnerDetails(value: PartnerDetailsValue): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? { text: trimmed } : null;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length ? value : null;
  }

  return null;
}
