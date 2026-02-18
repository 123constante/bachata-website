import { useNavigate } from "react-router-dom";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";

export const ExperienceMedia = () => {
    const navigate = useNavigate();
    return (
        <section className="py-8 md:py-16 relative overflow-hidden">
             
             {/* Stronger Blue Ambient Light */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] -z-10" />

             <div className="max-w-7xl mx-auto px-4 relative z-10">
                <ScrollReveal animation="fadeUp" duration={0.8}>
                    
                    {/* Section Header */}
                    <div className="flex flex-col gap-2 mb-12 md:mb-20">
                        <div className="flex flex-col md:flex-row-reverse items-start md:items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 font-black text-xl md:text-2xl">
                              02
                            </div>
                            <div className="h-px w-full md:w-auto bg-gradient-to-r md:bg-gradient-to-l from-blue-500/50 to-transparent flex-1" />
                            <span className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-blue-500">Concept Video</span>
                        </div>
                    </div>

                    {/* Fixed HTML Order for Mobile Rhythm (Image First, Text Second) */}
                    {/* Desktop swaps visually to maintain Zig-Zag */}
                    <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
                      
                      {/* Image Side (Shows First on Mobile, Right on Desktop) */}
                      <div className="relative h-[400px] md:h-[550px] group md:order-2">
                        <div className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-background">
                            <img 
                            src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                            alt="Cinematic Dance Recording" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        </div>
                        
                        {/* Technical Badge */}
                         <div className="absolute top-6 right-6 flex gap-2">
                            <span className="bg-black/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-mono border border-white/20">4K 60FPS</span>
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                              REC
                            </span>
                         </div>
                      </div>

                      {/* Content Side (Shows Second on Mobile, Left on Desktop) */}
                      <div className="space-y-8 pr-0 md:pr-8 text-left md:text-right md:order-1">
                        <h2 className="text-4xl md:text-7xl font-black leading-tight text-white">
                          Music <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Video</span>.
                        </h2>
                        
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed ml-auto">
                           Your dancing deserves more than a shaky phone recording. We shoot cinematic 4K videos optimized for Instagram Reels.
                        </p>
                        
                        <div className="grid gap-4 py-4 md:grid-cols-1"> 
                            {[
                              { title: "Vertical 9:16", desc: "Optimized for Instagram & TikTok" },
                              { title: "Cinematic Look", desc: "Professional lighting and color" },
                              { title: "24h Delivery", desc: "Post it while the hype is fresh" }
                            ].map((item, i) => (
                              <div key={i} className="flex md:flex-row-reverse items-center gap-4 p-4 rounded-xl bg-background/50 border border-white/5 hover:bg-background transition-colors text-left md:text-right">
                                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400 shrink-0">
                                    <Camera size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{item.title}</h4>
                                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                                </div>
                              </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-4 justify-start md:justify-end">
                          <Button 
                            size="lg" 
                            className="rounded-full h-14 px-8 text-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 border-none w-full md:w-auto"
                            onClick={() => navigate('/videographers')}
                          >
                           Book Your Video
                          </Button>
                        </div>
                      </div>

                    </div>
                </ScrollReveal>
             </div>
        </section>
    );
};


