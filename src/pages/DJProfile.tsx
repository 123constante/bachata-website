import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Music, Instagram, Globe, Mail, ExternalLink,
  Disc3, Youtube, Mic2, CheckCircle2, DollarSign, BookOpen, Image,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalLayout from '@/components/layout/GlobalLayout';
import ProfileEventTimeline from '@/components/profile/ProfileEventTimeline';
import { buildFullName } from '@/lib/name-utils';

type DJRow = {
  id: string;
  dj_name: string | null;
  first_name: string | null;
  surname: string | null;
  hide_real_name: boolean | null;
  photo_url: string | string[] | null;
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
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('DJ not found');
      return data as unknown as DJRow;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const djBreadcrumbs = [{ label: 'DJs', path: '/djs' }];

  if (isLoading) {
    return (
      <GlobalLayout
        breadcrumbs={djBreadcrumbs}
        backHref="/djs"
        hero={{
          emoji: '🎧',
          titleWhite: '',
          titleOrange: 'DJ',
          largeTitle: true,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 pb-24 space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </GlobalLayout>
    );
  }

  if (error || !dj) {
    return (
      <GlobalLayout
        breadcrumbs={djBreadcrumbs}
        backHref="/djs"
        hero={{
          emoji: '🎧',
          titleWhite: 'DJ',
          titleOrange: 'not found',
          largeTitle: true,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 pb-24 flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-6">This DJ profile doesn't exist or has been removed.</p>
            <Button onClick={() => navigate('/djs')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to DJs
            </Button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  const displayName = dj.dj_name || buildFullName(dj.first_name, dj.surname) || 'DJ';
  const realName = (!dj.hide_real_name && (dj.first_name || dj.surname))
    ? buildFullName(dj.first_name, dj.surname)
    : null;
  const cityName = dj.cities?.name || dj.city;
  const coverPhoto = Array.isArray(dj.photo_url)
    ? (dj.photo_url[0] ?? null)
    : (dj.photo_url ?? null);
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

  const djSubtitle = [cityName, dj.nationality].filter(Boolean).join(' · ');

  return (
    <GlobalLayout
      breadcrumbs={djBreadcrumbs}
      backHref="/djs"
      hero={{
        emoji: '🎧',
        titleWhite: displayName,
        titleOrange: 'DJ',
        subtitle: djSubtitle,
        largeTitle: true,
      }}
    >
      <motion.div
        className="max-w-4xl mx-auto px-4 pb-24 pt-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* ── Supporting identity (verified, real name, genres) — name, city,
            nationality now live in the hero. ── */}
        {(realName && realName !== displayName) || dj.verified || genres.length > 0 ? (
          <motion.div variants={itemVariants} className="mb-6 flex flex-wrap items-center gap-3">
            {dj.verified && (
              <span className="inline-flex items-center gap-1 text-sm text-primary">
                <CheckCircle2 className="w-4 h-4" />
                Verified
              </span>
            )}
            {realName && realName !== displayName && (
              <span className="text-sm text-muted-foreground">{realName}</span>
            )}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <Badge key={g} variant="outline" className="border-primary/30 text-primary text-xs">
                    {g}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>
        ) : null}

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
    </GlobalLayout>
  );
};

export default DJProfile;
