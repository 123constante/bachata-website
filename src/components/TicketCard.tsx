import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, QrCode, Clock } from "lucide-react";

interface TicketCardProps {
  event: {
    id: string;
    name: string;
    date: string;
    location?: string | null;
    image_url?: string | null;
  };
}

export const TicketCard = ({ event }: TicketCardProps) => {
  const eventDate = new Date(event.date);

  return (
    <Card className="relative overflow-hidden border-l-4 border-l-primary bg-card/50 hover:bg-card/80 transition-all group">
      <div className="flex flex-col sm:flex-row">
        {/* Left: Event Info */}
        <div className="flex-1 p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline" className="mb-2 text-xs border-primary/20 text-primary">
                Confirmed
              </Badge>
              <h3 className="font-bold text-lg leading-tight">{event.name}</h3>
            </div>
          </div>
          
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-foreground/70" />
              <span>{eventDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-foreground/70" />
                <span>{eventDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-foreground/70" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Ticket Action/Stub */}
        <div className="relative p-4 bg-muted/30 border-t sm:border-t-0 sm:border-l border-dashed border-border flex flex-col items-center justify-center gap-3 min-w-[140px]">
          {/* Decorative Circles for Stub look */}
          <div className="hidden sm:block absolute top-0 left-0 w-4 h-4 bg-background rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="hidden sm:block absolute bottom-0 left-0 w-4 h-4 bg-background rounded-full -translate-x-1/2 translate-y-1/2" />

          <div className="p-2 bg-white rounded-lg">
             <QrCode className="w-12 h-12 text-black" />
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs h-8">
            View Ticket
          </Button>
        </div>
      </div>
    </Card>
  );
};
