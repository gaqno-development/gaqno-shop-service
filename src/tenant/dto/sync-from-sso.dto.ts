import { IsUUID } from "class-validator";

export class SyncFromSsoDto {
  @IsUUID()
  ssoTenantId!: string;
}
