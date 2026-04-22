import { buildR2Key, publicUrlFromKey } from "./mappers/image-url";
import type { ImageEntity } from "./mappers/image-url";

const CONTENT_TYPE_TO_EXT: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export interface FetchedImage {
  bytes: Buffer;
  contentType: string;
  sourceUrl: string;
}

export interface RehostDeps {
  tenantSlug: string;
  publicBase: string;
  lookup: (sourceUrl: string) => Promise<string | null>;
  remember: (sourceUrl: string, publicUrl: string) => Promise<void>;
  fetcher: (url: string) => Promise<FetchedImage>;
  uploader: (
    key: string,
    bytes: Buffer,
    contentType: string,
  ) => Promise<void>;
}

export interface RehostInput {
  entity: ImageEntity;
  sourceId: string;
  url: string | null | undefined;
}

export interface ImageRehoster {
  rehost(input: RehostInput): Promise<string | null>;
}

function extFromContentType(ct: string): string {
  const normalized = ct.split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[normalized] ?? "bin";
}

export function createImageRehoster(deps: RehostDeps): ImageRehoster {
  return {
    async rehost(input) {
      if (!input.url) return null;
      const cached = await deps.lookup(input.url);
      if (cached) return cached;
      const fetched = await deps.fetcher(input.url);
      let key = buildR2Key({
        tenantSlug: deps.tenantSlug,
        entity: input.entity,
        sourceId: input.sourceId,
        originalUrl: input.url,
      });
      if (key.endsWith(".bin")) {
        const ext = extFromContentType(fetched.contentType);
        key = key.replace(/\.bin$/, `.${ext}`);
      }
      await deps.uploader(key, fetched.bytes, fetched.contentType);
      const publicUrl = publicUrlFromKey(deps.publicBase, key);
      await deps.remember(input.url, publicUrl);
      return publicUrl;
    },
  };
}
