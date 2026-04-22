import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { PaymentGatewaysModule } from "./payment-gateways.module";
import { PaymentGatewaysService } from "./payment-gateways.service";
import { PaymentGatewayFactory } from "./payment-gateway.factory";

describe("PaymentGatewaysModule", () => {
  it("resolves PaymentGatewaysService without unresolved DI (DATABASE token wired)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PaymentGatewaysModule,
      ],
    })
      .overrideProvider("DATABASE")
      .useValue({})
      .compile();

    const service = moduleRef.get(PaymentGatewaysService);
    const factory = moduleRef.get(PaymentGatewayFactory);
    expect(service).toBeDefined();
    expect(factory).toBeDefined();
    await moduleRef.close();
  });
});
