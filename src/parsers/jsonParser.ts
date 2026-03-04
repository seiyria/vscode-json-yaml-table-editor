import type { FlatRow, ColumnInfo, ColumnType } from "../../shared/tableTypes";
import { flattenObject, unflattenRow, guessType } from "./flatten";
import type { EditorSettings } from "../settings/editorSettings";

export interface ParseResult {
  columns: ColumnInfo[];
  rows: FlatRow[];
}

export interface ParseError {
  error: string;
}

export function parseJson(text: string): ParseResult | ParseError {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e: any) {
    return { error: `Invalid JSON: ${e.message}` };
  }

  if (!Array.isArray(data)) {
    return {
      error:
        "This file does not contain a top-level array and cannot be displayed as a table.",
    };
  }

  return flattenArrayToTable(data);
}

export function flattenArrayToTable(
  data: unknown[]
): ParseResult {
  const columnMap = new Map<string, ColumnType>();
  const rows: FlatRow[] = [];

  for (const item of data) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      // Non-object items get a single "value" column
      const flat: FlatRow = { value: item };
      rows.push(flat);
      if (!columnMap.has("value")) {
        columnMap.set("value", guessType(item));
      }
    } else {
      const flat = flattenObject(item as Record<string, unknown>);
      rows.push(flat);

      for (const [key, val] of Object.entries(flat)) {
        const existing = columnMap.get(key);
        const newType = guessType(val);
        if (!existing || existing === "unknown") {
          columnMap.set(key, newType);
        } else if (existing === "array" && newType === "arrayOfObjects") {
          // arrayOfObjects is more specific — empty arrays can't distinguish
          columnMap.set(key, newType);
        }
      }
    }
  }

  const columns: ColumnInfo[] = [];
  for (const [path, type] of columnMap) {
    columns.push({
      path,
      label: path,
      type,
      fromSchema: false,
    });
  }

  return { columns, rows };
}

export function serializeJson(
  rows: FlatRow[],
  _columns: ColumnInfo[],
  settings: EditorSettings
): string {
  const data = rows.map((row) => unflattenRow(row));
  const indent = settings.insertSpaces
    ? " ".repeat(settings.tabSize)
    : "\t";
  return JSON.stringify(data, null, indent) + "\n";
}
