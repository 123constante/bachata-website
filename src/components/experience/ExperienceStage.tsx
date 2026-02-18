import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ScrollReveal";

export const ExperienceStage = () => {
    const navigate = useNavigate();
    return (
        <section className="py-8 md:py-16 relative overflow-hidden">
             {/* Strong Purple Spotlight */}
             <div className="absolute bottom-0 right-0 w-[800px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] -z-10" />
             
             <div className="max-w-7xl mx-auto px-4">
                <ScrollReveal animation="fadeUp" duration={0.8}>
                    
                    {/* Section Header */}
                    <div className="flex flex-col gap-2 mb-12 md:mb-20">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 font-black text-xl md:text-2xl">
                              03
                            </div>
                            <div className="h-px bg-gradient-to-r from-purple-500/50 to-transparent flex-1" />
                            <span className="text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-purple-500">Stage Training</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
                      <div className="relative h-[400px] md:h-[550px] group">
                         <div className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 bg-card">
                            <img 
                            src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                            alt="Dance Performance on Stage" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                         </div>
                        
                        {/* Course Details Badge */}
                         <div className="absolute top-8 -left-2 bg-purple-600 text-white p-4 rounded-r-xl shadow-xl z-20">
                            <div className="font-bold text-lg leading-none">12 Week</div>
                            <div className="text-purple-200 text-xs uppercase font-bold tracking-wider">Program</div>
                         </div>
                      </div>

                      <div className="space-y-8 pl-0 md:pl-8">
                        <h2 className="text-4xl md:text-7xl font-black leading-tight text-white">
                          Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-500">Courses</span>.
                        </h2>
                        
                        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                             Transformation happens on stage. Join a dedicated 12-week choreography course designed to take you from amateur to performer.
                        </p>

                         <div className="space-y-3">
                            {[
                                "No Professional Experience Needed",
                                "Costumes & Makeup Guidance",
                                "Guaranteed Stage Time"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 text-lg">
                                    <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                                        <Check size={16} />
                                    </div>
                                    <span className="text-gray-200">{item}</span>
                                </div>
                            ))}
                         </div>

                        <div className="flex gap-4 pt-6">
                          <Button 
                            size="lg" 
                            className="rounded-full h-14 px-8 text-lg bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20 w-full md:w-auto"
                            onClick={() => navigate('/choreography')}
                          >
                            Find Performance Teams
                          </Button>
                        </div>
                      </div>
                    </div>
                </ScrollReveal>
             </div>
        </section>
    );
};

