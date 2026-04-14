import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export interface CityOption {
  id: string;
  name: string;
  display_name: string;
}

export interface MobileCityPickerProps {
  value?: string;
  onChange: (cityId: string, cityObject?: CityOption) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

interface CitySearchResult {
  city_id: string;
  city_name: string;
  city_slug: string;
  country_name: string;
  display_name: string;
}

export function MobileCityPicker({
  value,
  onChange,
  className,
  disabled,
  placeholder = 'Select city...',
}: MobileCityPickerProps) {

  const cityRequestsEnabled =
    import.meta.env.VITE_ENABLE_CITY_REQUESTS === 'true';

  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] =
    React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const bottomSheetRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const isUuidValue = Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );

  // Debounce typing
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  // Search cities (only when open AND 2+ chars)
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['city-search', debouncedQuery],
    enabled: isOpen && debouncedQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        'search_cities',
        {
          p_query: debouncedQuery,
          p_limit: 20,
        }
      );

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch selected city for display
  const { data: selectedCityDetails } = useQuery({
    queryKey: ['city-details', value],
    enabled: isUuidValue,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name')
        .eq('id', value)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });

  const handleCitySelect = (city: CitySearchResult) => {
    onChange(city.city_id, {
      id: city.city_id,
      name: city.city_name,
      display_name: `${city.city_name}, ${city.country_name}`,
    });

    setIsOpen(false);
    setQuery('');
  };

  const handleClearSelection = () => {
    onChange('', undefined);
    setQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleRequestCity = async () => {
    const cityName = query.trim();
    if (!cityName) return;

    setIsSubmittingRequest(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Please sign in",
          variant: "destructive",
        });
        return;
      }

      await (supabase.from as any)("city_requests").insert({
        requested_name: cityName,
        requested_by: user.id,
        context: 'mobile_picker',
      });

      toast({ title: "Requested", description: "We'll add it soon." });

      setIsOpen(false);
      setQuery('');

    } catch (err: any) {
      toast({
        title: "Error submitting request",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />

        <Input
          ref={inputRef}
          type="text"
          placeholder={
            selectedCityDetails
              ? selectedCityDetails.name
              : placeholder
          }
          className={cn(
            'pl-10',
            selectedCityDetails && 'pr-10'
          )}
          value={selectedCityDetails ? '' : query}
          onChange={(e) => {
            if (!selectedCityDetails) {
              setQuery(e.target.value);
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (!selectedCityDetails) {
              setIsOpen(true);
            }
          }}
          disabled={disabled || !!selectedCityDetails}
        />

        {selectedCityDetails && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={bottomSheetRef}
          className="fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-2xl shadow-2xl z-50 max-h-[50vh] overflow-y-auto"
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {isSearching ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
              Searching...
            </div>
          ) : (
            <>
              {searchResults.length > 0 ? (
                <div className="pb-4">
                  {searchResults.map((city) => (
                    <button
                      key={city.city_id}
                      type="button"
                      onClick={() => handleCitySelect(city)}
                      className="w-full flex items-center gap-3 px-6 py-4 hover:bg-muted/50 text-left"
                    >
                      <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                      <span>
                        {city.city_name}, {city.country_name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : debouncedQuery.length >= 2 ? (
                <div className="py-12 text-center text-sm text-muted-foreground px-6">
                  <p>No cities found.</p>

                  {cityRequestsEnabled && (
                    <button
                      type="button"
                      onClick={handleRequestCity}
                      disabled={isSubmittingRequest}
                      className="mt-4 w-full flex items-center justify-center gap-3 px-6 py-4 text-primary rounded-md"
                    >
                      {isSubmittingRequest ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                      Add "{query}"
                    </button>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MobileCityPicker;