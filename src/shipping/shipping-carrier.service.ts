import { Injectable } from "@nestjs/common";
import { CorreiosService } from "./correios.service";
import { JadlogService } from "./jadlog.service";
import {
  CalculatedRate,
  ShippingDimensions,
  ShippingMethodRow,
} from "./shipping.types";

const DEFAULT_ORIGIN_CEP = "01310100";
const DEFAULT_CORREIOS_SERVICES: readonly string[] = ["40010", "41106"];
const DEFAULT_MIN_DAYS = 1;
const DEFAULT_MAX_DAYS = 7;

@Injectable()
export class ShippingCarrierService {
  constructor(
    private readonly correios: CorreiosService,
    private readonly jadlog: JadlogService,
  ) {}

  async calculateForMethod(
    method: ShippingMethodRow,
    cepDestino: string,
    dimensions: ShippingDimensions,
    subtotal: number,
  ): Promise<CalculatedRate | null> {
    if (method.carrier === "correios") {
      return this.calculateCorreios(method, cepDestino, dimensions);
    }
    if (method.carrier === "jadlog") {
      return this.calculateJadlog(method, cepDestino, dimensions, subtotal);
    }
    if (method.carrier === "custom" && method.flatRate) {
      return this.buildFlatRate(method);
    }
    return null;
  }

  private async calculateCorreios(
    method: ShippingMethodRow,
    cepDestino: string,
    dimensions: ShippingDimensions,
  ): Promise<CalculatedRate | null> {
    const originCep = method.settings?.originCep ?? DEFAULT_ORIGIN_CEP;
    const servicos = method.serviceCode
      ? [method.serviceCode]
      : [...DEFAULT_CORREIOS_SERVICES];
    const results = await this.correios.calculateShipping(
      originCep,
      cepDestino,
      dimensions,
      servicos,
    );
    const result = results.find((r) => r.code === method.serviceCode) ?? results[0];
    if (!result || result.error) return null;

    return {
      methodId: method.id,
      name: method.name,
      carrier: "correios",
      price: result.price,
      days: { min: result.days, max: result.days + 2 },
      isFreeShipping: false,
    };
  }

  private async calculateJadlog(
    method: ShippingMethodRow,
    cepDestino: string,
    dimensions: ShippingDimensions,
    subtotal: number,
  ): Promise<CalculatedRate | null> {
    const originCep = method.settings?.originCep ?? DEFAULT_ORIGIN_CEP;
    const results = await this.jadlog.calculateShipping({
      cepOrigem: originCep,
      cepDestino,
      vlMercadoria: subtotal,
      psReal: dimensions.weight,
    });
    const result = results.find((r) => r.code === method.serviceCode) ?? results[0];
    if (!result) return null;

    return {
      methodId: method.id,
      name: method.name,
      carrier: "jadlog",
      price: result.price,
      days: { min: result.days, max: result.days + 1 },
      isFreeShipping: false,
    };
  }

  private buildFlatRate(method: ShippingMethodRow): CalculatedRate {
    return {
      methodId: method.id,
      name: method.name,
      carrier: method.carrier,
      price: parseFloat(method.flatRate ?? "0"),
      days: {
        min: method.estimatedDeliveryDaysMin ?? DEFAULT_MIN_DAYS,
        max: method.estimatedDeliveryDaysMax ?? DEFAULT_MAX_DAYS,
      },
      isFreeShipping: false,
    };
  }
}
