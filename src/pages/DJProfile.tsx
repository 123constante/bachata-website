import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Music, Instagram, Globe, Mail, ExternalLink,
  Disc3, Youtube, Mic2, CheckCircle2, DollarSign, BookOpen, Image,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import ProfileEventTimeline from '@/components/profile/ProfileEventTimeline';
import { buildFullName } from '@/lib/name-utils';

type DJRow = {
  id: string;
  dj_name: string | null;
  first_name: string | null;
  surname: string | null;
  hide_real_name: boolean | null;
  photo_url: string[] | null;
  bio: string | null;
  genres: string[] | null;
  nationality: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  soundcloud: string | null;
  youtube_url: string | null;
  youtube: string | null;
  mixcloud: string | null;
  public_email: string | null;
  booking_email: string | null;
  sample_mix_urls: string[] | null;
  gallery_urls: string[] | null;
  faq: string | null;
  pricing: string | null;
  verified: boolean | null;
  city: string | null;
  cities?: { name: string } | null;
};

const normalizeUrl = (raw: string | null) => {
  if (!raw?.trim()) return null;
  return raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`;
};

const getInstagramHandle = (raw: string | null) => {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (t.startsWith('@')) return t;
  try {
    const u = new URL(t.startsWith('http') ? t : `https://${t}`);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg ? `@${seg}` : '@dj';
  } catch { return '@dj'; }
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const DJProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: dj, isLoading, error } = useQuery({
    queryKey: ['dj-profile', id],
    queryFn: async () => {
      if (!id) throw new Error('DJ ID is required');
      const { data, error } = await supabase
        .from('dj_profiles')
        .select('*, cities!city_id(name)')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('DJ not found');
      return data as unknown as DJRow;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 pt-20">
        <div className="max-w-4xl mx-auto px-4 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-5 mt-6">
            <Skeleton className="h-28 w-28 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2 pt-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !dj) {
    return (
      <div className="min-h-screen pb-24 pt-20 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🎧</div>
          <h1 className="text-2xl font-bold mb-2">DJ Not Found</h1>
          <p className="text-muted-foreground mb-6">This DJ profile doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/djs')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to DJs
          </Button>
        </div>
      </div>
    );
  }

  const displayName = dj.dj_name || buildFullName(dj.first_name, dj.surname) || 'DJ';
  const realName = (!dj.hide_real_name && (dj.first_name || dj.surname))
    ? buildFullName(dj.first_name, dj.surname)
    : null;
  const cityName = dj.cities?.name || dj.city;
  const coverPhoto = Array.isArray(dj.photo_url) && dj.photo_url.length > 0 ? dj.photo_url[0] : null;
  const genres = Array.isArray(dj.genres) ? dj.genres.filter(Boolean) : [];
  const galleryUrls = Array.isArray(dj.gallery_urls) ? dj.gallery_urls.filter(Boolean) : [];
  const sampleMixes = Array.isArray(dj.sample_mix_urls) ? dj.sample_mix_urls.filter(Boolean) : [];

  const socialLinks = [
    dj.instagram && { label: 'Instagram', handle: getInstagramHandle(dj.instagram), url: normalizeUrl(dj.instagram), icon: Instagram, color: 'text-pink-400' },
    dj.website && { label: 'Website', handle: dj.website.replace(/^https?:\/\//, '').split('/')[0], url: normalizeUrl(dj.website), icon: Globe, color: 'text-blue-400' },
    dj.soundcloud && { label: 'SoundCloud', handle: 'SoundCloud', url: normalizeUrl(dj.soundcloud), icon: Music, color: 'text-orange-400' },
    (dj.youtube_url || dj.youtube) && { label: 'YouTube', handle: 'YouTube', url: normalizeUrl(dj.youtube_url || dj.youtube), icon: Youtube, color: 'text-red-400' },
    dj.mixcloud && { label: 'Mixcloud', handle: 'Mixcloud', url: normalizeUrl(dj.mixcloud), icon: Disc3, color: 'text-purple-400' },
    dj.facebook && { label: 'Facebook', handle: 'Facebook', url: normalizeUrl(dj.facebook), icon: Globe, color: 'text-blue-500' },
  ].filter(Boolean) as { label: string; handle: string; url: string; icon: any; color: string }[];

  const contactLinks = [
    dj.booking_email && { label: 'Booking', value: dj.booking_email, url: `mailto:${dj.booking_email}`, icon: Mail },
    dj.public_email && { label: 'Contact', value: dj.public_email, url: `mailto:${dj.public_email}`, icon: Mail },
  ].filter(Boolean) as { label: string; value: string; url: string; icon: any }[];

  return (
    <div className="min-h-screen pb-24 pt-20">
      <PageBreadcrumb items={[
        { label: 'DJs', path: '/djs' },
        { label: displayName },
      ]} />

      <motion.div
        className="max-w-4xl mx-auto px-4 pt-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <Button variant="ghost" onClick={() => navigate('/djs')} className="mb-6 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to DJs
        </Button>

        {/* ── Hero ── */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-5 mb-8">
          <Avatar className="w-28 h-28 rounded-2xl border border-primary/20 shrink-0 self-start">
            <AvatarImage src={coverPhoto || undefined} alt={displayName} className="object-cover" />
            <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-4xl font-black">
              {displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-3xl font-black tracking-tight text-foreground">{displayName}</h1>
              {dj.verified && (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              )}
            </div>
            {realName && realName !== displayName && (
              <p className="text-sm text-muted-foreground mb-1">{realName}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {cityName && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {cityName}
                </span>
              )}
              {dj.nationality && (
                <span className="flex items-center gap-1">
                  <span>🌍</span> {dj.nationality}
                </span>
              )}
            </div>
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {genres.map((g) => (
                  <Badge key={g} variant="outline" className="border-primary/30 text-primary text-xs">
                    {g}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Bio ── */}
        {dj.bio && (
          <motion.div variants={itemVariants}>
            <Card className="mb-4 p-5 bg-card border-border/50">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{dj.bio}</p>
            </Card>
          </motion.div>
        )}

        {/* ── Socials grid ── */}
        {socialLinks.length > 0 && (
          <motion.div variants={itemVariants} className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                >
                  <link.icon className={`w-4 h-4 shrink-0 ${link.color}`} />
                  <span className="truncate text-muted-foreground group-hover:text-foreground">
                    {link.handle}
                  </span>
                  <ExternalLink className="w-3 h-3 ml-auto shrink-0 text-muted-foreground/50" />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Contact / Booking ── */}
        {contactLinks.length > 0 && (
          <motion.div variants={itemVariants} className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {contactLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                >
                  <link.icon className="w-4 h-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{link.label}</p>
                    <p className="truncate text-foreground text-xs font-medium">{link.value}</p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Sample mixes ── */}
        {sampleMixes.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="mb-4 p-5 bg-card border-border/50">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-primary" /> Mixes
              </h2>
              <div className="space-y-2">
                {sampleMixes.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{url.replace(/^https?:\/\//, '')}</span>
                  </a>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Pricing ── */}
        {dj.pricing && (
          <motion.div variants={itemVariants}>
            <Card className="mb-4 p-5 bg-card border-border/50">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Pricing
              </h2>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{dj.pricing}</p>
            </Card>
          </motion.div>
        )}

        {/* ── FAQ ── */}
        {dj.faq && (
          <motion.div variants={itemVariants}>
            <Card className="mb-4 p-5 bg-card border-border/50">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> FAQ
              </h2>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{dj.faq}</p>
            </Card>
          </motion.div>
        )}

        {/* ── Gallery ── */}
        {galleryUrls.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="mb-4 p-5 bg-card border-border/50">
              <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                <Image className="w-4 h-4 text-primary" /> Gallery
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {galleryUrls.slice(0, 9).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`${displayName} photo ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Event appearances ── */}
        <motion.div variants={itemVariants}>
          <ProfileEventTimeline
            personType="dj"
            personId={id}
            title="Event appearances"
            emptyText="No event appearances yet."
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default DJProfile;
