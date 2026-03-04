import type { FlatRow, DrilldownPath } from "../../shared/tableTypes";
import type { ParseResult, ParseError } from "./jsonParser";
import { flattenObject, unflattenRow } from "./flatten";
import { flattenArrayToTable } from "./jsonParser";

/**
 * Extract the sub-array at the given drilldown path from top-level rows.
 * Unflattens rows, navigates path segment by segment, and flattens the result.
 */
export function extractSubArray(
  topLevelRows: FlatRow[],
  path: DrilldownPath
): ParseResult | ParseError {
  if (path.length === 0) {
    return { error: "Empty drilldown path" };
  }

  let currentArray: unknown[] = topLevelRows.map((row) => unflattenRow(row));

  for (const segment of path) {
    if (segment.rowIndex < 0 || segment.rowIndex >= currentArray.length) {
      return { error: `Row index ${segment.rowIndex} out of bounds` };
    }

    const row = currentArray[segment.rowIndex];
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return { error: `Row ${segment.rowIndex} is not an object` };
    }

    // Navigate field path (may be dot-delimited, e.g. "stats.bonuses")
    const value = getNestedValue(row as Record<string, unknown>, segment.fieldPath);
    if (value === null || value === undefined) {
      // Treat missing/null as empty array (e.g. field exists in schema but not yet populated)
      currentArray = [];
    } else if (!Array.isArray(value)) {
      return { error: `Field "${segment.fieldPath}" is not an array` };
    } else {
      currentArray = value;
    }
  }

  return flattenArrayToTable(currentArray);
}

/**
 * Apply edits to a sub-array at the given drilldown path.
 * Replaces the sub-array with the new sub-rows, then returns modified top-level rows.
 */
export function applySubArrayEdit(
  topLevelRows: FlatRow[],
  path: DrilldownPath,
  subRows: FlatRow[]
): FlatRow[] {
  // Unflatten everything to nested objects
  const topLevel = topLevelRows.map((row) => unflattenRow(row));
  const newSubData = subRows.map((row) => unflattenRow(row));

  // Navigate to the parent and replace the sub-array
  let currentArray: unknown[] = topLevel;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const row = currentArray[segment.rowIndex] as Record<string, unknown>;

    if (i === path.length - 1) {
      // Last segment: replace the array value
      setNestedValue(row, segment.fieldPath, newSubData);
    } else {
      // Intermediate segment: navigate deeper
      const value = getNestedValue(row, segment.fieldPath);
      if (value === null || value === undefined) {
        // Initialize missing field as empty array
        const emptyArr: unknown[] = [];
        setNestedValue(row, segment.fieldPath, emptyArr);
        currentArray = emptyArr;
      } else if (!Array.isArray(value)) {
        throw new Error(`Field "${segment.fieldPath}" is not an array at segment ${i}`);
      } else {
        currentArray = value;
      }
    }
  }

  // Re-flatten the top-level data
  return topLevel.map((obj) =>
    flattenObject(obj as Record<string, unknown>)
  );
}

function getNestedValue(
  obj: Record<string, unknown>,
  fieldPath: string
): unknown {
  const parts = fieldPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  fieldPath: string,
  value: unknown
): void {
  const parts = fieldPath.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
