import { useAllProfiles } from '@/hooks/useAllProfiles';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, Globe, Instagram } from 'lucide-react';
import GlobalLayout from '@/components/layout/GlobalLayout';

const ALL_PROFILES_BREADCRUMBS = [{ label: 'All Profiles' }];

const roleColors: Record<string, string> = {
  dancer: 'bg-pink-100 text-pink-800',
  teacher: 'bg-blue-100 text-blue-800',
  dj: 'bg-purple-100 text-purple-800',
  vendor: 'bg-orange-100 text-orange-800',
  videographer: 'bg-green-100 text-green-800',
  organiser: 'bg-yellow-100 text-yellow-800',
};

export default function AllProfiles() {
  const { data: profiles, isLoading, error } = useAllProfiles();

  if (isLoading) {
    return (
      <GlobalLayout
        breadcrumbs={ALL_PROFILES_BREADCRUMBS}
        hero={{
          emoji: '👥',
          titleWhite: 'All',
          titleOrange: 'Profiles',
          largeTitle: true,
        }}
      >
        <div className="px-4 pb-24 flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading all profiles...</p>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (error) {
    return (
      <GlobalLayout
        breadcrumbs={ALL_PROFILES_BREADCRUMBS}
        hero={{
          emoji: '👥',
          titleWhite: 'All',
          titleOrange: 'Profiles',
          largeTitle: true,
        }}
      >
        <div className="px-4 pb-24 flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <p className="text-red-600 font-semibold">Error loading profiles</p>
            <p className="text-muted-foreground mt-2">{error.message}</p>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <GlobalLayout
        breadcrumbs={ALL_PROFILES_BREADCRUMBS}
        hero={{
          emoji: '👥',
          titleWhite: 'All',
          titleOrange: 'Profiles',
          largeTitle: true,
        }}
      >
        <div className="px-4 pb-24 flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground">No profiles found</p>
        </div>
      </GlobalLayout>
    );
  }

  // Group by role
  const grouped = profiles.reduce(
    (acc, profile) => {
      if (!acc[profile.role]) acc[profile.role] = [];
      acc[profile.role].push(profile);
      return acc;
    },
    {} as Record<string, typeof profiles>
  );

  return (
    <GlobalLayout
      breadcrumbs={ALL_PROFILES_BREADCRUMBS}
      hero={{
        emoji: '👥',
        titleWhite: 'All',
        titleOrange: 'Profiles',
        subtitle: `${profiles.length} profiles across ${Object.keys(grouped).length} roles`,
        largeTitle: true,
      }}
    >
      <div className="px-4 pb-24 space-y-16">
      {/* Sections by role */}
      {Object.entries(grouped).map(([role, roleProfiles]) => (
        <div key={role} className="space-y-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold capitalize mb-4">
              {role}s ({roleProfiles.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roleProfiles.map((profile) => (
                <Card
                  key={`${profile.role}-${profile.profile_id}`}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg line-clamp-2">
                          {profile.display_name || '(No name)'}
                        </h3>
                        <Badge
                          className={`mt-2 ${roleColors[profile.role] || 'bg-gray-100'}`}
                          variant="secondary"
                        >
                          {profile.role}
                        </Badge>
                      </div>
                      {profile.is_verified && (
                        <div className="text-blue-600 text-sm font-semibold">✓ Verified</div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Photo */}
                    {profile.photo_url && (
                      <img
                        src={profile.photo_url}
                        alt={profile.display_name}
                        className="w-full h-40 object-cover rounded"
                      />
                    )}

                    {/* Location */}
                    {profile.city_name && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {profile.city_name}
                        {profile.country_code && ` (${profile.country_code})`}
                      </div>
                    )}

                    {/* Bio */}
                    {profile.bio && <p className="text-sm text-muted-foreground line-clamp-3">{profile.bio}</p>}

                    {/* Specialties */}
                    {profile.specialties && profile.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {profile.specialties.slice(0, 3).map((spec, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                        {profile.specialties.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{profile.specialties.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Contact links */}
                    <div className="flex gap-2 pt-2">
                      {profile.instagram && (
                        <a
                          href={`https://instagram.com/${profile.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          title="Instagram"
                        >
                          <Instagram className="w-4 h-4" />
                        </a>
                      )}
                      {profile.website && (
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          title="Website"
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ))}
      </div>
    </GlobalLayout>
  );
}
