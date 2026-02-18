import { useMemo, useState } from 'react';
import { Calendar, Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useFestivalEvents } from '@/hooks/useFestivalEvents';

interface FestivalPlansPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

const formatDate = (value: string | null) => {
  if (!value) return 'Date TBA';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date TBA';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

export const FestivalPlansPicker = ({ value, onChange }: FestivalPlansPickerProps) => {
  const { festivals, festivalMap, isLoading } = useFestivalEvents();
  const [search, setSearch] = useState('');

  const filteredFestivals = useMemo(() => {
    if (!search) return festivals;
    const searchLower = search.toLowerCase();
    return festivals.filter((festival) => {
      const haystack = `${festival.name} ${festival.city || ''}`.toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [festivals, search]);

  const toggleFestival = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((festivalId) => festivalId !== id));
      return;
    }
    onChange([...value, id]);
  };

  const removeFestival = (id: string) => {
    onChange(value.filter((festivalId) => festivalId !== id));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Selected Festivals</p>
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">No festival plans selected yet.</p>
        )}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((id) => {
              const festival = festivalMap[id];
              return (
                <Badge key={id} variant="secondary" className="flex items-center gap-1 text-xs">
                  <span>{festival?.name || id}</span>
                  <button
                    type="button"
                    onClick={() => removeFestival(id)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search festivals by name or city"
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading festivals...
          </div>
        )}

        {!isLoading && festivals.length === 0 && (
          <p className="text-sm text-muted-foreground">No festival events found.</p>
        )}

        {!isLoading && festivals.length > 0 && (
          <ScrollArea className="max-h-60 rounded-lg border">
            <div className="divide-y">
              {filteredFestivals.length === 0 && (
                <p className="text-sm text-muted-foreground p-4">No festivals match your search.</p>
              )}
              {filteredFestivals.map((festival) => {
                const isSelected = value.includes(festival.id);
                return (
                  <button
                    key={festival.id}
                    type="button"
                    onClick={() => toggleFestival(festival.id)}
                    className={cn(
                      'w-full text-left p-3 flex items-center justify-between gap-3 transition-colors',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted'
                    )}
                  >
                    <div>
                      <p className="font-medium text-sm">{festival.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {festival.city || 'City TBA'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(festival.start_time)}
                        </span>
                      </div>
                    </div>
                    <Badge variant={isSelected ? 'default' : 'outline'} className="text-[10px] uppercase">
                      {isSelected ? (
                        <span className="flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Remove
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          Add
                        </span>
                      )}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
