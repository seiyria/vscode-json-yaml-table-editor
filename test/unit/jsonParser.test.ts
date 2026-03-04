import { describe, it, expect } from "vitest";
import { parseJson, serializeJson } from "../../src/parsers/jsonParser";

describe("parseJson", () => {
  it("parses a simple JSON array", () => {
    const result = parseJson('[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]');
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toHaveLength(2);
    expect(result.rows[0]).toEqual({ id: 1, name: "Alice" });
  });

  it("returns error for non-array JSON", () => {
    const result = parseJson('{"key":"value"}');
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("top-level array");
    }
  });

  it("returns error for invalid JSON", () => {
    const result = parseJson("not json");
    expect("error" in result).toBe(true);
  });

  it("flattens nested objects", () => {
    const result = parseJson(
      '[{"name":"Alice","address":{"city":"NYC","zip":"10001"}}]'
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rows[0]["address.city"]).toBe("NYC");
    expect(result.columns.find((c) => c.path === "address.city")).toBeTruthy();
  });

  it("handles arrays as values", () => {
    const result = parseJson('[{"tags":["a","b"]}]');
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rows[0]["tags"]).toEqual(["a", "b"]);
    const col = result.columns.find((c) => c.path === "tags");
    expect(col?.type).toBe("array");
  });

  it("handles mixed columns across rows", () => {
    const result = parseJson('[{"a":1},{"b":2}]');
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.columns).toHaveLength(2);
    expect(result.rows[0]["a"]).toBe(1);
    expect(result.rows[0]["b"]).toBeUndefined();
  });
});

describe("serializeJson", () => {
  it("serializes with 2-space indent by default", () => {
    const rows = [{ id: 1, name: "Alice" }];
    const columns = [
      { path: "id", label: "id", type: "number" as const, fromSchema: false },
      { path: "name", label: "name", type: "string" as const, fromSchema: false },
    ];
    const result = serializeJson(rows, columns, {
      tabSize: 2,
      insertSpaces: true,
    });
    expect(result).toContain("  ");
    expect(result).toContain('"id": 1');
    expect(result).toContain('"name": "Alice"');
  });

  it("serializes with tab indent", () => {
    const rows = [{ id: 1 }];
    const columns = [
      { path: "id", label: "id", type: "number" as const, fromSchema: false },
    ];
    const result = serializeJson(rows, columns, {
      tabSize: 4,
      insertSpaces: false,
    });
    expect(result).toContain("\t");
  });

  it("unflattens nested rows", () => {
    const rows = [{ "address.city": "NYC", "address.zip": "10001" }];
    const columns = [
      {
        path: "address.city",
        label: "address.city",
        type: "string" as const,
        fromSchema: false,
      },
      {
        path: "address.zip",
        label: "address.zip",
        type: "string" as const,
        fromSchema: false,
      },
    ];
    const result = serializeJson(rows, columns, {
      tabSize: 2,
      insertSpaces: true,
    });
    const parsed = JSON.parse(result);
    expect(parsed[0].address.city).toBe("NYC");
    expect(parsed[0].address.zip).toBe("10001");
  });
});
