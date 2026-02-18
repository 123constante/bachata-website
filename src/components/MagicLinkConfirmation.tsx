import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Calendar, GraduationCap, Music, Camera, ShoppingBag, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerMicroConfetti } from '@/lib/confetti';

const ROLE_META: Record<string, { label: string; icon: typeof User }> = {
  dancer: { label: 'Dancer', icon: User },
  organiser: { label: 'Organiser', icon: Calendar },
  teacher: { label: 'Teacher', icon: GraduationCap },
  dj: { label: 'DJ', icon: Music },
  videographer: { label: 'Videographer', icon: Camera },
  vendor: { label: 'Vendor', icon: ShoppingBag },
};

interface MagicLinkConfirmationProps {
  email: string;
  onResend: () => Promise<void>;
  onChangeEmail: () => void;
  /** Optional role key to display, e.g. "dancer" */
  role?: string;
  /** Optional extra action, e.g. "Continue browsing" */
  extraAction?: { label: string; onClick: () => void };
}

const COOLDOWN = 30;

const MagicLinkConfirmation = ({ email, onResend, onChangeEmail, role, extraAction }: MagicLinkConfirmationProps) => {
  const roleMeta = role ? ROLE_META[role] : undefined;
  const [countdown, setCountdown] = useState(COOLDOWN);
  const [isResending, setIsResending] = useState(false);
  const iconRef = useRef<HTMLDivElement>(null);
  const hasFiredConfetti = useRef(false);

  // Fire confetti once on mount
  useEffect(() => {
    if (hasFiredConfetti.current) return;
    hasFiredConfetti.current = true;
    const timer = setTimeout(() => {
      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        triggerMicroConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResend();
      setCountdown(COOLDOWN);
      // Fire confetti again
      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        triggerMicroConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center text-center space-y-4 py-4"
    >
      {/* Animated mail icon */}
      <motion.div
        ref={iconRef}
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="relative"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-festival-teal/40 to-cyan-400/40 border border-festival-teal/50 flex items-center justify-center shadow-lg shadow-festival-teal/20">
          <Mail className="w-7 h-7 text-cyan-300" />
        </div>
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 20px 4px hsl(var(--primary) / 0.3)' }}
        />
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-1.5"
      >
        <h3 className="text-lg font-bold">Magic link sent! ✨</h3>
        <p className="text-sm text-muted-foreground">
          We sent a link to <strong className="text-foreground">{email}</strong>.
          <br />Check your inbox and click to continue.
        </p>
        {roleMeta && (
          <div className="inline-flex items-center gap-1.5 mx-auto mt-1 px-3 py-1 rounded-full border border-festival-teal/30 bg-festival-teal/10 text-xs text-foreground/90">
            <roleMeta.icon className="w-3.5 h-3.5 text-cyan-300" />
            <span>Signing up as <strong>{roleMeta.label}</strong></span>
          </div>
        )}
      </motion.div>

      {/* Resend button with countdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-2"
      >
        <Button
          variant="outline"
          className="w-full border-festival-teal/30"
          disabled={countdown > 0 || isResending}
          onClick={handleResend}
        >
          {isResending
            ? 'Sending…'
            : countdown > 0
              ? `Resend in ${countdown}s`
              : 'Resend magic link'}
        </Button>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onChangeEmail}>
          Use a different email
        </Button>

        {extraAction && (
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={extraAction.onClick}>
            {extraAction.label}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default MagicLinkConfirmation;
