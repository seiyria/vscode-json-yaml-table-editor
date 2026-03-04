import { describe, it, expect, vi } from "vitest";

// Mock vscode since schemaResolver imports it (only resolveSchema uses it)
vi.mock("vscode", () => ({}));

// Mock slickgrid imports for buildColumns
vi.mock("@slickgrid-universal/common", () => ({}));
vi.mock("@slickgrid-universal/vanilla-bundle", () => ({}));

import { deriveColumnsFromSchema } from "../../src/schema/schemaResolver";
import { buildColumns, pathToColumnId, columnIdToPath } from "../../webview/grid/columnFactory";

describe("deriveColumnsFromSchema", () => {
  it("detects items.enum for array columns in allOf schemas", () => {
    const schema = {
      type: "array",
      items: {
        allOf: [
          {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
          {
            type: "object",
            properties: {
              restrictionTags: {
                type: "array",
                items: {
                  enum: [
                    "converted",
                    "harmony_attract",
                    "harmony_attract_legendary",
                    "hybrid",
                    "summoned",
                    "unique",
                  ],
                  type: "string",
                },
                title: "restrictionTags",
              },
              type: {
                enum: ["aberration", "creature", "demon", "dragon"],
                type: "string",
                title: "type",
              },
            },
          },
        ],
      },
    };

    const columns = deriveColumnsFromSchema(schema);

    // restrictionTags should be type "array" with enumValues
    const rtCol = columns.find((c) => c.path === "restrictionTags");
    expect(rtCol).toBeDefined();
    expect(rtCol!.type).toBe("array");
    expect(rtCol!.enumValues).toEqual([
      "converted",
      "harmony_attract",
      "harmony_attract_legendary",
      "hybrid",
      "summoned",
      "unique",
    ]);

    // type field should be type "string" with enumValues
    const typeCol = columns.find((c) => c.path === "type");
    expect(typeCol).toBeDefined();
    expect(typeCol!.enumValues).toEqual([
      "aberration",
      "creature",
      "demon",
      "dragon",
    ]);
  });

  it("buildColumns propagates __enumValues for array columns with enum", () => {
    const schema = {
      type: "array",
      items: {
        allOf: [
          {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
          {
            type: "object",
            properties: {
              restrictionTags: {
                type: "array",
                items: {
                  enum: ["a", "b", "c"],
                  type: "string",
                },
              },
            },
          },
        ],
      },
    };

    const columnInfos = deriveColumnsFromSchema(schema);
    const slickCols = buildColumns(columnInfos);
    const rtSlick = slickCols.find((c) => c.id === "restrictionTags");
    expect(rtSlick).toBeDefined();
    expect((rtSlick as any).__enumValues).toEqual(["a", "b", "c"]);
  });

  it("column IDs do not contain dots for nested paths", () => {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              city: { type: "string" },
            },
          },
        },
      },
    };

    const columnInfos = deriveColumnsFromSchema(schema);
    const slickCols = buildColumns(columnInfos);
    const cityCol = slickCols.find((c) => c.field === "address.city");
    expect(cityCol).toBeDefined();
    expect(cityCol!.id).toBe("address___city");
    expect(cityCol!.id).not.toContain(".");
    expect(columnIdToPath(cityCol!.id as string)).toBe("address.city");
  });

  it("pathToColumnId and columnIdToPath are inverses", () => {
    expect(pathToColumnId("a.b.c")).toBe("a___b___c");
    expect(columnIdToPath("a___b___c")).toBe("a.b.c");
    expect(columnIdToPath(pathToColumnId("foo.bar"))).toBe("foo.bar");
    expect(pathToColumnId("noDots")).toBe("noDots");
  });

  it("detects items.enum for simple array schemas (no allOf)", () => {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: {
              enum: ["a", "b", "c"],
              type: "string",
            },
          },
        },
      },
    };

    const columns = deriveColumnsFromSchema(schema);
    const tagsCol = columns.find((c) => c.path === "tags");
    expect(tagsCol).toBeDefined();
    expect(tagsCol!.type).toBe("array");
    expect(tagsCol!.enumValues).toEqual(["a", "b", "c"]);
  });
});
