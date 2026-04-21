import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CustomerQueryDto } from "./customer.dto";

async function validateQuery(payload: Record<string, unknown>) {
  const instance = plainToInstance(CustomerQueryDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, errors };
}

describe("CustomerQueryDto", () => {
  it("should accept page and limit as string query params and coerce them to numbers", async () => {
    const { instance, errors } = await validateQuery({ page: "1", limit: "20" });
    expect(errors).toHaveLength(0);
    expect(instance.page).toBe(1);
    expect(instance.limit).toBe(20);
  });

  it("should accept search filter", async () => {
    const { instance, errors } = await validateQuery({ search: "maria" });
    expect(errors).toHaveLength(0);
    expect(instance.search).toBe("maria");
  });

  it("should accept an email filter when valid", async () => {
    const { instance, errors } = await validateQuery({ email: "a@b.com" });
    expect(errors).toHaveLength(0);
    expect(instance.email).toBe("a@b.com");
  });

  it("should coerce empty email to undefined instead of failing", async () => {
    const { instance, errors } = await validateQuery({ email: "" });
    expect(errors).toHaveLength(0);
    expect(instance.email).toBeUndefined();
  });

  it("should reject non-email values in email filter", async () => {
    const { errors } = await validateQuery({ email: "not-an-email" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject unknown properties", async () => {
    const { errors } = await validateQuery({ bogus: "value" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject limit below 1", async () => {
    const { errors } = await validateQuery({ limit: "0" });
    expect(errors.length).toBeGreaterThan(0);
  });
});
