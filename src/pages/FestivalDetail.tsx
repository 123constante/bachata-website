import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plane, Bus, Train, MapPin, Users, Home, Car, Heart, MessageCircle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollReveal, StaggerContainer, StaggerItem } from "@/components/ScrollReveal";
import PageBreadcrumb from "@/components/PageBreadcrumb";

// Same festival data - in production this would be fetched
const festivalsData: Record<string, {
  id: string;
  name: string;
  location: string;
  flag: string;
  dates: string;
  startDate: Date;
  danceStyles: string[];
  goingCount: number;
  interestedCount: number;
  roommatesLooking: number;
  taxiBuddiesLooking: number;
  dancePartnersLooking: number;
  attendees: { id: string; name: string; avatar: string; status: "going" | "interested" }[];
  travel: {
    nearestAirport: string;
    airportDistance: string;
    nearbyAirports: string[];
    nearestCoachStation: string;
    publicTransportTime: string;
  };
  roommatesList: { id: string; name: string; avatar: string; note: string }[];
  taxiBuddiesList: { id: string; name: string; avatar: string; note: string }[];
  dancePartnersList: { id: string; name: string; avatar: string; note: string }[];
}> = {
  "bcn-bachata-2025": {
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
    },
    roommatesList: [
      { id: "r1", name: "Maria", avatar: "‘©", note: "Looking for female roommate, Jan 14-19" },
      { id: "r2", name: "Carlos", avatar: "‘¨", note: "Need 1 person for Airbnb near venue" },
      { id: "r3", name: "Sophie", avatar: "‘©", note: "Budget friendly hostel share?" },
      { id: "r4", name: "Alex", avatar: "‘¨", note: "Have a spare bed in my hotel room" },
      { id: "r5", name: "Luna", avatar: "‘©", note: "Looking for 2 girls to share apartment" },
      { id: "r6", name: "Marco", avatar: "‘¨", note: "Arriving 14th, leaving 19th" },
    ],
    taxiBuddiesList: [
      { id: "t1", name: "Elena", avatar: "‘©", note: "Landing BCN 2pm on Jan 14" },
      { id: "t2", name: "David", avatar: "‘¨", note: "Need taxi from airport on 15th morning" },
      { id: "t3", name: "Ana", avatar: "‘©", note: "Departing Jan 19 afternoon" },
      { id: "t4", name: "Tom", avatar: "‘¨", note: "Happy to share Uber anytime" },
    ],
    dancePartnersList: [
      { id: "d1", name: "Isabella", avatar: "‘©", note: "Follower, intermediate level" },
      { id: "d2", name: "Marcus", avatar: "‘¨", note: "Leader, looking for practice partner" },
      { id: "d3", name: "Sofia", avatar: "‘©", note: "Beginner, want to dance socials!" },
      { id: "d4", name: "James", avatar: "‘¨", note: "Advanced leader, sensual focus" },
      { id: "d5", name: "Lucia", avatar: "‘©", note: "Follower, love Dominican style" },
      { id: "d6", name: "Miguel", avatar: "‘¨", note: "Intermediate, first festival!" },
      { id: "d7", name: "Emma", avatar: "‘©", note: "Looking for dance buddies" },
      { id: "d8", name: "Pedro", avatar: "‘¨", note: "Happy to dance with everyone" },
      { id: "d9", name: "Clara", avatar: "‘©", note: "Follower, modern bachata" },
    ],
  },
  "warsaw-salsa-2025": {
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
    },
    roommatesList: [
      { id: "r1", name: "Kasia", avatar: "‘©", note: "Looking for female roommate" },
      { id: "r2", name: "Piotr", avatar: "‘¨", note: "Sharing hotel room" },
      { id: "r3", name: "Magda", avatar: "‘©", note: "Need budget accommodation" },
    ],
    taxiBuddiesList: [
      { id: "t1", name: "Anna", avatar: "‘©", note: "Arriving Feb 5 evening" },
      { id: "t2", name: "Tomek", avatar: "‘¨", note: "Need ride from Modlin airport" },
      { id: "t3", name: "Julia", avatar: "‘©", note: "Leaving Feb 10 morning" },
      { id: "t4", name: "Marek", avatar: "‘¨", note: "Can drive from Chopin" },
      { id: "t5", name: "Ola", avatar: "‘©", note: "Looking for taxi buddies" },
    ],
    dancePartnersList: [
      { id: "d1", name: "Natalia", avatar: "‘©", note: "Follower, On2 style" },
      { id: "d2", name: "Jakub", avatar: "‘¨", note: "Leader, Cuban salsa" },
      { id: "d3", name: "Zofia", avatar: "‘©", note: "Beginner follower" },
      { id: "d4", name: "MichaÅ‚", avatar: "‘¨", note: "Intermediate leader" },
      { id: "d5", name: "Agnieszka", avatar: "‘©", note: "Advanced, all styles" },
      { id: "d6", name: "PaweÅ‚", avatar: "‘¨", note: "Looking for practice" },
      { id: "d7", name: "Ewa", avatar: "‘©", note: "Love social dancing!" },
    ],
  },
  "paris-kizomba-2025": {
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
    },
    roommatesList: [
      { id: "r1", name: "Camille", avatar: "‘©", note: "Looking for 2 girls for Airbnb" },
      { id: "r2", name: "Antoine", avatar: "‘¨", note: "Have hotel near venue" },
      { id: "r3", name: "Léa", avatar: "‘©", note: "Budget hostel share" },
      { id: "r4", name: "Pierre", avatar: "‘¨", note: "Looking for roommate" },
      { id: "r5", name: "Manon", avatar: "‘©", note: "Apartment with spare room" },
      { id: "r6", name: "Lucas", avatar: "‘¨", note: "First timer, need accommodation" },
      { id: "r7", name: "Chloé", avatar: "‘©", note: "Mar 19-24, flexible" },
      { id: "r8", name: "Hugo", avatar: "‘¨", note: "Central Paris preferred" },
    ],
    taxiBuddiesList: [
      { id: "t1", name: "Marie", avatar: "‘©", note: "Arriving CDG Mar 19 afternoon" },
      { id: "t2", name: "Thomas", avatar: "‘¨", note: "Landing Orly Mar 20 morning" },
      { id: "t3", name: "Julie", avatar: "‘©", note: "Departing Mar 24 evening" },
      { id: "t4", name: "Nicolas", avatar: "‘¨", note: "Happy to share any transfer" },
      { id: "t5", name: "Emma", avatar: "‘©", note: "Beauvais airport, need taxi!" },
      { id: "t6", name: "Maxime", avatar: "‘¨", note: "Can organize group transfer" },
      { id: "t7", name: "Sarah", avatar: "‘©", note: "CDG departing Mar 23 late" },
      { id: "t8", name: "Gabriel", avatar: "‘¨", note: "Uber to share anytime" },
      { id: "t9", name: "InÃ¨s", avatar: "‘©", note: "Looking for taxi buddies" },
      { id: "t10", name: "RaphaÃ«l", avatar: "‘¨", note: "Orly arrival Mar 19" },
      { id: "t11", name: "Zoé", avatar: "‘©", note: "Need ride from CDG" },
      { id: "t12", name: "Arthur", avatar: "‘¨", note: "Flexible with timing" },
    ],
    dancePartnersList: [
      { id: "d1", name: "Océane", avatar: "‘©", note: "Follower, Urban Kiz style" },
      { id: "d2", name: "Mathieu", avatar: "‘¨", note: "Leader, traditional Kizomba" },
      { id: "d3", name: "Clara", avatar: "‘©", note: "Beginner, want to learn Semba" },
      { id: "d4", name: "Théo", avatar: "‘¨", note: "Intermediate Urban Kiz" },
      { id: "d5", name: "Jade", avatar: "‘©", note: "Advanced follower, all styles" },
      { id: "d6", name: "Louis", avatar: "‘¨", note: "Looking for practice partner" },
      { id: "d7", name: "Eva", avatar: "‘©", note: "First kizomba festival!" },
      { id: "d8", name: "Nathan", avatar: "‘¨", note: "Love social dancing" },
      { id: "d9", name: "Alice", avatar: "‘©", note: "Follower, sensual kiz" },
      { id: "d10", name: "Victor", avatar: "‘¨", note: "Intermediate leader" },
      { id: "d11", name: "Romane", avatar: "‘©", note: "Looking for dance friends" },
      { id: "d12", name: "Jules", avatar: "‘¨", note: "Beginner leader, very keen!" },
      { id: "d13", name: "Nina", avatar: "‘©", note: "Advanced, tarraxinha too" },
      { id: "d14", name: "Adrien", avatar: "‘¨", note: "All levels welcome" },
      { id: "d15", name: "Lou", avatar: "‘©", note: "Follower, Urban focus" },
    ],
  },
};

const FestivalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [userStatus, setUserStatus] = useState<"going" | "interested" | null>(null);
  const [crewTab, setCrewTab] = useState("roommates");
  const [attendeesTab, setAttendeesTab] = useState<"going" | "interested">("going");
  const [handRaised, setHandRaised] = useState<{ roommate: boolean; taxi: boolean; dance: boolean }>({
    roommate: false, taxi: false, dance: false
  });
  const [, setTick] = useState(0);

  const festival = festivalsData[id || ""];

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!festival) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Festival not found</h1>
          <Button onClick={() => navigate("/festivals")} className="mt-4">Back to Festivals</Button>
        </div>
      </div>
    );
  }

  const getCountdown = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, mins, secs };
  };

  const countdown = getCountdown(festival.startDate);
  const totalAttendees = festival.goingCount + festival.interestedCount;
  const WHATSAPP_THRESHOLD = 10;
  const progress = Math.min((totalAttendees / WHATSAPP_THRESHOLD) * 100, 100);
  const whatsappActive = totalAttendees >= WHATSAPP_THRESHOLD;

  const goingAttendees = festival.attendees.filter(a => a.status === "going");
  const interestedAttendees = festival.attendees.filter(a => a.status === "interested");

  return (
    <div className="min-h-screen pb-24 pt-20">
      <PageBreadcrumb items={[
        { label: 'Experience', path: '/experience' },
        { label: 'Festivals', path: '/festivals' },
        { label: festival.name }
      ]} />
      {/* Header */}
      <div className="sticky top-[100px] z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/festivals")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm truncate">{festival.name}</h1>
            <p className="text-[10px] text-muted-foreground">{festival.dates}</p>
          </div>
        </div>
      </div>

      {/* Hero with Countdown */}
      <ScrollReveal animation="fadeUp" duration={0.8}>
        <section className="px-4 py-16 mb-16 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-orange-500/10 relative overflow-hidden">
          {/* Carnival decorations */}
          <motion.span
            animate={{ y: [-5, 5, -5], rotate: [-10, 10, -10] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute top-4 right-4 text-2xl"
          >🎉</motion.span>
          <motion.span
            animate={{ y: [5, -5, 5] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="absolute bottom-4 left-4 text-xl"
          >Š</motion.span>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{festival.flag}</span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight">{festival.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-8">{festival.location}</p>

          {/* Dance styles */}
          <div className="flex flex-wrap gap-1 mb-6">
            {festival.danceStyles.map(style => (
              <span key={style} className="text-xs bg-accent/50 text-accent-foreground px-2 py-0.5 rounded-full">
                {style}
              </span>
            ))}
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-1 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Countdown:</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: countdown.days, label: "Days" },
              { value: countdown.hours, label: "Hours" },
              { value: countdown.mins, label: "Mins" },
              { value: countdown.secs, label: "Secs" },
            ].map((item) => (
              <motion.div
                key={item.label}
                className="bg-card/80 backdrop-blur rounded-lg p-2 text-center border border-primary/20"
              >
                <motion.span
                  key={item.value}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-xl font-bold text-foreground block"
                >
                  {item.value}
                </motion.span>
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Attendance buttons */}
          <div className="flex gap-2 mt-6">
            <Button
              variant={userStatus === "going" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setUserStatus(userStatus === "going" ? null : "going")}
            >
              {userStatus === "going" ? "“ Going" : "‹ I'm Going"}
            </Button>
            <Button
              variant={userStatus === "interested" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setUserStatus(userStatus === "interested" ? null : "interested")}
            >
              {userStatus === "interested" ? "“ Interested" : "‘€ Interested"}
            </Button>
          </div>
        </section>
      </ScrollReveal>

      {/* Travel & Logistics */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.1}>
        <section className="px-4 py-12 mb-16">
          <Card className="p-6 bg-card/50 border-primary/20">
            <div className="flex items-center gap-3 mb-8">
              <Plane className="w-6 h-6 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Getting There</h2>
            </div>

            <div className="space-y-4">
              {/* Nearest Airport */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Nearest Airport</p>
                  <p className="text-sm text-muted-foreground">{festival.travel.nearestAirport}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary">{festival.travel.airportDistance} from venue</span>
                  </div>
                </div>
              </div>

              {/* Other Airports */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Plane className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Other Nearby Airports</p>
                  {festival.travel.nearbyAirports.map((airport, i) => (
                    <p key={i} className="text-sm text-muted-foreground">â€¢ {airport}</p>
                  ))}
                </div>
              </div>

              {/* Coach Station */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Bus className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Nearest Coach Station</p>
                  <p className="text-sm text-muted-foreground">{festival.travel.nearestCoachStation}</p>
                </div>
              </div>

              {/* Public Transport */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <Train className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">Public Transport to Venue</p>
                  <p className="text-sm text-muted-foreground">{festival.travel.publicTransportTime}</p>
                  <span className="text-[10px] text-muted-foreground">(From airport)</span>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </ScrollReveal>

      {/* WhatsApp Group Status */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.15}>
        <section className="px-4 py-2 mb-8">
          <Card className="p-6 bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-foreground">WhatsApp Group</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Attendees needed</span>
              <span className="text-xs font-medium text-green-500">{totalAttendees}/{WHATSAPP_THRESHOLD}</span>
            </div>
            <Progress value={progress} className="h-2 mb-2" />
            <AnimatePresence>
              {whatsappActive ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 p-2 bg-green-500/20 rounded-lg"
                >
                  <Sparkles className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500 font-medium">Group active! Admin will share the link once you mark Going.</span>
                </motion.div>
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  ”“ {WHATSAPP_THRESHOLD - totalAttendees} more needed to unlock WhatsApp group
                </span>
              )}
            </AnimatePresence>
          </Card>
        </section>
      </ScrollReveal>

      {/* Crew Finder */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.2}>
        <section className="px-4 py-12 mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            Find Your Crew
          </h2>
          
          <Tabs value={crewTab} onValueChange={setCrewTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="roommates" className="text-xs">
                <Home className="w-3 h-3 mr-1" />
                Roommates ({festival.roommatesLooking})
              </TabsTrigger>
              <TabsTrigger value="taxi" className="text-xs">
                <Car className="w-3 h-3 mr-1" />
                Taxi ({festival.taxiBuddiesLooking})
              </TabsTrigger>
              <TabsTrigger value="dance" className="text-xs">
                <Heart className="w-3 h-3 mr-1" />
                Dance ({festival.dancePartnersLooking})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="roommates">
              <Card className="p-4">
                <StaggerContainer staggerDelay={0.1} className="space-y-3">
                  {festival.roommatesList.map((person) => (
                    <StaggerItem key={person.id}>
                      <div className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-lg">
                          {person.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{person.name}</p>
                          <p className="text-xs text-muted-foreground">{person.note}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
                <Button
                  variant={handRaised.roommate ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={() => setHandRaised(prev => ({ ...prev, roommate: !prev.roommate }))}
                >
                  {handRaised.roommate ? "“ Hand Raised" : "‹ Raise Your Hand - Looking for Roommate"}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="taxi">
              <Card className="p-4">
                <StaggerContainer staggerDelay={0.1} className="space-y-3">
                  {festival.taxiBuddiesList.map((person) => (
                    <StaggerItem key={person.id}>
                      <div className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-lg">
                          {person.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{person.name}</p>
                          <p className="text-xs text-muted-foreground">{person.note}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
                <Button
                  variant={handRaised.taxi ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={() => setHandRaised(prev => ({ ...prev, taxi: !prev.taxi }))}
                >
                  {handRaised.taxi ? "“ Hand Raised" : "‹ Raise Your Hand - Looking for Taxi Buddy"}
                </Button>
              </Card>
            </TabsContent>

            <TabsContent value="dance">
              <Card className="p-4">
                <StaggerContainer staggerDelay={0.1} className="space-y-3">
                  {festival.dancePartnersList.map((person) => (
                    <StaggerItem key={person.id}>
                      <div className="flex items-start gap-3 p-2 bg-muted/30 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-lg">
                          {person.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{person.name}</p>
                          <p className="text-xs text-muted-foreground">{person.note}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
                <Button
                  variant={handRaised.dance ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={() => setHandRaised(prev => ({ ...prev, dance: !prev.dance }))}
                >
                  {handRaised.dance ? "“ Hand Raised" : "‹ Raise Your Hand - Looking for Dance Partner"}
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </ScrollReveal>

      {/* Attendees */}
      <ScrollReveal animation="fadeUp" duration={0.8} delay={0.25}>
        <section className="px-4 py-12 mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            Attendees ({totalAttendees})
          </h2>

          <div className="flex gap-2 mb-4">
            <Button
              variant={attendeesTab === "going" ? "default" : "outline"}
              size="sm"
              onClick={() => setAttendeesTab("going")}
            >
              ‹ Going ({goingAttendees.length})
            </Button>
            <Button
              variant={attendeesTab === "interested" ? "default" : "outline"}
              size="sm"
              onClick={() => setAttendeesTab("interested")}
            >
              ‘€ Interested ({interestedAttendees.length})
            </Button>
          </div>

          <Card className="p-4">
            <StaggerContainer staggerDelay={0.05} className="grid grid-cols-5 gap-2">
              {(attendeesTab === "going" ? goingAttendees : interestedAttendees).slice(0, 20).map((attendee) => (
                <StaggerItem key={attendee.id}>
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                      {attendee.avatar}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-full">
                      {attendee.name.split(" ")[0]}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
            {(attendeesTab === "going" ? goingAttendees : interestedAttendees).length > 20 && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                +{(attendeesTab === "going" ? goingAttendees : interestedAttendees).length - 20} more
              </p>
            )}
          </Card>
        </section>
      </ScrollReveal>
    </div>
  );
};

export default FestivalDetail;


