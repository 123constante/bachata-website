export type ProfileRole = 'dancer' | 'teacher' | 'dj' | 'vendor' | 'videographer' | 'organiser';

export interface UnifiedProfile {
  profile_id: string;
  role: ProfileRole;
  display_name: string;
  photo_url: string | null;
  city_id: string | null;
  city_name: string | null;
  country_code: string | null;
  specialties: string[];
  bio: string | null;
  nationality: string | null;
  instagram: string | null;
  website: string | null;
  is_verified: boolean;
  is_active: boolean;
  person_entity_id: string | null;
}
