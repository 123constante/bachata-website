import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, MapPin, Globe, Music, Heart, Instagram, Facebook, Phone, 
  Calendar, Sparkles, User, Trophy, Disc
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollReveal } from "@/components/ScrollReveal";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getPhotoUrl } from "@/lib/utils";
import { buildFullName } from "@/lib/name-utils";
import ProfileEventTimeline from "@/components/profile/ProfileEventTimeline";

type Dancer = {
  id: string;
  first_name: string;
  surname: string | null;
  city: string | null;
  nationality: string | null;
  years_dancing: string | null;
  favorite_styles: string[] | null;
  partner_role: string | null;
  looking_for_partner: boolean | null;
  instagram: string | null;
  facebook: string | null;
  phone: string | null;
  photo_url: string | null;
  created_at: string | null;
  hide_surname: boolean | null;
  website: string | null;
  achievements: string[] | null;
  favorite_songs: string[] | null;
  partner_search_role: string | null;
  partner_search_level: string[] | null;
  partner_practice_goals: string[] | null;
  partner_details: any | null;
};

const DancerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dancer, setDancer] = useState<Dancer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDancer = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("dancers")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setError("Dancer not found");
          return;
        }
        setDancer(data);
      } catch (err: any) {
        setError(err.message || "Failed to load dancer profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancer();
  }, [id]);

  const getAvatarEmoji = (name: string) => {
    const hash = name.charCodeAt(0) % 2;
    return hash === 0 ? "🕺" : "💃";
  };

  const getDisplayName = (dancer: Dancer) => {
    if (dancer.hide_surname && dancer.surname) {
      return `${dancer.first_name} ${dancer.surname.charAt(0)}.`;
    }
    return buildFullName(dancer.first_name, dancer.surname);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 pt-32">
        <div className="container max-w-4xl mx-auto px-4">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="flex flex-col md:flex-row gap-8">
            <Skeleton className="w-40 h-40 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dancer) {
    return (
      <div className="min-h-screen pb-24 pt-32">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-6xl mb-4"
          >
            👾
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Dancer not found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            The profile you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/dancers")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dancers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 pt-20">
      <PageBreadcrumb items={[
        { label: 'Dancers', path: '/dancers' },
        { label: getDisplayName(dancer) }
      ]} />
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        
        <div className="container max-w-4xl mx-auto px-4 relative z-10">
          {/* Back Button */}
          <ScrollReveal>
            <Button
              variant="ghost"
              onClick={() => navigate("/dancers")}
              className="mb-6 hover:bg-primary/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dancers
            </Button>
          </ScrollReveal>

          {/* Profile Header */}
          <ScrollReveal delay={0.1}>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="relative"
              >
                {getPhotoUrl(dancer.photo_url) ? (
                  <img
                    src={getPhotoUrl(dancer.photo_url)!}
                    alt={getDisplayName(dancer)}
                    className="w-36 h-36 md:w-44 md:h-44 rounded-full object-cover border-4 border-primary/30"
                  />
                ) : (
                  <div className="w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-primary/30 flex items-center justify-center text-7xl">
                    {getAvatarEmoji(dancer.first_name)}
                  </div>
                )}
                {dancer.looking_for_partner && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
                  >
                    <Heart className="w-3 h-3" />
                    Looking for partner
                  </motion.div>
                )}
              </motion.div>

              {/* Name & Basic Info */}
              <div className="text-center md:text-left flex-1">
                <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">
                  {getDisplayName(dancer)}
                </h1>
                
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 text-muted-foreground mb-4">
                  {dancer.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      {dancer.city}
                    </span>
                  )}
                  {dancer.nationality && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-4 h-4 text-primary" />
                      {dancer.nationality}
                    </span>
                  )}
                  {dancer.years_dancing !== null && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-primary" />
                      {dancer.years_dancing} years dancing
                    </span>
                  )}
                </div>

                {dancer.partner_role && (
                  <Badge variant="secondary" className="mb-4">
                    <User className="w-3 h-3 mr-1" />
                    {dancer.partner_role}
                  </Badge>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Content */}
      <section className="container max-w-4xl mx-auto px-4 space-y-6">

        {/* Partner Search Section */}
        {dancer.looking_for_partner && (
          <ScrollReveal delay={0.2}>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Heart className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Partner Search Profile</h2>
                    <p className="text-sm text-muted-foreground">Active and looking</p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {dancer.partner_search_role && (
                      <div>
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Looking for</span>
                         <Badge>{dancer.partner_search_role}</Badge>
                      </div>
                    )}
                    
                    {dancer.partner_search_level && dancer.partner_search_level.length > 0 && (
                      <div>
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Level Match</span>
                         <div className="flex flex-wrap gap-1">
                            {dancer.partner_search_level.map(l => (
                              <Badge key={l} variant="outline" className="bg-background">{l}</Badge>
                            ))}
                         </div>
                      </div>
                    )}

                    {dancer.partner_practice_goals && dancer.partner_practice_goals.length > 0 && (
                      <div>
                         <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Practice Goals</span>
                         <div className="flex flex-wrap gap-1">
                            {dancer.partner_practice_goals.map(g => (
                              <Badge key={g} variant="secondary" className="bg-background/50">{g}</Badge>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>

                  {dancer.partner_details && (
                     <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Details</span>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap bg-background/50 p-3 rounded-lg border border-primary/10">
                          {typeof dancer.partner_details === 'string' 
                            ? dancer.partner_details 
                            : JSON.stringify(dancer.partner_details).replace(/^"|"$/g, '')}
                        </p>
                     </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Achievements */}
        {dancer.achievements && dancer.achievements.length > 0 && (
          <ScrollReveal delay={0.25}>
            <Card className="glow-card">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Achievements
                </h2>
                <ul className="space-y-2">
                  {dancer.achievements.map((achievement, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <span>{achievement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Dance Styles & Songs */}
        <div className="grid md:grid-cols-2 gap-6">
          {dancer.favorite_styles && dancer.favorite_styles.length > 0 && (
            <ScrollReveal delay={0.3}>
              <Card className="glow-card h-full">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <Music className="w-5 h-5 text-primary" />
                    Favorite Styles
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {dancer.favorite_styles.map((style) => (
                      <Badge
                        key={style}
                        variant="outline"
                        className="bg-primary/10 border-primary/30 text-foreground"
                      >
                        {style}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}

          {dancer.favorite_songs && dancer.favorite_songs.length > 0 && (
            <ScrollReveal delay={0.35}>
              <Card className="glow-card h-full">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <Disc className="w-5 h-5 text-primary" />
                    Favorite Songs
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {dancer.favorite_songs.map((song) => (
                      <Badge
                        key={song}
                        variant="secondary"
                        className="text-foreground"
                      >
                        {song}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          )}
        </div>

        {/* Contact / Social */}
        {(dancer.instagram || dancer.facebook || dancer.phone || dancer.website) && (
          <ScrollReveal delay={0.4}>
            <Card className="glow-card">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <Instagram className="w-5 h-5 text-primary" />
                  Connect
                </h2>
                <div className="flex flex-wrap gap-3">
                  {dancer.instagram && (
                    <a
                      href={`https://instagram.com/${dancer.instagram.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Instagram className="w-4 h-4 mr-2" />
                        {dancer.instagram}
                      </Button>
                    </a>
                  )}
                  {dancer.facebook && (
                    <a
                      href={dancer.facebook.startsWith("http") ? dancer.facebook : `https://facebook.com/${dancer.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Facebook className="w-4 h-4 mr-2" />
                        Facebook
                      </Button>
                    </a>
                  )}
                  {dancer.website && (
                    <a
                      href={dancer.website.startsWith("http") ? dancer.website : `https://${dancer.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <Globe className="w-4 h-4 mr-2" />
                        Website
                      </Button>
                    </a>
                  )}
                  {dancer.phone && (
                    <a href={`tel:${dancer.phone}`}>
                      <Button variant="outline" size="sm">
                        <Phone className="w-4 h-4 mr-2" />
                        {dancer.phone}
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        <ScrollReveal delay={0.45}>
          <ProfileEventTimeline
            personType="dancer"
            personId={dancer.id}
            title="Event timeline"
            emptyText="No connected events yet."
          />
        </ScrollReveal>
      </section>
    </div>
  );
};

export default DancerProfile;


