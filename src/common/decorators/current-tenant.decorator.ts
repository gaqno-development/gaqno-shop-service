import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { getCurrentTenant } from "../tenant-context";

export const CurrentTenant = createParamDecorator(
  (data: keyof import("../tenant-context").TenantContext | undefined, ctx: ExecutionContext) => {
    const tenant = getCurrentTenant();
    if (!tenant) {
      return undefined;
    }
    return data ? tenant[data] : tenant;
  }
);
