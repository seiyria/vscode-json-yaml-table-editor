import { describe, it, expect } from "vitest";
import { extractSubArray, applySubArrayEdit } from "../../src/parsers/drilldown";
import type { FlatRow, DrilldownPath } from "../../shared/tableTypes";

describe("extractSubArray", () => {
  it("extracts a single-level sub-array", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: [{ type: "flat", value: 5 }, { type: "pct", value: 10 }] },
      { name: "Item 2", bonuses: [{ type: "bonus", value: 3 }] },
    ];

    const path: DrilldownPath = [
      { rowIndex: 0, fieldPath: "bonuses", label: "Row 1 > bonuses" },
    ];

    const result = extractSubArray(rows, path);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]).toEqual({ type: "flat", value: 5 });
      expect(result.rows[1]).toEqual({ type: "pct", value: 10 });
    }
  });

  it("extracts from second row", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: [{ type: "flat", value: 5 }] },
      { name: "Item 2", bonuses: [{ type: "bonus", value: 3 }, { type: "x", value: 99 }] },
    ];

    const path: DrilldownPath = [
      { rowIndex: 1, fieldPath: "bonuses", label: "Row 2 > bonuses" },
    ];

    const result = extractSubArray(rows, path);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]).toEqual({ type: "bonus", value: 3 });
      expect(result.rows[1]).toEqual({ type: "x", value: 99 });
    }
  });

  it("extracts multi-level (nested) sub-array", () => {
    const rows: FlatRow[] = [
      {
        name: "Item 1",
        bonuses: [
          { type: "flat", details: [{ key: "a", val: 1 }, { key: "b", val: 2 }] },
        ],
      },
    ];

    const path: DrilldownPath = [
      { rowIndex: 0, fieldPath: "bonuses", label: "Row 1 > bonuses" },
      { rowIndex: 0, fieldPath: "details", label: "Row 1 > details" },
    ];

    const result = extractSubArray(rows, path);
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]).toEqual({ key: "a", val: 1 });
      expect(result.rows[1]).toEqual({ key: "b", val: 2 });
    }
  });

  it("returns error for out-of-bounds row index", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: [{ type: "flat" }] },
    ];

    const path: DrilldownPath = [
      { rowIndex: 5, fieldPath: "bonuses", label: "Row 6 > bonuses" },
    ];

    const result = extractSubArray(rows, path);
    expect("error" in result).toBe(true);
  });

  it("returns error for non-array field", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: "not an array" },
    ];

    const path: DrilldownPath = [
      { rowIndex: 0, fieldPath: "bonuses", label: "Row 1 > bonuses" },
    ];

    const result = extractSubArray(rows, path);
    expect("error" in result).toBe(true);
  });

  it("returns error for empty path", () => {
    const result = extractSubArray([], []);
    expect("error" in result).toBe(true);
  });
});

describe("applySubArrayEdit", () => {
  it("round-trips correctly for single-level edit", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: [{ type: "flat", value: 5 }, { type: "pct", value: 10 }] },
      { name: "Item 2", bonuses: [{ type: "bonus", value: 3 }] },
    ];

    const path: DrilldownPath = [
      { rowIndex: 0, fieldPath: "bonuses", label: "Row 1 > bonuses" },
    ];

    // Edit: change value of first bonus
    const editedSubRows: FlatRow[] = [
      { type: "flat", value: 99 },
      { type: "pct", value: 10 },
    ];

    const result = applySubArrayEdit(rows, path, editedSubRows);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Item 1");
    // The bonuses array should be updated
    const bonuses = result[0].bonuses as unknown[];
    expect(Array.isArray(bonuses)).toBe(true);
    expect(bonuses.length).toBe(2);
    expect((bonuses[0] as any).value).toBe(99);
  });

  it("round-trips correctly when adding a row", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: [{ type: "flat", value: 5 }] },
    ];

    const path: DrilldownPath = [
      { rowIndex: 0, fieldPath: "bonuses", label: "Row 1 > bonuses" },
    ];

    const editedSubRows: FlatRow[] = [
      { type: "flat", value: 5 },
      { type: "new", value: 42 },
    ];

    const result = applySubArrayEdit(rows, path, editedSubRows);
    expect(result.length).toBe(1);
    const bonuses = result[0].bonuses as unknown[];
    expect(Array.isArray(bonuses)).toBe(true);
    expect(bonuses.length).toBe(2);
    expect((bonuses[1] as any).type).toBe("new");
    expect((bonuses[1] as any).value).toBe(42);
  });

  it("preserves other rows when editing", () => {
    const rows: FlatRow[] = [
      { name: "Item 1", bonuses: [{ type: "flat" }] },
      { name: "Item 2", bonuses: [{ type: "bonus" }] },
    ];

    const path: DrilldownPath = [
      { rowIndex: 0, fieldPath: "bonuses", label: "Row 1 > bonuses" },
    ];

    const editedSubRows: FlatRow[] = [
      { type: "changed" },
    ];

    const result = applySubArrayEdit(rows, path, editedSubRows);
    expect(result.length).toBe(2);
    expect(result[1].name).toBe("Item 2");
    const bonuses1 = result[1].bonuses as unknown[];
    expect(Array.isArray(bonuses1)).toBe(true);
    expect((bonuses1[0] as any).type).toBe("bonus");
  });
});
