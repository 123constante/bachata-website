import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown } from 'lucide-react';
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
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CityResult {
  city_id: string;
  city_name: string;
  city_slug: string;
  country_name: string;
  display_name: string;
}

export interface CityPickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function CityPicker({
  value,
  onChange,
  className,
  disabled,
  placeholder = 'Select city...',
}: CityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['search-cities', query],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('search_cities', {
        p_query: query,
        p_limit: 25,
      });

      if (error) throw error;
      return (data || []) as CityResult[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const selectedCity = React.useMemo(() => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    return cities.find((city) => city.city_name.toLowerCase() === normalized) || null;
  }, [cities, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          {value ? (
            <span className='truncate text-left'>{selectedCity?.display_name || value}</span>
          ) : (
            <span className='text-muted-foreground'>{placeholder}</span>
          )}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[320px] p-0'>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder='Search city...'
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Searching...' : 'No city found.'}</CommandEmpty>
            <CommandGroup>
              {cities.map((city) => (
                <CommandItem
                  key={city.city_id}
                  value={`${city.city_name} ${city.country_name}`}
                  onSelect={() => {
                    onChange(city.city_name);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.toLowerCase() === city.city_name.toLowerCase() ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span>{city.display_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default CityPicker;
