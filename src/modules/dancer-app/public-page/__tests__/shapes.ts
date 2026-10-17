import type { PublicPageExtras } from '../model';

// Prod-shaped public dancer rows (survey 2026-10-17, counts only: 157 live, 53 photoless,
// 152 admin-made unclaimed, 2 nameless, 12 with languages, max 2 languages, 0 bios,
// 0 public WhatsApp, 1 gallery). Names are invented; rows are what the loader's
// DANCER_PUBLIC_COLS read + get_public_dancer_names_v1 merge hand to the page.
const IMG = 'https://cdn.example.test/p.jpg';

const rec = (over: Record<string, unknown>) => ({
  id: 'id-x', first_name: null, surname: null, display_name: null, nationality: null, dance_role: null, instagram: null, facebook: null,
  avatar_url: null, website_url: null, gallery_urls: null as string[] | null, cities: null, dancing_role_details: null, ...over,
});

export const SHAPES = {
  photoless: rec({ id: 'id-1', first_name: 'Dani', display_name: 'Dani' }),
  'long name': rec({ id: 'id-2', first_name: 'Maria-Fernanda', display_name: 'Maria-Fernanda Alejandra de los Santos', avatar_url: IMG, cities: { name: 'London' } }),
  'surname hidden': rec({ id: 'id-3', first_name: 'Fay', surname: null, display_name: 'Fay', avatar_url: IMG }),
  nameless: rec({ id: 'id-4' }),
  'admin-made unclaimed': rec({ id: 'id-5', first_name: 'Eli', display_name: 'Eli Gomez', avatar_url: IMG }),
  'complete + all extras': rec({
    id: 'id-6', first_name: 'Carla', surname: 'Ruiz', display_name: 'Carla Ruiz', nationality: 'Spain', dance_role: 'Lead and Follow',
    instagram: '@carla', facebook: 'carla.ruiz', website_url: 'carla.example', avatar_url: IMG, cities: { name: 'Manchester' },
    gallery_urls: [IMG, IMG],
    dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual', 'Dominican'], achievements: ['Best newcomer 2022'], favorite_songs: ['Obsesion'], looking_for_partner: true, partner_search_role: 'Leader', partner_search_level: ['Intermediate'], partner_practice_goals: ['Footwork'], partner_details: 'Weekday evenings' },
  }),
} as const;

export type ShapeKey = keyof typeof SHAPES;

export const EXTRAS: Record<'full' | 'manyLanguages', PublicPageExtras> = {
  full: { bio: 'I dance every Friday.', languages: ['English', 'Spanish'], whatsapp: '+44 7700 900123' },
  manyLanguages: { bio: null, languages: ['English', 'Spanish', ' ', 'Portuguese', 'French', 'Italian', 'Polish'], whatsapp: null },
};
