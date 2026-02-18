import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { Users, Home, Car, Heart, MessageCircle, ChevronRight, Plane, Music, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import PageHero from "@/components/PageHero";
import { FloatingElements } from "@/components/FloatingElements";
import PageBreadcrumb from "@/components/PageBreadcrumb";

// Festival mock data - completely separate from regular events
const festivals = [
  {
    id: "bcn-bachata-2025",
    name: "Barcelona Bachata Festival",
    location: "Barcelona, Spain",
    flag: "‡ª‡¸",
    dates: "Jan 15-18, 2025",
    startDate: new Date("2025-01-15"),
    danceStyles: ["Bachata", "Sensual", "Dominican"],
    goingCount: 14,
    interestedCount: 32,
    roommatesLooking: 6,
    taxiBuddiesLooking: 4,
    dancePartnersLooking: 9,
    attendees: Array.from({ length: 46 }, (_, i) => ({
      id: `bcn-${i}`,
      name: `Dancer ${i + 1}`,
      avatar: i % 3 === 0 ? "‘©" : i % 3 === 1 ? "‘¨" : "’ƒ",
      status: i < 14 ? "going" : "interested" as "going" | "interested",
    })),
    travel: {
      nearestAirport: "Barcelona El Prat (BCN)",
      airportDistance: "12 km",
      nearbyAirports: ["Girona (GRO) - 92km", "Reus (REU) - 108km"],
      nearestCoachStation: "Barcelona Nord Bus Station",
      publicTransportTime: "35 mins by metro + bus"
    }
  },
  {
    id: "warsaw-salsa-2025",
    name: "Warsaw Salsa Congress",
    location: "Warsaw, Poland",
    flag: "‡µ‡±",
    dates: "Feb 6-9, 2025",
    startDate: new Date("2025-02-06"),
    danceStyles: ["Salsa", "Cuban", "On2"],
    goingCount: 8,
    interestedCount: 19,
    roommatesLooking: 3,
    taxiBuddiesLooking: 5,
    dancePartnersLooking: 7,
    attendees: Array.from({ length: 27 }, (_, i) => ({
      id: `warsaw-${i}`,
      name: `Dancer ${i + 1}`,
      avatar: i % 3 === 0 ? "‘©" : i % 3 === 1 ? "‘¨" : "•º",
      status: i < 8 ? "going" : "interested" as "going" | "interested",
    })),
    travel: {
      nearestAirport: "Warsaw Chopin (WAW)",
      airportDistance: "10 km",
      nearbyAirports: ["Warsaw Modlin (WMI) - 40km"],
      nearestCoachStation: "Warszawa Zachodnia",
      publicTransportTime: "25 mins by train"
    }
  },
  {
    id: "paris-kizomba-2025",
    name: "Paris Kizomba Festival",
    location: "Paris, France",
    flag: "‡«‡·",
    dates: "Mar 20-23, 2025",
    startDate: new Date("2025-03-20"),
    danceStyles: ["Kizomba", "Urban Kiz", "Semba"],
    goingCount: 22,
    interestedCount: 45,
    roommatesLooking: 8,
    taxiBuddiesLooking: 12,
    dancePartnersLooking: 15,
    attendees: Array.from({ length: 67 }, (_, i) => ({
      id: `paris-${i}`,
      name: `Dancer ${i + 1}`,
      avatar: i % 3 === 0 ? "‘©" : i % 3 === 1 ? "‘¨" : "’ƒ",
      status: i < 22 ? "going" : "interested" as "going" | "interested",
    })),
    travel: {
      nearestAirport: "Paris Charles de Gaulle (CDG)",
      airportDistance: "25 km",
      nearbyAirports: ["Paris Orly (ORY) - 18km", "Beauvais (BVA) - 85km"],
      nearestCoachStation: "Paris Bercy Seine",
      publicTransportTime: "45 mins by RER + metro"
    }
  },
];

// Confetti particle component
const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => (
  <motion.div
    initial={{ y: -20, x: startX, opacity: 0, rotate: 0 }}
    animate={{ 
      y: ["0vh", "100vh"], 
      x: [startX, startX + (Math.random() - 0.5) * 100],
      opacity: [0, 1, 1, 0],
      rotate: [0, 360, 720]
    }}
    transition={{ 
      duration: 4 + Math.random() * 2, 
      delay, 
      repeat: Infinity,
      ease: "linear"
    }}
    className="absolute text-lg pointer-events-none"
    style={{ left: `${startX}%` }}
  >
    {["‰", "Š", "¨", "­", "ª", " ", "¡", "¥³", "’ƒ", "•º"][Math.floor(Math.random() * 10)]}
  </motion.div>
);

const FestivalHub = () => {
  const navigate = useNavigate();
  const [userStatus, setUserStatus] = useState<Record<string, "going" | "interested" | null>>({});
  const [, setTick] = useState(0);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getCountdown = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return "Now!";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  };

  const handleStatus = (festivalId: string, status: "going" | "interested") => {
    setUserStatus(prev => ({
      ...prev,
      [festivalId]: prev[festivalId] === status ? null : status
    }));
  };

  const WHATSAPP_THRESHOLD = 10;

  const heroWidgets = [
    { emoji: "ª", title: "Festivals", desc: "Upcoming events", sectionId: "festivals" },
    { emoji: " ", title: "Roommates", desc: "Share costs", sectionId: "festivals" },
    { emoji: "š•", title: "Travel", desc: "Taxi buddies", sectionId: "festivals" },
    { emoji: "’ƒ", title: "Partners", desc: "Pre-plan dances", sectionId: "festivals" },
  ];

  const floatingIcons = [Plane, Music, Heart, Star, Home, Users];

  return (
    <div className="min-h-screen pb-24 pt-20 overflow-hidden relative">
      <PageBreadcrumb items={[{ label: 'Experience', path: '/experience' }, { label: 'Festivals' }]} />
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-festival-pink to-festival-purple z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Floating Elements Background */}
      <FloatingElements count={20} />

      {/* Animated Confetti Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {Array.from({ length: 15 }).map((_, i) => (
          <ConfettiParticle key={i} delay={i * 0.3} startX={Math.random() * 100} />
        ))}
      </div>

      {/* Carnival Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-orange-500/10 pointer-events-none z-0" />
      
      {/* Hero Section */}
      <PageHero
        emoji="ª"
        titleWhite="Festival"
        titleOrange="Hub"
        subtitle=""
        widgets={heroWidgets}
        gradientFrom="pink-500"
        floatingIcons={floatingIcons}
        largeTitle={true}
      />

      {/* Stats */}
      <div className="flex items-center justify-center gap-2 -mt-4 mb-8 relative z-10">
        <span className="text-xs text-muted-foreground">
          {festivals.length} upcoming festivals
        </span>
      </div>

      {/* Festival Cards Grid */}
      <section id="festivals" className="px-4 mb-24 relative z-10">
        <StaggerContainer staggerDelay={0.15} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {festivals.map((festival) => {
            const totalAttendees = festival.goingCount + festival.interestedCount;
            const progress = Math.min((totalAttendees / WHATSAPP_THRESHOLD) * 100, 100);
            const whatsappActive = totalAttendees >= WHATSAPP_THRESHOLD;
            const status = userStatus[festival.id];

            return (
              <StaggerItem key={festival.id}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className="p-6 bg-gradient-to-br from-card via-card to-primary/5 border-primary/20 hover:border-primary/40 transition-all cursor-pointer overflow-hidden relative"
                    onClick={() => navigate(`/festival/${festival.id}`)}
                  >
                    {/* Carnival stripe decoration */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500" />
                    
                    {/* Festival Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{festival.flag}</span>
                          <h3 className="font-bold text-foreground text-lg">{festival.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{festival.dates} Â· {festival.location}</p>
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full"
                      >
                        {getCountdown(festival.startDate)}
                      </motion.div>
                    </div>

                    {/* Dance Styles */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {festival.danceStyles.map(style => (
                        <span key={style} className="text-[10px] bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
                          {style}
                        </span>
                      ))}
                    </div>

                    {/* Attendance Stats */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">‹</span>
                        <span className="text-xs font-medium text-foreground">Going: {festival.goingCount}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">‘€</span>
                        <span className="text-xs text-muted-foreground">Interested: {festival.interestedCount}</span>
                      </div>
                    </div>

                    {/* Avatars */}
                    <div className="flex items-center mb-3">
                      <div className="flex -space-x-2">
                        {festival.attendees.slice(0, 5).map((attendee, i) => (
                          <motion.div
                            key={attendee.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * i }}
                            className="w-7 h-7 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-sm"
                          >
                            {attendee.avatar}
                          </motion.div>
                        ))}
                      </div>
                      {festival.attendees.length > 5 && (
                        <span className="text-xs text-muted-foreground ml-2">+{festival.attendees.length - 5} more</span>
                      )}
                    </div>

                    {/* WhatsApp Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground">WhatsApp Group</span>
                        <span className="text-[10px] font-medium text-primary">{totalAttendees}/{WHATSAPP_THRESHOLD}</span>
                      </div>
                      <div className="relative">
                        <Progress value={progress} className="h-2" />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{ x: ["-100%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        />
                      </div>
                      <AnimatePresence>
                        {whatsappActive ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1 mt-1"
                          >
                            <MessageCircle className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] text-green-500 font-medium">WhatsApp group active!</span>
                          </motion.div>
                        ) : (
                          <motion.span className="text-[10px] text-muted-foreground mt-1 block">
                            ”“ {WHATSAPP_THRESHOLD - totalAttendees} more needed for WhatsApp group!
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Crew Finder Stats */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                        <Home className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px]">{festival.roommatesLooking}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                        <Car className="w-3 h-3 text-yellow-400" />
                        <span className="text-[10px]">{festival.taxiBuddiesLooking}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full">
                        <Heart className="w-3 h-3 text-pink-400" />
                        <span className="text-[10px]">{festival.dancePartnersLooking}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                        <Button
                          variant={status === "going" ? "default" : "outline"}
                          size="sm"
                          className="w-full text-xs h-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatus(festival.id, "going");
                          }}
                        >
                          {status === "going" ? "“ Going" : "‹ I'm Going"}
                        </Button>
                      </motion.div>
                      <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                        <Button
                          variant={status === "interested" ? "default" : "outline"}
                          size="sm"
                          className="w-full text-xs h-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatus(festival.id, "interested");
                          }}
                        >
                          {status === "interested" ? "“ Interested" : "‘€ Interested"}
                        </Button>
                      </motion.div>
                    </div>

                    {/* View Details Arrow */}
                    <div className="flex items-center justify-center mt-3 text-primary">
                      <span className="text-[10px]">View details & find crew</span>
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  </Card>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </section>

      {/* Bottom CTA */}
      <ScrollReveal animation="scale" duration={0.8}>
        <section className="px-4 mt-24 mb-16 relative z-10">
          <Card className="p-6 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-orange-500/20 border-primary/20 text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span className="text-2xl">Š</span>
            </motion.div>
            <h3 className="text-xl font-bold text-foreground mt-2">More festivals coming soon!</h3>
            <p className="text-xs text-muted-foreground mt-1">We're adding new festivals every week</p>
          </Card>
        </section>
      </ScrollReveal>
    </div>
  );
};

export default FestivalHub;


