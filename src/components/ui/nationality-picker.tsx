import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { loadCountries, getLoadedCountries, type Country } from '@/constants/countries';

export interface NationalityPickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const FlagIcon = ({ country, className }: { country: Country; className?: string }) => {
  const [failed, setFailed] = React.useState(false);

  if (failed || !country.flagUrl) {
    return (
      <span className={cn('text-lg leading-none', className)} aria-hidden>
        {country.flag}
      </span>
    );
  }

  return (
    <img
      src={country.flagUrl}
      alt={`${country.name} flag`}
      className={cn('w-6 h-4 rounded-sm object-cover', className)}
      loading='lazy'
      onError={() => setFailed(true)}
    />
  );
};

export function NationalityPicker({ value, onChange, className, disabled }: NationalityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [countries, setCountries] = React.useState<Country[]>(getLoadedCountries);

  React.useEffect(() => {
    loadCountries().then(setCountries);
  }, []);

  const selectedCountry = React.useMemo(() => {
    if (!value) return null;
    const normalized = value.toLowerCase().trim();
    return countries.find(c =>
      c.name.toLowerCase() === normalized ||
      c.code.toLowerCase() === normalized
    );
  }, [value, countries]);

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
          {selectedCountry ? (
            <span className='flex items-center gap-2'>
              <FlagIcon country={selectedCountry} />
              <span className='truncate'>{selectedCountry.name}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>Select nationality...</span>
          )}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[300px] p-0'>
        <Command>
          <CommandInput placeholder='Search country...' />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={country.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? '' : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value?.toLowerCase() === country.name.toLowerCase() ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                    <FlagIcon country={country} className='mr-2' />
                  {country.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
