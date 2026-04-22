import { createIdMap } from "./id-map";
import type { PoolClient } from "pg";

interface FakeQuery {
  text: string;
  values: readonly unknown[];
}

function makeClient(rowsFor: (q: FakeQuery) => unknown[]): {
  client: PoolClient;
  queries: FakeQuery[];
} {
  const queries: FakeQuery[] = [];
  const client = {
    query: (text: string, values?: readonly unknown[]) => {
      const q: FakeQuery = { text, values: values ?? [] };
      queries.push(q);
      return Promise.resolve({ rows: rowsFor(q), rowCount: rowsFor(q).length });
    },
  } as unknown as PoolClient;
  return { client, queries };
}

describe("createIdMap", () => {
  it("lookup returns null when no row exists", async () => {
    const { client } = makeClient(() => []);
    const map = createIdMap(client, "tenant-1");
    const result = await map.lookup("Product", "abc");
    expect(result).toBeNull();
  });

  it("lookup returns existing target_id when row exists", async () => {
    const { client, queries } = makeClient((q) =>
      q.text.includes("SELECT target_id")
        ? [{ target_id: "uuid-target" }]
        : [],
    );
    const map = createIdMap(client, "tenant-1");
    const result = await map.lookup("Product", "abc");
    expect(result).toBe("uuid-target");
    expect(queries[0].values).toEqual(["tenant-1", "Product", "abc"]);
  });

  it("remember inserts tenant+source_table+source_id+target_id with ON CONFLICT DO NOTHING", async () => {
    const { client, queries } = makeClient(() => []);
    const map = createIdMap(client, "tenant-1");
    await map.remember("Product", "abc", "uuid-target");
    expect(queries[0].text).toContain("INSERT INTO etl_id_map");
    expect(queries[0].text).toContain("ON CONFLICT");
    expect(queries[0].values).toEqual([
      "tenant-1",
      "Product",
      "abc",
      "uuid-target",
    ]);
  });

  it("ensure returns cached id without calling remember again", async () => {
    let insertCount = 0;
    const queries: FakeQuery[] = [];
    const client = {
      query: (text: string, values?: readonly unknown[]) => {
        queries.push({ text, values: values ?? [] });
        if (text.includes("SELECT target_id")) {
          return Promise.resolve({
            rows: [{ target_id: "uuid-cached" }],
            rowCount: 1,
          });
        }
        if (text.includes("INSERT INTO etl_id_map")) insertCount += 1;
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
    } as unknown as PoolClient;
    const map = createIdMap(client, "tenant-1");
    const factoryCalls: string[] = [];
    const result = await map.ensure("Product", "abc", async () => {
      factoryCalls.push("called");
      return "uuid-new";
    });
    expect(result).toBe("uuid-cached");
    expect(factoryCalls).toEqual([]);
    expect(insertCount).toBe(0);
  });

  it("ensure calls factory + remember when missing, returns new id", async () => {
    const queries: FakeQuery[] = [];
    const client = {
      query: (text: string, values?: readonly unknown[]) => {
        queries.push({ text, values: values ?? [] });
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
    } as unknown as PoolClient;
    const map = createIdMap(client, "tenant-1");
    const result = await map.ensure("Product", "abc", async () => "uuid-new");
    expect(result).toBe("uuid-new");
    const insertQ = queries.find((q) =>
      q.text.includes("INSERT INTO etl_id_map"),
    );
    expect(insertQ?.values).toEqual([
      "tenant-1",
      "Product",
      "abc",
      "uuid-new",
    ]);
  });
});
