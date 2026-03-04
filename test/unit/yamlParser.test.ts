import { describe, it, expect } from "vitest";
import { parseYaml, serializeYaml } from "../../src/parsers/yamlParser";

describe("parseYaml", () => {
  it("parses a simple YAML array", () => {
    const yaml = `- id: 1\n  name: Alice\n- id: 2\n  name: Bob\n`;
    const result = parseYaml(yaml);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]["id"]).toBe(1);
    expect(result.rows[0]["name"]).toBe("Alice");
  });

  it("returns error for non-array YAML", () => {
    const result = parseYaml("key: value\n");
    expect("error" in result).toBe(true);
  });

  it("returns error for invalid YAML", () => {
    const result = parseYaml("  : :\n  bad: [yaml");
    expect("error" in result).toBe(true);
  });

  it("handles array values", () => {
    const yaml = `- id: 1\n  tags:\n    - admin\n    - user\n`;
    const result = parseYaml(yaml);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.rows[0]["tags"]).toEqual(["admin", "user"]);
  });
});

describe("serializeYaml", () => {
  it("serializes back to valid YAML", () => {
    const rows = [{ id: 1, name: "Alice" }];
    const columns = [
      { path: "id", label: "id", type: "number" as const, fromSchema: false },
      { path: "name", label: "name", type: "string" as const, fromSchema: false },
    ];
    const original = "- id: 1\n  name: Alice\n";
    const result = serializeYaml(rows, columns, { tabSize: 2, insertSpaces: true }, original);
    expect(result).toContain("id: 1");
    expect(result).toContain("name: Alice");
  });
});
