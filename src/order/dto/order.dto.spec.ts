import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { OrderQueryDto } from "./order.dto";

async function validateQuery(payload: Record<string, unknown>) {
  const instance = plainToInstance(OrderQueryDto, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, errors };
}

describe("OrderQueryDto", () => {
  it("should accept page and limit as string query params and coerce them to numbers", async () => {
    const { instance, errors } = await validateQuery({ page: "1", limit: "20" });
    expect(errors).toHaveLength(0);
    expect(instance.page).toBe(1);
    expect(instance.limit).toBe(20);
  });

  it("should accept customerId when empty by coercing empty string to undefined", async () => {
    const { instance, errors } = await validateQuery({ customerId: "", limit: "5" });
    expect(errors).toHaveLength(0);
    expect(instance.customerId).toBeUndefined();
  });

  it("should accept a valid uuid customerId", async () => {
    const { instance, errors } = await validateQuery({
      customerId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(errors).toHaveLength(0);
    expect(instance.customerId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("should reject customerId that is a non-empty invalid uuid", async () => {
    const { errors } = await validateQuery({ customerId: "not-a-uuid" });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain("customerId");
  });

  it("should reject limit below 1", async () => {
    const { errors } = await validateQuery({ limit: "0" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should reject limit above the maximum", async () => {
    const { errors } = await validateQuery({ limit: "1000" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should accept status as a plain string", async () => {
    const { instance, errors } = await validateQuery({ status: "pending" });
    expect(errors).toHaveLength(0);
    expect(instance.status).toBe("pending");
  });

  it("should accept offset for backwards compatibility", async () => {
    const { instance, errors } = await validateQuery({ offset: "40" });
    expect(errors).toHaveLength(0);
    expect(instance.offset).toBe(40);
  });

  it("should reject unknown properties", async () => {
    const { errors } = await validateQuery({ bogus: "value" });
    expect(errors.length).toBeGreaterThan(0);
  });
});
