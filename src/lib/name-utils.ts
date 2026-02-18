type NameSource = {
  first_name?: string | null;
  surname?: string | null;
  name?: string | null;
};

type PublicNameSource = NameSource & { hide_surname?: boolean | null };

const clean = (value?: string | null) => (value ?? '').trim();

export const buildFullName = (firstName?: string | null, surname?: string | null) => {
  const first = clean(firstName);
  const last = clean(surname);
  return [first, last].filter(Boolean).join(' ').trim();
};

export const splitNameFromString = (input?: string | null) => {
  const safe = clean(input).replace(/\s+/g, ' ').trim();
  if (!safe) {
    return { firstName: '', surname: '' };
  }

  const [first, ...rest] = safe.split(' ');
  return {
    firstName: first,
    surname: rest.join(' ').trim(),
  };
};

export const extractNameParts = (source: NameSource) => {
  const existingFirst = clean(source.first_name);
  const existingSurname = clean(source.surname);

  if (existingFirst) {
    return { firstName: existingFirst, surname: existingSurname };
  }

  const fallback = clean(source.name);
  return splitNameFromString(fallback);
};

export const getPublicName = (source: PublicNameSource, fallback = 'Dancer') => {
  const { firstName, surname } = extractNameParts(source);
  if (!firstName && !surname) return fallback;
  if (source.hide_surname) {
    return firstName || fallback;
  }
  const full = buildFullName(firstName, surname);
  return full || fallback;
};

export const getInitials = (source: NameSource, fallback = 'ME') => {
  const { firstName, surname } = extractNameParts(source);
  const initials = [firstName, surname]
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part!.charAt(0).toUpperCase())
    .join('');

  return initials || fallback;
};

export const normalizeDancerRecord = <T extends NameSource>(record: T) => {
  const { firstName, surname } = extractNameParts(record);
  const rest = record as any;
  return {
    ...rest,
    first_name: firstName,
    surname,
  } as T & { first_name: string; surname: string };
};

export const normalizeUserMetadata = (metadata: Record<string, unknown> | undefined | null) => {
  const lookup = (key: string) => {
    if (!metadata || typeof metadata !== 'object') return undefined;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  };

  const { firstName, surname } = extractNameParts({
    first_name: lookup('first_name'),
    surname: lookup('surname'),
    name: lookup('name'),
  });

  return {
    first_name: firstName,
    surname,
  };
};
