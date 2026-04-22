export type ImageEntity =
  | "product"
  | "asset"
  | "decoration"
  | "category"
  | "hero";

export interface BuildR2KeyInput {
  tenantSlug: string;
  entity: ImageEntity;
  sourceId: string;
  originalUrl: string;
}

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
]);

function extensionFromUrl(url: string): string {
  const withoutQuery = url.split("?")[0];
  const lastDot = withoutQuery.lastIndexOf(".");
  if (lastDot === -1) return "bin";
  const raw = withoutQuery.slice(lastDot + 1).toLowerCase();
  if (raw.length === 0 || raw.length > 5) return "bin";
  if (!ALLOWED_EXTENSIONS.has(raw)) return "bin";
  return raw;
}

function sanitizeSourceId(sourceId: string): string {
  return sourceId.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function buildR2Key(input: BuildR2KeyInput): string {
  const ext = extensionFromUrl(input.originalUrl);
  const safeId = sanitizeSourceId(input.sourceId);
  return `${input.tenantSlug}/${input.entity}/${safeId}.${ext}`;
}

export function publicUrlFromKey(publicBase: string, key: string): string {
  const base = publicBase.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");
  return `${base}/${normalizedKey}`;
}
