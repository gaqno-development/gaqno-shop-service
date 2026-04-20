import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import {
  DROPSHIPPING_TICKET_STATUSES,
  type DropshippingOrderTicketStatus,
  type DropshippingTicketCancelRequest,
  type DropshippingTicketRetryRequest,
} from "@gaqno-development/types";

export class ListQueueQueryDto {
  @IsOptional()
  @IsIn(DROPSHIPPING_TICKET_STATUSES as readonly string[])
  status?: DropshippingOrderTicketStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class RetryTicketDto implements DropshippingTicketRetryRequest {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelTicketDto implements DropshippingTicketCancelRequest {
  @IsString()
  reason!: string;
}
