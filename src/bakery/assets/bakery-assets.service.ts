import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import * as path from "path";
import * as crypto from "crypto";

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export interface UploadedAsset {
  readonly url: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

@Injectable()
export class BakeryAssetsService {
  private readonly logger = new Logger(BakeryAssetsService.name);

  constructor(private readonly config: ConfigService) {}

  async saveImage(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<UploadedAsset> {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported mime type: ${file.mimetype}`,
      );
    }
    const maxBytes = Number(
      this.config.get("BAKERY_ASSET_MAX_BYTES") ?? DEFAULT_MAX_BYTES,
    );
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds max size of ${maxBytes} bytes`,
      );
    }

    const storageRoot = this.resolveStorageRoot();
    const tenantDir = path.join(storageRoot, tenantId);
    await fs.mkdir(tenantDir, { recursive: true });

    const extension = this.guessExtension(file.mimetype, file.originalname);
    const id = crypto.randomUUID();
    const filename = `${id}${extension}`;
    const absPath = path.join(tenantDir, filename);
    await fs.writeFile(absPath, file.buffer);

    const publicBase = this.resolvePublicBase();
    const url = `${publicBase}/${tenantId}/${filename}`;
    this.logger.debug(
      `Saved bakery asset for tenant=${tenantId} filename=${filename} size=${file.size}`,
    );
    return {
      url,
      filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private resolveStorageRoot(): string {
    const override = this.config.get<string>("BAKERY_ASSET_DIR");
    if (override && override.length > 0) {
      return override;
    }
    return path.join(process.cwd(), "uploads", "bakery");
  }

  private resolvePublicBase(): string {
    const override = this.config.get<string>("BAKERY_ASSET_PUBLIC_BASE_URL");
    if (override && override.length > 0) {
      return override.replace(/\/$/, "");
    }
    return "/uploads/bakery";
  }

  private guessExtension(mimetype: string, original: string): string {
    const fromName = path.extname(original).toLowerCase();
    if (fromName.length > 0 && fromName.length <= 5) {
      return fromName;
    }
    const map: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    return map[mimetype] ?? ".bin";
  }
}
