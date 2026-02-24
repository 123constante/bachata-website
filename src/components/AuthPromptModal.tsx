import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { stashPendingReturnTo } from "@/lib/authRouting";

interface AuthPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  returnTo?: string | null;
}

const AuthPromptModal = ({
  open,
  onOpenChange,
  title = "Join the Community",
  description = "To connect with other dancers, you need to be logged in.",
  returnTo = null,
}: AuthPromptModalProps) => {
  const navigate = useNavigate();

  const handleNavigate = (mode: "signin" | "signup") => {
    if (!returnTo) {
      onOpenChange(false);
      return;
    }

    stashPendingReturnTo(returnTo);
    navigate(`/auth?mode=${mode}&returnTo=${encodeURIComponent(returnTo)}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="text-center space-y-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-6">
          <Button
            size="lg"
            className="w-full h-11 font-semibold"
            onClick={() => {
              handleNavigate("signin");
            }}
          >
            Log In
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full h-11 font-semibold"
            onClick={() => {
              handleNavigate("signup");
            }}
          >
            Sign Up
          </Button>
          <Button variant="ghost" className="w-full h-10" onClick={() => onOpenChange(false)}>
            Continue browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { AuthPromptModal };
