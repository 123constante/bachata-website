import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export interface CityOption {
  id: string;
  name: string;
  country_id?: string;
  display_name: string;
}

export interface DesktopCityPickerProps {
  value?: string;
  onChange: (cityId: string, cityObject?: CityOption) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  requestContext?: string;
  requestNotesLabel?: string;
  requestNotesPlaceholder?: string;
}

interface CitySearchResult {
  id: string;
  name: string;
  slug: string;
  country_name: string;
  display_name: string;
}

export function DesktopCityPicker({
  value,
  onChange,
  className,
  disabled,
  placeholder = 'Select city...',
  requestContext = 'general',
  requestNotesLabel = 'Notes (optional)',
  requestNotesPlaceholder = 'Anything else we should know?',
}: DesktopCityPickerProps) {
  const cityRequestsEnabled = import.meta.env.VITE_ENABLE_CITY_REQUESTS === 'true';
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false);
  const [requestCityName, setRequestCityName] = React.useState('');
  const [requestNotes, setRequestNotes] = React.useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false);
  
  const { toast } = useToast();
  const isUuidValue = Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['city-search', debouncedQuery],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('search_cities', {
        p_query: debouncedQuery,
        p_limit: 20,
      });

      if (error) throw error;

      if (import.meta.env.DEV) {
        console.debug('[DesktopCityPicker] search_cities raw response', {
          query: debouncedQuery,
          rows: data,
        });
      }
      
      return (data || []).map((row: any) => ({
        id: row.city_id || row.id,
        name: row.city_name || row.name,
        slug: row.city_slug || row.slug,
        country_name: row.country_name || '',
        display_name: row.display_name || `${row.city_name || row.name}${row.country_name ? `, ${row.country_name}` : ''}`
      })) as CitySearchResult[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch selected city details for display if value is an ID
  const { data: selectedCityDetails } = useQuery({
    queryKey: ['city-details', value],
    enabled: isUuidValue,
    queryFn: async () => {
      if (!value) return null;
      // Optimistic check in current search results
      const inSearch = searchResults.find(c => c.id === value);
      if (inSearch) return inSearch;

      const { data, error } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('id', value)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        country_name: '', // We simplify country logic here for display ID lookup
        display_name: data.name,
      } as CitySearchResult;
    },
    staleTime: Infinity,
  });

  const handleRequestCity = async () => {
    if (!requestCityName.trim()) {
      toast({ title: "Details required", description: "Please enter a city name.", variant: "destructive" });
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Please sign in", description: "You must be signed in to request a city.", variant: "destructive" });
        return;
      }

      // 1. Try to create request (non-blocking if table is not available yet)
      const requestPayload = {
        requested_name: requestCityName.trim(),
        requested_by: user.id,
        context: requestContext,
        notes: requestNotes.trim() || null,
      };

      const { error } = await (supabase.from as any)("city_requests").insert(requestPayload);

      const requestTableMissing = Boolean(
        error && (
          error.code === '42P01' ||
          error.message?.toLowerCase().includes('could not find the table') ||
          error.message?.toLowerCase().includes('schema cache')
        )
      );

      if (error && !requestTableMissing) throw error;

      if (requestTableMissing) {
        toast({
          title: "City requests temporarily unavailable",
          description: "Please try again later once city requests are enabled.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Requested", description: "We'll add it soon." });

      setRequestDialogOpen(false);
      setOpen(false);
      setRequestCityName('');
      setRequestNotes('');
    } catch (err: any) {
      toast({ title: "Error submitting request", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const displayName = selectedCityDetails?.display_name || value || placeholder;
  const isId = isUuidValue;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className={cn('w-full justify-between', className)}
            disabled={disabled}
          >
            <span className='truncate text-left'>
              {selectedCityDetails ? selectedCityDetails.display_name : (isId ? 'Loading city...' : placeholder)}
            </span>
            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[320px] p-0' align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder='Search city...'
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isSearching ? (
                 <div className="py-6 text-center text-sm text-muted-foreground">
                   <Loader2 className="mx-auto h-4 w-4 animate-spin mb-2" />
                   Searching...
                 </div>
              ) : (
                <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                  <p>No city found.</p>
                  {cityRequestsEnabled ? (
                    <Button 
                      variant="link" 
                      className="mt-2 h-auto p-0 text-primary underline-offset-4"
                      onClick={() => {
                        setRequestCityName(query.trim());
                        setRequestDialogOpen(true);
                      }}
                      disabled={!query.trim()}
                    >
                      Request "{query || 'a city'}"
                    </Button>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">City requests are temporarily unavailable.</p>
                  )}
                </CommandEmpty>
              )}
              
              <CommandGroup>
                {searchResults.map((city) => (
                  <CommandItem
                    key={city.id}
                    value={city.id}
                    onSelect={() => {
                      onChange(city.id, {
                        id: city.id,
                        name: city.name,
                        display_name: city.display_name
                      });
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === city.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span>{city.display_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              {cityRequestsEnabled && !isSearching && searchResults.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={() => setRequestDialogOpen(true)} className="cursor-pointer text-muted-foreground">
                      <Plus className="mr-2 h-4 w-4" />
                      Add a missing city...
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={cityRequestsEnabled && requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a City</DialogTitle>
            <DialogDescription>
              We'll review your request and add it to our database soon.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>City Name</Label>
              <Input 
                placeholder="e.g. Kyoto" 
                value={requestCityName}
                onChange={(e) => setRequestCityName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{requestNotesLabel}</Label>
              <Input 
                placeholder={requestNotesPlaceholder}
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRequestCity} disabled={isSubmittingRequest}>
              {isSubmittingRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DesktopCityPicker;
