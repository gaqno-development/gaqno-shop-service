import { UnauthorizedException } from "@nestjs/common";
import { requireTenantId } from "./tenant-guard";

describe("requireTenantId", () => {
  it("should return the tenantId when defined", () => {
    expect(requireTenantId("tenant-1")).toBe("tenant-1");
  });

  it("should throw UnauthorizedException when undefined", () => {
    expect(() => requireTenantId(undefined)).toThrow(UnauthorizedException);
  });

  it("should throw UnauthorizedException when empty string", () => {
    expect(() => requireTenantId("")).toThrow(UnauthorizedException);
  });
});
