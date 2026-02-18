import { motion } from "framer-motion";
import { Heart, Music, Star, Sparkles, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import bachataLogo from "@/assets/bachata-calendar-logo.png";

const Footer = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  return (
    <footer className="mt-24 py-20 px-4 border-t border-primary/20 relative overflow-hidden">
      <motion.div 
        className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Auth CTA for non-logged-in users */}
        {!isLoading && !user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/20 via-festival-purple/10 to-festival-pink/20 border-primary/30">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <motion.div
                  className="text-5xl"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  ’ƒ
                </motion.div>
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                    Join the <span className="text-primary">Bachata Community</span>
                  </h3>
                  <p className="text-muted-foreground">
                    Sign in to connect with dancers, save your favorite events, and more!
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate("/auth")}
                    className="btn-primary"
                    size="lg"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/auth")}
                    size="lg"
                  >
                    Sign Up
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <div className="text-center">
          
          <p className="text-muted-foreground text-sm">
            Â© 2024 Bachata Calendar. Made with{' '}
            <motion.span
              className="inline-block text-primary"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              â™¥
            </motion.span>
            {' '}in London
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

