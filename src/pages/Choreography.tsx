import { useState } from "react";
import PageHero from "@/components/PageHero";
import { Users, Calendar, Trophy, Sparkles, MapPin, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEAMS = [
  {
    id: 1,
    name: "Island Touch Team",
    city: "New York & Global",
    level: "All Levels",
    style: "Touch Style",
    image: "https://images.unsplash.com/photo-1545959588-8b2b73ee855f?auto=format&fit=crop&q=80&w=800",
    nextSeason: "March 2024",
    spots: 5
  },
  {
    id: 2,
    name: "Daniel & Desiree WTP",
    city: "Global Franchise",
    level: "Intermediate+",
    style: "Sensual",
    image: "https://images.unsplash.com/photo-1508700929628-666bc8763ce7?auto=format&fit=crop&q=80&w=800",
    nextSeason: "Feb 2024",
    spots: 12
  },
  {
    id: 3,
    name: "Local Performance Co.",
    city: "London, UK",
    level: "Advanced",
    style: "Moderna",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=800",
    nextSeason: "April 2024",
    spots: 2
  }
];

const Choreography = () => {
  return (
    <div className="min-h-screen">
      <PageHero 
        titleWhite="Join the"
        titleOrange="Stage"
        subtitle="Transform from social dancer to performer. Find intensive choreography teams and performance courses near you."
        emoji=""
        gradientFrom="purple-600"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Value Prop Banner */}
        <section className="mb-16 grid md:grid-cols-3 gap-8 text-center md:text-left">
            <div className="space-y-2 p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                <div className="h-10 w-10 bg-purple-500/20 text-purple-500 rounded-lg flex items-center justify-center mb-4 mx-auto md:mx-0">
                    <Users size={20} />
                </div>
                <h3 className="font-bold text-lg">Community</h3>
                <p className="text-muted-foreground text-sm">Train with the same group for 3-6 months and build lifelong friendships.</p>
            </div>
            <div className="space-y-2 p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                <div className="h-10 w-10 bg-purple-500/20 text-purple-500 rounded-lg flex items-center justify-center mb-4 mx-auto md:mx-0">
                    <Trophy size={20} />
                </div>
                <h3 className="font-bold text-lg">Challenge</h3>
                <p className="text-muted-foreground text-sm">Push your limits with complex choreography tailored to stage performance.</p>
            </div>
            <div className="space-y-2 p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10">
                <div className="h-10 w-10 bg-purple-500/20 text-purple-500 rounded-lg flex items-center justify-center mb-4 mx-auto md:mx-0">
                    <Sparkles size={20} />
                </div>
                <h3 className="font-bold text-lg">Spotlight</h3>
                <p className="text-muted-foreground text-sm">Perform at local festivals and congresses in full costume.</p>
            </div>
        </section>

        {/* Teams Grid */}
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="bg-purple-600 h-6 w-1 rounded-full"/> Open Auditions
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEAMS.map((team) => (
            <div key={team.id} className="bg-card rounded-2xl overflow-hidden border border-border group hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <div className="h-48 relative overflow-hidden">
                    <img src={team.image} alt={team.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full">
                        {team.level}
                    </div>
                </div>
                
                <div className="p-6">
                    <h3 className="text-xl font-bold mb-1 group-hover:text-purple-500 transition-colors">{team.name}</h3>
                    <div className="flex items-center text-muted-foreground text-sm mb-4">
                        <MapPin size={14} className="mr-1" /> {team.city}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <div className="bg-secondary/50 p-2 rounded-lg text-center">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Style</div>
                            <div className="font-semibold text-sm">{team.style}</div>
                        </div>
                        <div className="bg-secondary/50 p-2 rounded-lg text-center">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Start</div>
                            <div className="font-semibold text-sm">{team.nextSeason}</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 size={16} className="text-green-500" />
                            <span>{team.spots} spots remaining</span>
                        </div>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700">Apply for Audition</Button>
                    </div>
                </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Choreography;

