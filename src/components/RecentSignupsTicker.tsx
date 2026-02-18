import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Crown, DollarSign } from "lucide-react";

interface Activity {
  id: number;
  user: string;
  action: "joined" | "saved";
  detail: string;
  time: string;
}

const MOCK_ACTIVITIES: Activity[] = [
  { id: 1, user: "Sarah M.", action: "saved", detail: "saved £15 on Bachata Exchange", time: "2m ago" },
  { id: 2, user: "James K.", action: "joined", detail: "joined the VIP Guest List", time: "5m ago" },
  { id: 3, user: "Elena R.", action: "saved", detail: "got free entry to Salsa Fusion", time: "12m ago" },
  { id: 4, user: "Marcus P.", action: "joined", detail: "became a VIP Member", time: "15m ago" },
  { id: 5, user: "David L.", action: "saved", detail: "saved £10 on Urban Kiz", time: "28m ago" },
];

export const RecentSignupsTicker = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % MOCK_ACTIVITIES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const current = MOCK_ACTIVITIES[index];

  return (
    <div className="flex justify-center w-full my-6">
      <div className="bg-black/40 backdrop-blur-md rounded-full border border-white/10 px-6 py-2 flex items-center gap-3 shadow-xl">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
          <div className="w-2 h-2 bg-green-500 rounded-full" />
        </div>
        
        <div className="h-6 w-64 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center gap-2 text-xs md:text-sm"
            >
              <span className="font-bold text-white">{current.user}</span>
              <span className="text-gray-400">
                {current.action === "joined" ? "just joined" : "just saved"}
              </span>
              {current.action === "joined" ? (
                <Crown className="w-3 h-3 text-amber-500" />
              ) : (
                <DollarSign className="w-3 h-3 text-green-500" />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
