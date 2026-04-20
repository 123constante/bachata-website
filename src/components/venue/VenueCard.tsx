import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Layers, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PublicVenueListItem } from '@/services/venuePublicService';

type AmenityPill = { key: string; emoji: string; label: string };

const buildAmenities = (venue: PublicVenueListItem): AmenityPill[] => {
  const out: AmenityPill[] = [];
  const facilities = venue.facilities_new ?? [];
  if (facilities.includes('wood_floor')) {
    out.push({ key: 'wood_floor', emoji: '🪵', label: 'Wood floor' });
  }
  if (facilities.includes('air_conditioning')) {
    out.push({ key: 'air_conditioning', emoji: '❄️', label: 'AC' });
  }
  if (facilities.includes('mirrors')) {
    out.push({ key: 'mirrors', emoji: '🪞', label: 'Mirrors' });
  }
  if (venue.cloakroom_available) {
    out.push({ key: 'cloakroom', emoji: '🧥', label: 'Cloakroom' });
  }
  return out;
};

const looksLikeRawUrl = (s: string): boolean => {
  const trimmed = s.trimStart();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return !/\s/.test(trimmed.slice(0, 50));
};

export const VenueCard = ({ venue }: { venue: PublicVenueListItem }) => {
  const amenities = buildAmenities(venue);
  const description =
    venue.description && !looksLikeRawUrl(venue.description) ? venue.description : null;

  return (
    <Link to={`/venue-entity/${venue.id}`} className="block group h-full">
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="h-full bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-colors"
      >
        <div className="aspect-[4/3] bg-muted/20 relative overflow-hidden">
          {venue.cover_image ? (
            <img
              src={venue.cover_image}
              alt={venue.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20">
              <Building2 className="w-8 h-8 text-primary/40" />
            </div>
          )}
        </div>

        <div className="p-3 space-y-1.5">
          <h3 className="text-sm font-semibold tracking-normal truncate group-hover:text-primary transition-colors">
            {venue.name}
          </h3>

          {(venue.city_name || venue.capacity) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {venue.city_name && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {venue.city_name}
                </span>
              )}
              {venue.capacity && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {venue.capacity}
                </span>
              )}
            </div>
          )}

          {venue.floor_type && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-primary/25 text-primary/70"
            >
              <Layers className="w-2.5 h-2.5 mr-1" />
              {venue.floor_type}
            </Badge>
          )}

          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {amenities.map(({ key, emoji, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <span aria-hidden="true">{emoji}</span>
                  {label}
                </span>
              ))}
            </div>
          )}

          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </motion.div>
    </Link>
  );
};

export default VenueCard;
