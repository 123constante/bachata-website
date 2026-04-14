import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const toConnectionBadge = (value: string | null | undefined) => {
  if (!value) return 'Connected';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

type ProfileSectionProps = {
  title: string;
  profiles: Array<Record<string, unknown>>;
  roleLabel: string;
  onProfileClick?: (personType: string, personId: string) => void;
};

const ProfileSection = ({ title, profiles, roleLabel, onProfileClick }: ProfileSectionProps) => {
  if (!profiles.length) return null;

  const getProfileKey = (person: Record<string, unknown>) => {
    const personId = (person.person_id as string) || (person.id as string) || 'unknown';
    const personType = (person.person_type as string) || roleLabel;
    return `${personType}:${personId}`;
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/80">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {profiles.map((person) => {
          const roleBadges = Array.isArray(person.roleBadges) ? (person.roleBadges as string[]) : [];

          return (
            <button
              key={getProfileKey(person)}
              type="button"
              onClick={() => {
                const personType = (person.person_type as string) || roleLabel;
                const personId = (person.person_id as string) || (person.id as string) || '';
                if (!personId) return;
                onProfileClick?.(personType, personId);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/50 px-2.5 py-1 text-left text-xs text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:bg-muted/40 hover:border-amber-400/40 hover:shadow-md hover:shadow-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <Avatar className="h-6 w-6 border border-border">
                <AvatarImage src={(person.avatar_url as string) || undefined} alt={(person.display_name as string) || roleLabel} />
                <AvatarFallback className="bg-muted text-foreground">
                  {((person.display_name as string) || roleLabel).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate">{(person.display_name as string) || roleLabel}</span>
              {roleBadges.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  {roleBadges.map((badge) => (
                    <Badge key={badge} variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground">
                      {badge}
                    </Badge>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProfileSection;
