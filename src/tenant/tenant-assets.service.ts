import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { TenantAssetType } from "./dto/upload-tenant-asset.dto";

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

@Injectable()
export class TenantAssetsService {
  constructor(private readonly config: ConfigService) {}

  async upload(
    tenantId: string,
    type: TenantAssetType,
    file: Express.Multer.File,
  ): Promise<{
    type: TenantAssetType;
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported mime type: ${file.mimetype}`);
    }
    const maxBytes = Number(
      this.config.get("TENANT_ASSET_MAX_BYTES") ?? DEFAULT_MAX_BYTES,
    );
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds max size of ${maxBytes} bytes`,
      );
    }
    const dir = path.join(this.resolveStorageRoot(), tenantId, type);
    await fs.mkdir(dir, { recursive: true });
    const extension = this.guessExtension(file.mimetype, file.originalname);
    const filename = `${crypto.randomUUID()}${extension}`;
    await fs.writeFile(path.join(dir, filename), file.buffer);
    const baseUrl = this.resolvePublicBase();
    return {
      type,
      url: `${baseUrl}/${tenantId}/${type}/${filename}`,
      filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private resolveStorageRoot(): string {
    const override = this.config.get<string>("TENANT_ASSET_DIR");
    if (override && override.length > 0) {
      return override;
    }
    return path.join(process.cwd(), "uploads", "tenant-assets");
  }

  private resolvePublicBase(): string {
    const override = this.config.get<string>("TENANT_ASSET_PUBLIC_BASE_URL");
    if (override && override.length > 0) {
      return override.replace(/\/$/, "");
    }
    return "/uploads/tenant-assets";
  }

  private guessExtension(mimeType: string, originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    if (ext.length > 0 && ext.length <= 5) {
      return ext;
    }
    const mimeToExt: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/svg+xml": ".svg",
      "image/x-icon": ".ico",
      "image/vnd.microsoft.icon": ".ico",
    };
    return mimeToExt[mimeType] ?? ".bin";
  }
}

