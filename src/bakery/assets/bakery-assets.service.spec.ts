import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { BakeryAssetsService } from "./bakery-assets.service";

function buildFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  const base = {
    buffer: Buffer.from("fake image bytes"),
    mimetype: "image/png",
    originalname: "cake.png",
    size: 16,
    fieldname: "file",
    encoding: "7bit",
    stream: null as never,
    destination: "",
    filename: "",
    path: "",
  };
  return { ...base, ...overrides } as Express.Multer.File;
}

function configWith(map: Record<string, string>): ConfigService {
  return {
    get: (k: string) => map[k],
  } as unknown as ConfigService;
}

describe("BakeryAssetsService.saveImage", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bakery-assets-"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("throws BadRequestException when file is missing", async () => {
    const service = new BakeryAssetsService(configWith({}));
    await expect(
      service.saveImage("tenant-1", undefined as never),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects unsupported mime types", async () => {
    const service = new BakeryAssetsService(
      configWith({ BAKERY_ASSET_DIR: tmpRoot }),
    );
    await expect(
      service.saveImage(
        "tenant-1",
        buildFile({ mimetype: "application/pdf" }),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects files larger than configured max bytes", async () => {
    const service = new BakeryAssetsService(
      configWith({ BAKERY_ASSET_DIR: tmpRoot, BAKERY_ASSET_MAX_BYTES: "10" }),
    );
    await expect(
      service.saveImage("tenant-1", buildFile({ size: 20 })),
    ).rejects.toThrow(BadRequestException);
  });

  it("writes file to tenant folder and returns public URL", async () => {
    const service = new BakeryAssetsService(
      configWith({
        BAKERY_ASSET_DIR: tmpRoot,
        BAKERY_ASSET_PUBLIC_BASE_URL: "https://cdn.example/bakery",
      }),
    );
    const result = await service.saveImage("tenant-xyz", buildFile());
    expect(result.url.startsWith("https://cdn.example/bakery/tenant-xyz/")).toBe(
      true,
    );
    expect(result.mimeType).toBe("image/png");
    const files = await fs.readdir(path.join(tmpRoot, "tenant-xyz"));
    expect(files).toHaveLength(1);
  });
});
