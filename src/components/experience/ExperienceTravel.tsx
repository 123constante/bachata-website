import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";

export const ExperienceTravel = () => {
    const navigate = useNavigate();
    
    return (
        <section className="py-8 md:py-16 relative overflow-hidden">
          {/* Intense Orange/Warm Ambient Gradient - Top Right */}
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-orange-600/10 rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
          {/* Intense Orange/Warm Ambient Gradient - Bottom Left */}
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[100px] -z-10 -translate-x-1/3 translate-y-1/3" />
          
          <div className="max-w-7xl mx-auto px-4">
            <ScrollReveal animation="fadeUp" duration={0.8}>
                
                {/* Section Header */}
                <div className="flex flex-col gap-2 mb-12 md:mb-20">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 font-black text-xl md:text-2xl">
                          01
                        </div>
                        <div className="h-px bg-gradient-to-r from-orange-500/50 to-transparent flex-1" />
                        <span className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-orange-500">Global Travel</span>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
                  <div className="relative h-[400px] md:h-[550px] group perspective-1000">
                     {/* Image Card */}
                    <div className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-card transform transition-transform duration-700 group-hover:scale-[1.02]">
                        <img 
                        src="https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                        alt="International Dance Festival" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    </div>
                    
                    {/* Floating Info Card */}
                    <div className="absolute top-8 right-8 md:-right-6 bg-card/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-xl max-w-[200px] z-10 transition-transform duration-500 group-hover:-translate-y-2">
                         <div className="flex items-center gap-3 mb-2">
                           <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                           <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Next Up</span>
                         </div>
                         <div className="font-bold text-lg leading-tight mb-1">Croatia Summer</div>
                         <div className="text-xs text-muted-foreground">July 15-22, 2024</div>
                    </div>

                    <div className="absolute bottom-8 left-8 right-8">
                       <h3 className="text-2xl md:text-3xl font-bold mb-2 text-white">Safe Group Travel</h3>
                       <p className="text-gray-300 text-sm leading-relaxed">Join 150+ dancers on curated trips where we handle logistics, tickets, and accommodation.</p>
                    </div>
                  </div>

                  <div className="space-y-8 pl-0 md:pl-8">
                    <h2 className="text-4xl md:text-7xl font-black leading-tight text-white">
                      The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-600">Festival</span> Life.
                    </h2>
                    
                    <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                        Stop gambling on random events. We curate the global circuit to ensure you get the best workshops, safest venues, and highest level of dancing.
                    </p>
                      
                    <div className="grid gap-4 py-4">
                        {[
                          { title: "Curated Lineups", desc: "Only the best instructors" }, 
                          { title: "Group Deals", desc: "Save up to 30% on passes" }, 
                          { title: "Verified Safe", desc: "Vetted venues & hotels" }
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                            <div className="bg-orange-500/20 p-2 rounded-lg text-orange-500 mt-1">
                                <Check size={18} />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">{item.title}</h4>
                                <p className="text-sm text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <Button 
                        size="lg" 
                        className="rounded-full h-14 px-8 text-lg bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-900/20 w-full md:w-auto"
                        onClick={() => navigate('/festivals')}
                      >
                        View Verified Trips
                      </Button>
                    </div>
                  </div>
                </div>
            </ScrollReveal>
          </div>
        </section>
    );
};
