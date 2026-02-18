import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Attendee {
  id: string;
  name: string;
  avatar: string;
  status: "going" | "interested";
}

interface AttendeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  attendees: Attendee[];
  isLoggedIn: boolean;
  onLoginPrompt: () => void;
}

export const AttendeesModal = ({
  open,
  onOpenChange,
  eventTitle,
  attendees,
  isLoggedIn,
  onLoginPrompt,
}: AttendeesModalProps) => {
  const [activeTab, setActiveTab] = useState<"going" | "interested">("going");
  
  const goingCount = attendees.filter(a => a.status === "going").length;
  const interestedCount = attendees.filter(a => a.status === "interested").length;
  const filteredAttendees = attendees.filter(a => a.status === activeTab);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl max-h-[70vh] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">{eventTitle}</h3>
                <p className="text-xs text-muted-foreground">Who's attending</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Tabs */}
            <div className="px-4 pb-3 flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab("going")}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === "going" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Users className="w-4 h-4" />
                Going ({goingCount})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab("interested")}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === "interested" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Eye className="w-4 h-4" />
                Interested ({interestedCount})
              </motion.button>
            </div>
            
            {/* Attendee List */}
            <div className="px-4 pb-6 overflow-y-auto max-h-[40vh]">
              {!isLoggedIn ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Login to see who's attending
                  </p>
                  <Button onClick={onLoginPrompt} className="rounded-full">
                    Login to View
                  </Button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {filteredAttendees.map((attendee, index) => (
                    <motion.div
                      key={attendee.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      whileHover={{ scale: 1.1 }}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center text-xl">
                        {attendee.avatar}
                      </div>
                      <span className="text-[10px] text-muted-foreground text-center truncate w-full">
                        {attendee.name}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
