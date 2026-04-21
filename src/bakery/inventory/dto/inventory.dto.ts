import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

const MOVEMENT_TYPES = ["in", "out", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export class CreateInventoryMovementDto {
  @IsUUID()
  ingredientId: string;

  @IsEnum(MOVEMENT_TYPES)
  type: MovementType;

  @IsNumberString()
  quantity: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
