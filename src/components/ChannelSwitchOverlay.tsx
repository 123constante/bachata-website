import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ChannelSwitchOverlay = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 900);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.3, delay: 0.6 }}
    >
      {/* Static noise layer */}
      <div className="absolute inset-0 bg-neutral-900">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
            animation: "channel-static 0.1s steps(3) infinite",
          }}
        />
      </div>

      {/* Horizontal glitch bars */}
      <motion.div
        className="absolute left-0 right-0 h-1 bg-white/30"
        initial={{ top: "20%" }}
        animate={{ top: ["20%", "80%", "10%", "60%"] }}
        transition={{ duration: 0.4, ease: "linear" }}
      />
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-white/20"
        initial={{ top: "50%" }}
        animate={{ top: ["50%", "10%", "70%", "30%"] }}
        transition={{ duration: 0.3, ease: "linear" }}
      />

      {/* Brief white flash */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 0.15, delay: 0.35 }}
      />

      {/* Channel number */}
      <motion.div
        className="absolute top-8 right-8 font-mono text-white/70 text-2xl font-bold"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.6, delay: 0.2, times: [0, 0.1, 0.7, 1] }}
      >
        CH-04
      </motion.div>
    </motion.div>
  );
};

export const useChannelSwitch = () => {
  const [showStatic, setShowStatic] = useState(true);

  return {
    showStatic,
    ChannelOverlay: () => (
      <AnimatePresence>
        {showStatic && (
          <ChannelSwitchOverlay onComplete={() => setShowStatic(false)} />
        )}
      </AnimatePresence>
    ),
  };
};
