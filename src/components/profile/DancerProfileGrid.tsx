import { type DancerPublicViewModel } from "@/modules/profile/dancerPublicProfile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Instagram, Facebook, Globe, Mail, MapPin, 
  User, Calendar, Music, Heart, Disc, Sparkles, CheckCircle2, Trophy 
} from "lucide-react";
import ProfileEventTimeline from "@/components/profile/ProfileEventTimeline";
import { useFestivalEvents } from "@/hooks/useFestivalEvents";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { calculateDuration } from "@/components/profile/ExperiencePicker";

interface DancerProfileGridProps {
  dancer: DancerPublicViewModel;
}

export const DancerProfileGrid = ({ dancer }: DancerProfileGridProps) => {
  const navigate = useNavigate();
  const { festivalMap } = useFestivalEvents();
  const getInstagramHandle = (instagramUrl: string | null) => {
    if (!instagramUrl) return null;

    const trimmed = instagramUrl.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("@")) {
      return trimmed;
    }

    try {
      const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
      const url = new URL(normalized);
      const firstPathSegment = url.pathname.split("/").filter(Boolean)[0];
      return firstPathSegment ? `@${firstPathSegment}` : "@instagram";
    } catch {
      return "@instagram";
    }
  };

  const instagramHandle = getInstagramHandle(dancer.connectLinks.instagram);

  const getFacebookProfileLabel = (facebookUrl: string | null) => {
    if (!facebookUrl) return null;

    const trimmed = facebookUrl.trim();
    if (!trimmed) return null;

    try {
      const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
      const url = new URL(normalized);
      const firstPathSegment = url.pathname.split("/").filter(Boolean)[0];

      if (!firstPathSegment || firstPathSegment === "profile.php") {
        return "View Facebook Profile";
      }

      return `facebook.com/${firstPathSegment}`;
    } catch {
      return "View Facebook Profile";
    }
  };

  const facebookProfileLabel = getFacebookProfileLabel(dancer.connectLinks.facebook);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    show: { opacity: 1, scale: 1 }
  };

  const hasPartnerIntent = 
    dancer.lookingForPartner || 
    dancer.partnerSearchRole || 
    dancer.partnerPracticeGoals.length > 0;

  const experienceDuration = calculateDuration(dancer.dancingStartDate);
  const experienceYears = experienceDuration?.years ?? (dancer.yearsDancing ? Number(dancer.yearsDancing) : null);
  const experienceMonths = experienceDuration?.months ?? null;
  const hasExperience = typeof experienceYears === 'number' && Number.isFinite(experienceYears) && experienceYears >= 0;

  const getExperienceLevel = (years: number) => {
    if (years >= 8) return { label: 'Veteran', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    if (years >= 4) return { label: 'Experienced', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
    if (years >= 2) return { label: 'Intermediate', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' };
    if (years >= 1) return { label: 'Rising', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    return { label: 'Newcomer', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  };

  const resolvedFestivals = dancer.festivalPlanIds
    .map((id) => {
      const fest = festivalMap[id];
      if (!fest) return null;
      const startDate = fest.start_time ? new Date(fest.start_time) : null;
      const isUpcoming = startDate ? startDate >= new Date() : true;
      if (!isUpcoming) return null;
      return { id: fest.id, name: fest.name, city: fest.city, startTime: fest.start_time };
    })
    .filter(Boolean) as { id: string; name: string; city: string | null; startTime: string | null }[];

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[minmax(160px,auto)]"
    >
      {/* 1. Identity Hero (2x2) */}
      <motion.div variants={itemVariants} className="col-span-2 row-span-2">
        <Card className="h-full relative overflow-hidden group border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/20 hover:border-primary/30">
          <div className="absolute inset-0">
            {dancer.avatarUrl ? (
              <img 
                src={dancer.avatarUrl} 
                alt={dancer.displayName}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center text-8xl">
                {dancer.displayName.charAt(0)}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          </div>
          
          <div className="relative h-full flex flex-col justify-end p-6 z-10">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
                {dancer.displayName}
              </h1>
              {dancer.isVerified && (
                <CheckCircle2 className="w-6 h-6 text-blue-400 fill-blue-400/20" />
              )}
            </div>
            
            {dancer.city && (
              <div className="flex items-center gap-2 text-white/80 font-medium">
                <MapPin className="w-4 h-4 text-primary" />
                <span>{dancer.city}</span>
                {dancer.nationality && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>{dancer.nationality}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* 2. Role & Experience (1x1) */}
      {(dancer.partnerRole || dancer.yearsDancing) && (
        <motion.div variants={itemVariants} className="col-span-1 row-span-1">
          <Card className="h-full p-5 flex flex-col justify-between border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80 group">
            <div className="flex justify-between items-start">
              <div className="p-2 rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                <User className="w-5 h-5" />
              </div>
            </div>
            <div>
              {dancer.partnerRole && (
                <div className="text-lg font-bold text-foreground mb-1">
                  {dancer.partnerRole}
                </div>
              )}
              {dancer.yearsDancing && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <span className="font-semibold text-primary">{dancer.yearsDancing}</span> years dancing
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* 3. Connect Actions (1x1) */}
      <motion.div variants={itemVariants} className="col-span-1 row-span-1">
        <Card className="h-full p-5 flex flex-col border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
          <div className="mb-auto">
             <div className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Connect</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {dancer.connectLinks.instagram && (
              <a href={dancer.connectLinks.instagram} target="_blank" rel="noopener noreferrer" className="bg-gradient-to-tr from-purple-600 to-pink-600 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {dancer.connectLinks.facebook && (
              <a href={dancer.connectLinks.facebook} target="_blank" rel="noopener noreferrer" className="bg-blue-600 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Facebook className="w-5 h-5" />
              </a>
            )}
             {dancer.connectLinks.website && (
              <a href={dancer.connectLinks.website} target="_blank" rel="noopener noreferrer" className="bg-zinc-700 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Globe className="w-5 h-5" />
              </a>
            )}
            {dancer.connectLinks.email && (
              <a href={`mailto:${dancer.connectLinks.email}`} className="bg-emerald-600 p-2 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity">
                <Mail className="w-5 h-5" />
              </a>
            )}
            {!dancer.connectLinks.instagram && !dancer.connectLinks.facebook && !dancer.connectLinks.website && !dancer.connectLinks.email && (
                <div className="col-span-2 text-xs text-muted-foreground text-center py-2 italic">
                    No public contacts
                </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* 4. Partner Intent (2x1) */}
      {hasPartnerIntent && (
        <motion.div variants={itemVariants} className="col-span-2 md:col-span-2 row-span-1">
          <Card className="h-full p-6 border-white/10 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <Heart className={`w-12 h-12 ${dancer.lookingForPartner ? 'text-pink-500 fill-pink-500/20' : 'text-gray-500'}`} />
            </div>
            
            <div className="relative z-10 h-full flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={dancer.lookingForPartner ? "default" : "secondary"} className="text-sm px-3 py-1">
                  {dancer.lookingForPartner ? "Open to Partnering" : "Not Looking"}
                </Badge>
                {dancer.partnerSearchRole && (
                    <span className="text-sm font-medium text-muted-foreground">as {dancer.partnerSearchRole}</span>
                )}
              </div>
              
              {dancer.partnerPracticeGoals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {dancer.partnerPracticeGoals.slice(0, 3).map(goal => (
                        <span key={goal} className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-md text-white/80">
                            {goal}
                        </span>
                    ))}
                    {dancer.partnerPracticeGoals.length > 3 && (
                        <span className="text-xs text-muted-foreground self-center">+{dancer.partnerPracticeGoals.length - 3} more</span>
                    )}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Experience Duration (1x1) */}
      {hasExperience && (() => {
        const level = getExperienceLevel(experienceYears!);
        return (
          <motion.div variants={itemVariants} className="col-span-1 row-span-1">
            <Card className={`h-full p-5 border-white/10 ${level.bg} backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80 flex flex-col justify-between`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Experience</span>
                </div>
                <Badge variant="outline" className={`text-[10px] ${level.color} ${level.border} ${level.bg}`}>
                  {level.label}
                </Badge>
              </div>
              <div className="mt-auto">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-black ${level.color}`}>{experienceYears}</span>
                  <span className="text-sm font-medium text-muted-foreground">{experienceYears === 1 ? 'Year' : 'Years'}</span>
                  {experienceMonths !== null && experienceMonths > 0 && (
                    <>
                      <span className={`text-lg font-bold ${level.color} ml-1`}>{experienceMonths}</span>
                      <span className="text-xs text-muted-foreground">{experienceMonths === 1 ? 'Mo' : 'Mo'}</span>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })()}

      {/* Instagram Handle (1x1) */}
      {dancer.connectLinks.instagram && instagramHandle && (
        <motion.div variants={itemVariants} className="col-span-2 md:col-span-1 row-span-1">
          <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
            <div className="flex items-center gap-2 mb-3 text-pink-500">
              <Instagram className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Instagram</span>
            </div>
            <a
              href={dancer.connectLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-foreground hover:text-primary transition-colors break-all"
            >
              {instagramHandle}
            </a>
          </Card>
        </motion.div>
      )}

      {/* Facebook Profile (1x1) */}
      {dancer.connectLinks.facebook && facebookProfileLabel && (
        <motion.div variants={itemVariants} className="col-span-2 md:col-span-1 row-span-1">
          <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
            <div className="flex items-center gap-2 mb-3 text-blue-500">
              <Facebook className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Facebook</span>
            </div>
            <a
              href={dancer.connectLinks.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 hover:text-blue-200 transition-colors"
            >
              {facebookProfileLabel}
            </a>
          </Card>
        </motion.div>
      )}

      {/* 5. My Sound (1x1) */}
      {dancer.favoriteSongs.length > 0 && (
        <motion.div variants={itemVariants} className="col-span-1 row-span-1">
           <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80 overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-3 text-primary">
                  <Disc className="w-5 h-5 animate-spin-slow" />
                  <span className="text-sm font-bold uppercase tracking-wider">My Sound</span>
              </div>
              <ul className="space-y-2 overflow-y-auto custom-scrollbar">
                  {dancer.favoriteSongs.map((song, i) => (
                      <li key={i} className="text-sm text-foreground/90 line-clamp-1" title={song}>
                          {song}
                      </li>
                  ))}
              </ul>
           </Card>
        </motion.div>
      )}

      {/* 6. My Styles (1x1) */}
      {dancer.favoriteStyles.length > 0 && (
        <motion.div variants={itemVariants} className="col-span-1 row-span-1">
          <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
            <div className="flex items-center gap-2 mb-4 text-amber-500">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Styles</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {dancer.favoriteStyles.slice(0, 5).map(style => (
                    <Badge key={style} variant="outline" className="bg-background/20 hover:bg-background/40 transition-colors cursor-default">
                        {style}
                    </Badge>
                ))}
            </div>
          </Card>
        </motion.div>
      )}
      
      {/* 7. Achievements (Optional Full Row or 1x1 if space allows - currently placing as 2x1 filler if needed, or 1x1) */}
      {dancer.achievements.length > 0 && (
          <motion.div variants={itemVariants} className="col-span-2 md:col-span-1 row-span-1">
            <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:scale-[1.02] hover:bg-card/80">
             <div className="flex items-center gap-2 mb-3 text-yellow-500">
                  <Trophy className="w-5 h-5" />
                  <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Highlights</span>
              </div>
              <ul className="space-y-1">
                  {dancer.achievements.slice(0, 2).map((achievement, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                          <span className="mt-1 w-1 h-1 rounded-full bg-yellow-500 shrink-0" />
                          <span className="line-clamp-2">{achievement}</span>
                      </li>
                  ))}
              </ul>
            </Card>
          </motion.div>
      )}

      {/* Upcoming Festivals (2x1) */}
      {resolvedFestivals.length > 0 && (
        <motion.div variants={itemVariants} className="col-span-2 md:col-span-2 row-span-1">
          <Card className="h-full p-5 border-white/10 bg-card/50 backdrop-blur-sm transition-all hover:bg-card/80">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upcoming Festivals</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {resolvedFestivals.map((fest) => (
                <button
                  key={fest.id}
                  type="button"
                  onClick={() => navigate(`/event/${fest.id}`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors cursor-pointer"
                >
                  <span>{fest.name}</span>
                  {fest.city && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400/70">
                      <MapPin className="w-3 h-3" />
                      {fest.city}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* 8. Event Timeline (Full Width) */}
      <motion.div variants={itemVariants} className="col-span-2 md:col-span-4 mt-4">
        <ProfileEventTimeline 
            personType="dancer"
            personId={dancer.id}
            title="Event Timeline"
            emptyText="No public events linked yet."
        />
      </motion.div>

    </motion.div>
  );
};