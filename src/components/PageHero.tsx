import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ScrollReveal";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { Sparkles, Star, Heart, Music, Zap, PartyPopper, LucideIcon } from "lucide-react";

interface HeroWidget {
  emoji: string;
  title: string;
  desc: string;
  sectionId?: string;
}

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeroProps {
  emoji: string;
  titleWhite: string;
  titleOrange: string;
  subtitle: string;
  children?: React.ReactNode;
  widgets?: HeroWidget[];
  gradientFrom?: string;
  floatingIcons?: LucideIcon[];
  largeTitle?: boolean;
  card3DEffect?: boolean;
  breadcrumbItems?: BreadcrumbItem[];
  topPadding?: string;
  highlightColor?: string;
  hideBackground?: boolean;
}

const defaultIcons: LucideIcon[] = [Sparkles, Star, Heart, Music, Zap, PartyPopper];

const PageHero = ({
  emoji,
  titleWhite,
  titleOrange,
  subtitle,
  children,
  widgets,
  gradientFrom = "primary",
  floatingIcons = defaultIcons,
  largeTitle = false,
  card3DEffect = false,
  breadcrumbItems,
  topPadding = "pt-8",
  highlightColor = "text-primary",
  hideBackground = false,
}: PageHeroProps) => {
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <ScrollReveal animation="fadeUp" duration={0.8}>
      <section className={`relative px-4 ${topPadding} pb-10 overflow-hidden`}>
        {/* Animated gradient background */}
        {!hideBackground && (
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br from-${gradientFrom}/20 via-festival-purple/10 to-festival-pink/15`}
            animate={{
              backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ backgroundSize: "200% 200%" }}
          />
        )}
        
        {/* Overlay gradient for smooth fade */}
        {!hideBackground && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        )}

        {/* Breadcrumb inside hero section */}
        {breadcrumbItems && breadcrumbItems.length > 0 && (
          <div className="relative z-10">
            <PageBreadcrumb items={breadcrumbItems} />
          </div>
        )}

        {/* Floating icons */}
        {floatingIcons.slice(0, 6).map((Icon, i) => (
          <motion.div
            key={i}
            className="absolute text-primary/20 pointer-events-none"
            style={{
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [0, -20, 0, 20, 0],
              x: [0, 10, -10, 5, 0],
              rotate: [0, 180, 360],
              scale: [1, 1.2, 0.9, 1.1, 1],
            }}
            transition={{
              duration: 6 + i * 0.5,
              delay: i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Icon size={24 + i * 4} />
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center"
        >
          {/* Animated Emoji with enhanced bounce */}
          <motion.div
            animate={{ 
              scale: [1, 1.15, 1], 
              rotate: [-5, 5, -5],
              y: [0, -8, 0]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`${largeTitle ? 'text-7xl md:text-9xl' : 'text-4xl'} mb-4`}
          >
            {emoji}
          </motion.div>

          {/* Two-tone Title with animated orange part */}
          <h1 className={`font-black mb-2 tracking-tight ${largeTitle ? 'text-5xl md:text-7xl lg:text-8xl' : 'text-3xl md:text-4xl'}`}>
            <span className="text-foreground">{titleWhite}</span>{" "}
            <motion.span 
              className={`${highlightColor} inline-block`}
              animate={{ 
                scale: [1, 1.02, 1],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              {titleOrange}
            </motion.span>
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto mb-6">
              {subtitle}
            </p>
          )}

          {children}

          {/* Compact Widgets */}
          {widgets && widgets.length > 0 && (
            <div className={`flex flex-wrap justify-center gap-2 mt-6 ${card3DEffect ? 'perspective-[1000px]' : ''}`} style={card3DEffect ? { perspective: '1000px' } : {}}>
              {widgets.map((widget, i) => {
                // Calculate rotation for 3D playing card effect
                const totalWidgets = widgets.length;
                const middleIndex = (totalWidgets - 1) / 2;
                const rotation = card3DEffect ? (i - middleIndex) * 8 : 0;
                const translateZ = card3DEffect ? Math.abs(i - middleIndex) * -10 : 0;
                
                return (
                  <motion.div
                    key={widget.title}
                    initial={{ opacity: 0, y: 20, rotateY: rotation * 2 }}
                    animate={{ opacity: 1, y: 0, rotateY: rotation }}
                    transition={{ delay: 0.1 * i, type: "spring", stiffness: 100 }}
                    whileHover={{ 
                      scale: 1.1, 
                      y: -8, 
                      rotateY: 0,
                      z: 50,
                      boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => widget.sectionId && scrollToSection(widget.sectionId)}
                    className="cursor-pointer bg-card/80 backdrop-blur-md border border-border/50 hover:border-primary/50 rounded-xl p-3 transition-all shadow-lg hover:shadow-xl w-[70px] sm:w-[75px] sm:min-w-[70px] sm:max-w-[80px]"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: card3DEffect ? `rotateY(${rotation}deg) translateZ(${translateZ}px)` : undefined,
                      boxShadow: card3DEffect 
                        ? `0 ${8 + Math.abs(translateZ) * 0.5}px ${16 + Math.abs(translateZ)}px rgba(0,0,0,0.2), 
                           inset 0 1px 0 rgba(255,255,255,0.1)` 
                        : undefined,
                    }}
                  >
                    <motion.span 
                      className="text-xl block mb-1"
                      animate={{ rotate: [-3, 3, -3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                    >
                      {widget.emoji}
                    </motion.span>
                    <h3 className="text-[10px] font-bold text-foreground leading-tight">{widget.title}</h3>
                    <p className="text-[8px] text-muted-foreground leading-tight">{widget.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </section>
    </ScrollReveal>
  );
};

export default PageHero;

