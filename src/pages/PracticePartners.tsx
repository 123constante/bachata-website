import { useState, useEffect } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { Users, Lock, MessageCircle, Sparkles, Heart, Music, Star, Zap, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import PageHero from "@/components/PageHero";
import { FloatingElements } from "@/components/FloatingElements";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { buildFullName } from "@/lib/name-utils";
import { useToast } from "@/hooks/use-toast";

type Dancer = {
  id: string;
  first_name: string;
  surname: string | null;
  favorite_styles: string[] | null;
  dance_role: string | null;
  cities: { name: string } | null;
  avatar_url: string | null;
  looking_for_partner: boolean | null;
  created_by: string | null;
};

const PracticePartners = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [partners, setPartners] = useState<Dancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<Dancer | null>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  
  const isLoggedIn = !!user;

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const { data, error } = await supabase
          .from('dancer_profiles')
          .select('id, first_name, surname, favorite_styles, dance_role, avatar_url, looking_for_partner, created_by, cities!based_city_id(name)')
          .eq('looking_for_partner', true)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setPartners(data || []);
      } catch (error) {
        console.error("Error fetching partners:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('dancer_profiles')
        .select('*')
        .eq('created_by', user.id)
        .maybeSingle();
      
      if (data) setCurrentUserProfile(data);
    };

    fetchUserProfile();
  }, [user]);

  const handlePartnerClick = (partnerId: string) => {
    if (!isLoggedIn) {
      setAuthModalOpen(true);
    } else {
      navigate(`/dancers/${partnerId}`);
    }
  };

  const handleAddYourself = async () => {
    if (!isLoggedIn) {
      setAuthModalOpen(true);
      return;
    }

    if (!currentUserProfile) {
      navigate('/create-dancers-profile');
      return;
    }

    if (currentUserProfile.looking_for_partner) {
      toast({
        title: "You are already listed!",
        description: "Your profile is visible in the practice partners list.",
      });
      return;
    }

    // Toggle on
    try {
      const { error } = await supabase
        .from('dancer_profiles')
        .update({ looking_for_partner: true })
        .eq('id', currentUserProfile.id);

      if (error) throw error;

      toast({
        title: "You are now listed!",
        description: "Dancers can now find you in the practice partners list.",
      });
      
      // Update local state
      setCurrentUserProfile({ ...currentUserProfile, looking_for_partner: true });
      // Refresh list to include self (optimistic or refetch)
      window.location.reload(); // Simple reload to refresh list is safest for now
      
    } catch (error) {
      toast({
        title: "Error updating profile",
        variant: "destructive"
      });
    }
  };

  const heroWidgets = [
    { emoji: "➕", title: "Add Yourself", desc: "Get listed", sectionId: "add-yourself" },
    { emoji: "👀", title: "Browse", desc: "Find partners", sectionId: "partners" },
    { emoji: "🎵", title: "By Style", desc: "Filter dancers", sectionId: "partners" },
    { emoji: "🕒", title: "By Time", desc: "Availability", sectionId: "partners" },
  ];

  const floatingIcons = [Users, Heart, Music, Star, Sparkles, Zap];

  const getAvatarContent = (partner: Dancer) => {
    if (partner.avatar_url) {
      return (
        <img
          src={partner.avatar_url}
          alt={buildFullName(partner.first_name, partner.surname)}
          className="w-full h-full object-cover rounded-full"
        />
      );
    }
    // Fallback emoji based on name hash
    const fullName = buildFullName(partner.first_name, partner.surname);
    const hash = fullName.charCodeAt(0) % 2;
    return <span className="text-2xl">{hash === 0 ? "💃" : "🕺"}</span>;
  };

  return (
    <div className="min-h-screen pb-24 pt-20">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Floating Elements Background */}
      <FloatingElements count={20} />

      {/* Hero Section */}
      <PageHero
        emoji="💃"
        titleWhite="Practice"
        titleOrange="Partners"
        subtitle={`${partners.length} dancers looking to practice together`}
        widgets={heroWidgets}
        floatingIcons={floatingIcons}
      />

      {/* Add Yourself CTA */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.1}>
        <section id="add-yourself" className="px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-5 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"
                  >
                    <Sparkles className="w-5 h-5 text-primary" />
                  </motion.div>
                  <div>
                    <p className="font-medium text-foreground">Looking to practice?</p>
                    <p className="text-xs text-muted-foreground">Add yourself to the list</p>
                  </div>
                </div>
                <Button
                  onClick={handleAddYourself}
                  size="sm"
                  className="rounded-full"
                >
                  {currentUserProfile?.looking_for_partner ? "Listed!" : "Add Me"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </section>
      </ScrollReveal>

      {/* Partners Grid */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.15}>
        <section id="partners" className="px-4 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            Available Partners
          </h2>
          
          {loading ? (
             <div className="text-center py-12 text-muted-foreground">Loading dancers...</div>
          ) : partners.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground">No practice partners listed yet. Be the first!</div>
          ) : (
            <StaggerContainer staggerDelay={0.1} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {partners.map((partner) => (
                <StaggerItem key={partner.id}>
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handlePartnerClick(partner.id)}
                    className="cursor-pointer"
                  >
                    <Card className="p-3 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all h-full">
                      <div className="flex flex-col items-center text-center">
                        {/* Avatar */}
                        <motion.div
                          whileHover={{ rotate: [0, -5, 5, 0] }}
                          transition={{ duration: 0.3 }}
                          className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border-2 border-primary/20 flex items-center justify-center mb-2 relative overflow-hidden"
                        >
                          {isLoggedIn ? (
                            getAvatarContent(partner)
                          ) : (
                            <Lock className="w-5 h-5 text-muted-foreground" />
                          )}
                        </motion.div>
                        
                        {/* Name */}
                        <h3 className="font-medium text-foreground text-sm truncate w-full">
                          {isLoggedIn ? buildFullName(partner.first_name, partner.surname) : "Locked User"}
                        </h3>
                        
                        {/* Style badge */}
                        {partner.favorite_styles && partner.favorite_styles.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary mt-1 line-clamp-1">
                            {partner.favorite_styles[0]}
                          </span>
                        )}
                        
                        {/* Location */}
                        {partner.cities?.name && (
                           <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                             <MapPin className="w-3 h-3" /> {partner.cities.name}
                           </p>
                        )}
                        
                        {/* Connect button (only if logged in) */}
                        {isLoggedIn && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="mt-2 flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            <MessageCircle className="w-3 h-3" />
                            View Profile
                          </motion.button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
          
          {/* Login prompt for non-logged users */}
          {!isLoggedIn && (
            <ScrollReveal animation="fadeUp" duration={0.8} delay={0.3}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-center"
              >
                <Card className="p-5 bg-muted/30 border-dashed border-muted-foreground/30">
                  <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Login to see names and connect with dancers
                  </p>
                  <Button
                    onClick={() => setAuthModalOpen(true)}
                    variant="outline"
                    className="rounded-full"
                  >
                    Login to Unlock
                  </Button>
                </Card>
              </motion.div>
            </ScrollReveal>
          )}
        </section>
      </ScrollReveal>

      {/* How it works */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.2}>
        <section className="px-4 mb-24">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">How It Works</h2>
          <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Add Yourself", desc: "Share your style & availability" },
              { step: "2", title: "Browse Partners", desc: "Find dancers who match" },
              { step: "3", title: "Connect", desc: "Message and plan practice" },
            ].map((item) => (
              <StaggerItem key={item.step}>
                <Card className="p-4 bg-card/30 border-border/30 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </ScrollReveal>

      {/* Auth Modal */}
      <AuthPromptModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        title="Join the Community"
        description="Login to see dancer profiles and connect with practice partners."
      />
    </div>
  );
};

export default PracticePartners;


