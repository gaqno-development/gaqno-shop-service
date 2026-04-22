import { applyOrderPaymentColumns } from "./order-payment-columns";
import type { SqlClient } from "./enums";

function createSqlRecorder(): {
  readonly sql: SqlClient;
  readonly statements: string[];
} {
  const statements: string[] = [];
  const taggedFn = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const interleaved = strings.reduce((acc, str, i) => {
      const val = i < values.length ? String(values[i]) : "";
      return acc + str + val;
    }, "");
    statements.push(interleaved);
    return Promise.resolve([]);
  };
  (taggedFn as unknown as { unsafe: (sql: string) => Promise<unknown> }).unsafe =
    (raw: string) => {
      statements.push(raw);
      return Promise.resolve([]);
    };
  return { sql: taggedFn as unknown as SqlClient, statements };
}

const ORDER_PAYMENT_COLUMNS = [
  "pix_expires_at",
  "payment_provider",
  "payment_gateway_id",
  "payment_idempotency_key",
  "payment_failure_reason",
  "webhook_last_received_at",
];

describe("applyOrderPaymentColumns", () => {
  it.each(ORDER_PAYMENT_COLUMNS)(
    "adds %s column to orders idempotently",
    async (column) => {
      const { sql, statements } = createSqlRecorder();
      await applyOrderPaymentColumns(sql);
      const stmt = statements.find(
        (s) =>
          s.includes("ALTER TABLE orders") &&
          s.includes(`ADD COLUMN IF NOT EXISTS ${column}`),
      );
      expect(stmt).toBeDefined();
    },
  );

  it("payment_gateway_id references tenant_payment_gateways on delete set null", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyOrderPaymentColumns(sql);
    const stmt = statements.find((s) =>
      s.includes("ADD COLUMN IF NOT EXISTS payment_gateway_id"),
    );
    expect(stmt).toContain("REFERENCES tenant_payment_gateways(id)");
    expect(stmt).toContain("ON DELETE SET NULL");
  });

  it("creates pix_expires_idx partial index idempotently", async () => {
    const { sql, statements } = createSqlRecorder();
    await applyOrderPaymentColumns(sql);
    const stmt = statements.find((s) => s.includes("orders_pix_expires_idx"));
    expect(stmt).toBeDefined();
    expect(stmt).toContain("CREATE INDEX IF NOT EXISTS");
  });
});
