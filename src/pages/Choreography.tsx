import PageHero from "@/components/PageHero";
import { Users, Trophy, Sparkles } from "lucide-react";

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
            <p className="text-muted-foreground text-sm">Train with the same group for 3–6 months and build lifelong friendships.</p>
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

        {/* Open Auditions — coming soon */}
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span className="bg-purple-600 h-6 w-1 rounded-full" /> Open Auditions
        </h2>

        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-purple-500/20 bg-purple-500/5">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">No open auditions yet</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Choreography teams and performance courses will be listed here once available. Check back soon.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Choreography;

