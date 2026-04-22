import { applyEtlIdMap } from "./etl-id-map";

interface RecordedCall {
  text: string;
  values: unknown[];
}

function createSqlRecorder(): {
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const sql = (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown[]> => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve([]);
  };
  return { sql, calls };
}

describe("applyEtlIdMap", () => {
  it("creates etl_id_map table with required columns", async () => {
    const { sql, calls } = createSqlRecorder();
    await applyEtlIdMap(
      sql as unknown as import("./enums").SqlClient,
    );
    const createStatement = calls.find((c) =>
      c.text.includes("CREATE TABLE IF NOT EXISTS etl_id_map"),
    );
    expect(createStatement).toBeDefined();
    expect(createStatement?.text).toMatch(/tenant_id\s+UUID NOT NULL/);
    expect(createStatement?.text).toMatch(/source_table\s+VARCHAR/);
    expect(createStatement?.text).toMatch(/source_id\s+VARCHAR/);
    expect(createStatement?.text).toMatch(/target_id\s+UUID NOT NULL/);
    expect(createStatement?.text).toMatch(/migrated_at\s+TIMESTAMP/);
  });

  it("creates a unique index on (tenant_id, source_table, source_id)", async () => {
    const { sql, calls } = createSqlRecorder();
    await applyEtlIdMap(
      sql as unknown as import("./enums").SqlClient,
    );
    const unique = calls.find((c) =>
      c.text.includes(
        "CREATE UNIQUE INDEX IF NOT EXISTS etl_id_map_lookup_idx",
      ),
    );
    expect(unique).toBeDefined();
    expect(unique?.text).toMatch(
      /etl_id_map\(tenant_id, source_table, source_id\)/,
    );
  });
});
