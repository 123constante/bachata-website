import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface DancerProfileChecklistCardProps {
  city?: string | null;
  nationality?: string | null;
  looking_for_partner?: boolean | null;
  onAction?: () => void;
}

export const DancerProfileChecklistCard = ({
  city,
  nationality,
  looking_for_partner,
  onAction,
}: DancerProfileChecklistCardProps) => {
  const items = [
    {
      key: "location",
      label: "Add city + nationality",
      completed: Boolean(city && nationality),
    },
    {
      key: "partner",
      label: "Enable partner search",
      completed: Boolean(looking_for_partner),
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);
  const isComplete = completedCount === items.length;

  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Profile checklist</p>
            <p className="text-xs text-muted-foreground">Keep going to unlock more matches.</p>
          </div>
          <span className="text-xs font-semibold text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-cyan-300" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={item.completed ? "text-muted-foreground" : "text-foreground"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        {!isComplete && onAction && (
          <Button size="sm" variant="outline" onClick={onAction} className="w-full">
            Complete now
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
