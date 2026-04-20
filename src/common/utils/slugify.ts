const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const NON_ALPHANUM_REGEX = /[^a-z0-9]+/g;
const EDGE_HYPHENS_REGEX = /^-+|-+$/g;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(NON_ALPHANUM_REGEX, "-")
    .replace(EDGE_HYPHENS_REGEX, "")
    .slice(0, 255);
}

export function slugifyWithSuffix(input: string, suffix: string): string {
  const base = slugify(input);
  const safeSuffix = slugify(suffix);
  if (!safeSuffix) return base;
  return `${base}-${safeSuffix}`.slice(0, 255);
}
