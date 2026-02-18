export const normalizeRequiredCity = (value?: string | null) => (value ?? "").trim();

export const hasRequiredCity = (value?: string | null) => normalizeRequiredCity(value).length > 0;
