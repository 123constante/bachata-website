import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, GraduationCap, Instagram, Globe, Mail, Phone,
  Users, User, Calendar, Languages, Sparkles, Trophy, BookOpen,
  MessageCircle, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import ProfileEventTimeline from '@/components/profile/ProfileEventTimeline';
import { getPublicName } from '@/lib/name-utils';
import { useCity } from '@/contexts/CityContext';

type TeacherRow = {
  id: string;
  first_name: string | null;
  surname: string | null;
  hide_surname: boolean | null;
  photo_url: string | null;
  teaching_styles: string[] | null;
  years_teaching: number | null;
  offers_group: boolean | null;
  offers_private: boolean | null;
  private_lesson_types: string[] | null;
  private_lesson_locations: string[] | null;
  private_travel_distance: number | null;
  travel_willingness: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  public_email: string | null;
  phone: string | null;
  nationality: string | null;
  languages: string[] | null;
  achievements: string[] | null;
  availability: string | null;
  faq: string | null;
  journey: string | null;
  gallery_urls: string[] | null;
  person_entity_id: string | null;
  city: { name: string } | null;
};

/* ── helpers ─────────────────────────────────────────── */

const getInstagramHandle = (raw: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('@')) return trimmed;
  try {
    const url = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    );
    const seg = url.pathname.split('/').filter(Boolean)[0];
    return seg ? `@${seg}` : '@instagram';
  } catch {
    return '@instagram';
  }
};

const normalizeUrl = (raw: string | null, prefix = 'https://') => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('http') ? trimmed : `${prefix}${trimmed}`;
};

const getInstagramUrl = (raw: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http')) return trimmed;
  const handle = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return `https://instagram.com/${handle}`;
};

const getExperienceLevel = (years: number) => {
  if (years >= 10) return { label: 'Master', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  if (years >= 6) return { label: 'Senior', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
  if (years >= 3) return { label: 'Experienced', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
  return { label: 'Rising', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
};

/* ── animation variants ──────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 },
};

/* ── component ───────────────────────────────────────── */

const TeacherProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const classesPath = citySlug ? `/${citySlug}/classes` : '/classes';

  const { data: teacher, isLoading, error } = useQuery({
    queryKey: ['teacher-profile', id],
    queryFn: async () => {
      if (!id) throw new Error('Teacher ID is required');
      
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select('id, first_name, surname, hide_surname, photo_url, teaching_styles, years_teaching, offers_group, offers_private, private_lesson_types, private_lesson_locations, private_travel_distance, travel_willingness, instagram, facebook, website, public_email, phone, nationality, languages, achievements, availability, faq, journey, gallery_urls, person_entity_id, city:cities!city_id(name)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Teacher not found');
      return data as unknown as TeacherRow;
    },
    enabled: !!id,
  });

  /* ── loading ──── */
  if (isLoading) {
    return (
      <div className="min-h-screen pt-[100px] px-4 pb-24">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="col-span-2 row-span-2 h-[340px] rounded-xl" />
            <Skeleton className="h-[160px] rounded-xl" />
            <Skeleton className="h-[160px] rounded-xl" />
            <Skeleton className="h-[160px] rounded-xl" />
            <Skeleton className="h-[160px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  /* ── error / not found ──── */
  if (error || !teacher) {
    console.error('TeacherProfile error:', { error, teacher, id });
    return (
      <div className="min-h-screen pt-[100px] px-4 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <GraduationCap className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Teacher Not Found</h1>
          <p className="text-muted-foreground mb-2">{error?.message ?? 'The teacher profile you\'re looking for doesn\'t exist.'}</p>
          {id && <p className="text-xs text-muted-foreground mb-6">ID: {id}</p>}
          <Button onClick={() => navigate('/teachers')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Teachers
          </Button>
        </div>
      </div>
    );
  }

  /* ── derived data ──── */
  const displayName = getPublicName(teacher, 'Teacher');
  const instagramHandle = getInstagramHandle(teacher.instagram);
  const instagramUrl = getInstagramUrl(teacher.instagram);
  const websiteUrl = normalizeUrl(teacher.website);
  const hasExperience = typeof teacher.years_teaching === 'number' && teacher.years_teaching >= 0;
  const expLevel = hasExperience ? getExperienceLevel(teacher.years_teaching!) : null;
  const hasConnect = instagramUrl || teacher.facebook || websiteUrl || teacher.public_email || teacher.phone;
  const hasLessons = teacher.offers_group || teacher.offers_private;
  const hasLanguages = teacher.languages && teacher.languages.length > 0;
  const hasAchievements = teacher.achievements && teacher.achievements.length > 0;
  const hasGallery = teacher.gallery_urls && teacher.gallery_urls.length > 0;

  // Parse FAQ as lines  
  const faqLines = teacher.faq
    ? teacher.faq.split('\n').filter((l) => l.trim())
    : [];

  return (
    <div className="min-h-screen pb-24 pt-20">
      <div className="max-w-5xl mx-auto px-4">
        <PageBreadcrumb
          items={[
            { label: 'Classes', path: classesPath },
            { label: 'Teachers', path: '/teachers' },
            { label: displayName },
          ]}
        />

        {/* Back */}
        <Button onClick={() => navigate(-1)} variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* ═══ Bento Grid ═══ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[minmax(160px,auto)]"
        >
          {/* ── 1. Identity Hero (2×2) ── */}
          <motion.div variants={itemVariants} className="col-span-2 row-span-2">
            <Card className="h-full relative overflow-hidden group border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20 hover:border-primary/30">
              <div className="absolute inset-0">
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={displayName}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                    <GraduationCap className="w-24 h-24 text-primary/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              </div>
              <div className="relative h-full flex flex-col justify-end p-6 z-10">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
                    {displayName}
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-white/80 font-medium flex-wrap">
                  {teacher.city?.name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      {teacher.city.name}
                    </span>
                  )}
                  {teacher.nationality && (
                    <>
                      {teacher.city?.name && <span className="text-white/40">•</span>}
                      <span>{teacher.nationality}</span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ── 2. Teaching Experience (1×1) ── */}
          {hasExperience && expLevel && (
            <motion.div variants={itemVariants} className="col-span-1 row-span-1">
              <Card className={`h-full p-5 border-white/10 ${expLevel.bg} backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80 flex flex-col justify-between`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Experience</span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${expLevel.color} ${expLevel.border} ${expLevel.bg}`}>
                    {expLevel.label}
                  </Badge>
                </div>
                <div className="mt-auto">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black ${expLevel.color}`}>{teacher.years_teaching}</span>
                    <span className="text-sm font-medium text-muted-foreground">
                      {teacher.years_teaching === 1 ? 'Year' : 'Years'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">teaching</span>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── 3. Connect (1×1) ── */}
          <motion.div variants={itemVariants} className="col-span-1 row-span-1">
            <Card className="h-full p-5 flex flex-col border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
              <div className="mb-auto">
                <div className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Connect</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="bg-gradient-to-tr from-purple-600 to-pink-600 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="bg-zinc-700 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {teacher.public_email && (
                  <a href={`mailto:${teacher.public_email}`} className="bg-emerald-600 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                    <Mail className="w-5 h-5" />
                  </a>
                )}
                {teacher.phone && (
                  <a href={`tel:${teacher.phone}`} className="bg-blue-600 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                    <Phone className="w-5 h-5" />
                  </a>
                )}
                {!hasConnect && (
                  <div className="col-span-2 text-xs text-muted-foreground text-center py-2 italic">
                    No public contacts
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* ── 4. Lesson Types (2×1) ── */}
          {hasLessons && (
            <motion.div variants={itemVariants} className="col-span-2 row-span-1">
              <Card className="h-full p-6 border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-teal-400/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-60 transition-opacity">
                  <BookOpen className="w-12 h-12 text-teal-400" />
                </div>
                <div className="relative z-10 h-full flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-teal-400" />
                    <span className="text-sm font-bold uppercase tracking-wider text-teal-300">Lessons Offered</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {teacher.offers_group && (
                      <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                        <Users className="w-4 h-4 mr-1.5" /> Group Classes
                      </Badge>
                    )}
                    {teacher.offers_private && (
                      <Badge variant="outline" className="text-sm px-3 py-1 font-semibold border-blue-500/40 bg-blue-500/15 text-blue-300">
                        <User className="w-4 h-4 mr-1.5" /> Private Lessons
                      </Badge>
                    )}
                  </div>
                  {teacher.private_lesson_types && teacher.private_lesson_types.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Types:</span>
                      {teacher.private_lesson_types.map((t) => (
                        <span key={t} className="text-xs bg-teal-500/10 border border-teal-500/20 px-2 py-1 rounded-md text-teal-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {teacher.private_lesson_locations && teacher.private_lesson_locations.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Locations:</span>
                      {teacher.private_lesson_locations.map((loc) => (
                        <span key={loc} className="text-xs bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-md text-cyan-200">
                          {loc}
                        </span>
                      ))}
                    </div>
                  )}
                  {teacher.availability && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-semibold text-teal-300">Availability:</span> {teacher.availability}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── 5. Teaching Styles (1×1) ── */}
          {teacher.teaching_styles && teacher.teaching_styles.length > 0 && (
            <motion.div variants={itemVariants} className="col-span-1 row-span-1">
              <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-4 text-amber-500">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Styles</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teacher.teaching_styles.map((style) => (
                    <Badge key={style} variant="outline" className="bg-background/20 hover:bg-background/40 transition-colors cursor-default">
                      {style}
                    </Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── 6. Languages (1×1) ── */}
          {hasLanguages && (
            <motion.div variants={itemVariants} className="col-span-1 row-span-1">
              <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-4 text-blue-400">
                  <Languages className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Languages</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teacher.languages!.map((lang) => (
                    <Badge key={lang} variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-300">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── 7. Instagram Handle (1×1) ── */}
          {instagramUrl && instagramHandle && (
            <motion.div variants={itemVariants} className="col-span-1 row-span-1">
              <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-3 text-pink-500">
                  <Instagram className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Instagram</span>
                </div>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-semibold text-foreground hover:text-primary transition-colors break-all"
                >
                  {instagramHandle}
                </a>
              </Card>
            </motion.div>
          )}

          {/* ── 8. Website (1×1) ── */}
          {websiteUrl && (
            <motion.div variants={itemVariants} className="col-span-1 row-span-1">
              <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-3 text-teal-400">
                  <Globe className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Website</span>
                </div>
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors break-all"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  {(() => {
                    try {
                      return new URL(websiteUrl).hostname.replace('www.', '');
                    } catch {
                      return 'Visit website';
                    }
                  })()}
                </a>
              </Card>
            </motion.div>
          )}

          {/* ── 9. Achievements (1×1 or 2×1) ── */}
          {hasAchievements && (
            <motion.div variants={itemVariants} className={`${teacher.achievements!.length > 3 ? 'col-span-2' : 'col-span-2 md:col-span-1'} row-span-1`}>
              <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-3 text-yellow-500">
                  <Trophy className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Achievements</span>
                </div>
                <ul className="space-y-1.5">
                  {teacher.achievements!.map((a, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{a}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          {/* ── 10. About / Journey (full width) ── */}
          {teacher.journey && (
            <motion.div variants={itemVariants} className="col-span-2 md:col-span-4 row-span-1">
              <Card className="h-full p-6 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-3 text-primary">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">About Me</span>
                </div>
                <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{teacher.journey}</p>
              </Card>
            </motion.div>
          )}

          {/* ── 11. FAQ (full width) ── */}
          {faqLines.length > 0 && (
            <motion.div variants={itemVariants} className="col-span-2 md:col-span-4 row-span-1">
              <Card className="h-full p-6 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
                <div className="flex items-center gap-2 mb-4 text-festival-teal">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">FAQ</span>
                </div>
                <div className="space-y-2">
                  {faqLines.map((line, i) => (
                    <p key={i} className="text-sm text-foreground/90">{line}</p>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── 12. Gallery (full width) ── */}
          {hasGallery && (
            <motion.div variants={itemVariants} className="col-span-2 md:col-span-4">
              <Card className="p-6 border-white/10 bg-card/50 backdrop-blur-sm transition-all">
                <div className="flex items-center gap-2 mb-4 text-festival-pink">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Gallery</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {teacher.gallery_urls!.slice(0, 8).map((url, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ scale: 1.05 }}
                      className="aspect-square rounded-xl overflow-hidden border border-white/10"
                    >
                      <img src={url} alt={`${displayName} gallery ${i + 1}`} className="w-full h-full object-cover" />
                    </motion.div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* ═══ Event Timeline ═══ */}
        <div className="mt-8">
          <ProfileEventTimeline
            personType="teacher"
            personId={teacher.id}
            title="Event appearances"
            emptyText="No event appearances yet."
          />
        </div>
      </div>
    </div>
  );
};

export default TeacherProfile;
