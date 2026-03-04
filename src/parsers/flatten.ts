import type { FlatRow, ColumnType } from "../../shared/tableTypes";

const MAX_DEPTH = 10;

/**
 * Flatten a nested object into dot-delimited keys.
 * Arrays are kept as values (not flattened).
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  depth = 0
): FlatRow {
  const result: FlatRow = {};

  if (depth >= MAX_DEPTH) return result;

  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const nested = flattenObject(
        value as Record<string, unknown>,
        path,
        depth + 1
      );
      Object.assign(result, nested);
    } else {
      result[path] = value;
    }
  }

  return result;
}

/**
 * Unflatten a row with dot-delimited keys back into a nested object.
 * Omits keys with undefined values.
 */
export function unflattenRow(flat: FlatRow): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(flat)) {
    if (value === undefined) continue;

    const parts = path.split(".");
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
}

/** Guess the column type from a value */
export function guessType(value: unknown): ColumnType {
  if (value === null || value === undefined) return "unknown";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    // Check if any element is a non-null plain object (not an array)
    if (value.some(el => el !== null && typeof el === "object" && !Array.isArray(el))) {
      return "arrayOfObjects";
    }
    return "array";
  }
  if (typeof value === "object") return "object";
  return "string";
}
