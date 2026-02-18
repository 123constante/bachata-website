import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Music, Camera, Plane, Users, Zap } from "lucide-react";
import PageHero from "@/components/PageHero";
import { FloatingElements } from "@/components/FloatingElements";
import { ExperienceTravel } from "@/components/experience/ExperienceTravel";
import { ExperienceMedia } from "@/components/experience/ExperienceMedia";
import { ExperienceStage } from "@/components/experience/ExperienceStage";
import { FolderTabs } from "@/components/experience/FolderTabs";

type TabId = 'travel' | 'media' | 'stage';

const TABS = {
  travel: {
    id: 'travel',
    label: 'Travel',
    color: 'text-orange-500',
    highlightColor: 'text-orange-500',
    hero: {
      emoji: "\u{1F30E}",
      titleWhite: "The Global",
      titleOrange: "Movement",
      subtitle: "Join the international circuit. Festivals, congresses, and destination events.",
      gradientFrom: "orange-600",
      floatingIcons: [Plane, Users, Sparkles]
    }
  },
  media: {
    id: 'media',
    label: 'Cinema',
    color: 'text-blue-500',
    highlightColor: 'text-blue-500',
    hero: {
      emoji: "\u{1F3A5}",
      titleWhite: "Music",
      titleOrange: "Video",
      subtitle: "Professional 4K music videos for artists who demand perfection. Reels ready.",
      gradientFrom: "blue-600",
      floatingIcons: [Camera, Zap, Sparkles]
    }
  },
  stage: {
    id: 'stage',
    label: 'Training',
    color: 'text-purple-500',
    highlightColor: 'text-purple-500',
    hero: {
      emoji: "\u{1F483}",
      titleWhite: "Stage",
      titleOrange: "Performance",
      subtitle: "Intensive 12-week choreography courses ending in a showcase.",
      gradientFrom: "purple-600",
      floatingIcons: [Music, Sparkles, Users]
    }
  }
};

const Experience = () => {
  const [activeTab, setActiveTab] = useState<TabId>('travel');
  const activeConfig = TABS[activeTab] as any; // Quick fix for type inference if needed, though TABS values are consistent

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      
      {/* Header Section (Hero + Tabs) with Shared Background */}
      <div className="relative">
         {/* Classes Style Background */}
         <motion.div 
            className="absolute inset-0 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20"
            animate={{ 
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
            style={{ backgroundSize: '200% 200%' }}
         />
         
         <div className="absolute inset-0 pointer-events-none z-0">
            <FloatingElements count={10} />
         </div>

         <div className="pt-2 relative z-10 min-h-[50vh] flex flex-col justify-center">
            <PageHero 
                key={activeTab}
                emoji={activeConfig.hero.emoji}
                titleWhite={activeConfig.hero.titleWhite}
                titleOrange={activeConfig.hero.titleOrange}
                subtitle={activeConfig.hero.subtitle}
                gradientFrom={activeConfig.hero.gradientFrom}
                floatingIcons={activeConfig.hero.floatingIcons}
                highlightColor={activeConfig.highlightColor}
                largeTitle
                breadcrumbItems={[{ label: 'Experience' }, { label: activeConfig.label }]}
                hideBackground={true}
                topPadding="pt-20 pb-20"
            />
         </div>

         {/* Navigation Tabs */}
         <div className="relative z-20">
            <FolderTabs activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />
         </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 w-full bg-background/50">
        <div className="max-w-7xl mx-auto px-4 py-8 min-h-[50vh]">
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    {activeTab === 'travel' && <ExperienceTravel />}
                    {activeTab === 'media' && <ExperienceMedia />}
                    {activeTab === 'stage' && <ExperienceStage />}
                </motion.div>
            </AnimatePresence>
        </div>
      </div>

    </div>
  );
};

export default Experience;


