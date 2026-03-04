import * as YAML from "yaml";
import type { FlatRow, ColumnInfo } from "../../shared/tableTypes";
import { flattenArrayToTable } from "./jsonParser";
import { unflattenRow } from "./flatten";
import type { EditorSettings } from "../settings/editorSettings";

import type { ParseResult, ParseError } from "./jsonParser";

export function parseYaml(text: string): ParseResult | ParseError {
  let data: unknown;
  try {
    data = YAML.parse(text);
  } catch (e: any) {
    return { error: `Invalid YAML: ${e.message}` };
  }

  if (!Array.isArray(data)) {
    return {
      error:
        "This file does not contain a top-level array and cannot be displayed as a table.",
    };
  }

  return flattenArrayToTable(data);
}

export function serializeYaml(
  rows: FlatRow[],
  _columns: ColumnInfo[],
  settings: EditorSettings,
  originalText: string
): string {
  const data = rows.map((row) => unflattenRow(row));

  // Try to use the Document API for format preservation
  try {
    const doc = YAML.parseDocument(originalText);
    doc.contents = doc.createNode(data) as any;
    return doc.toString();
  } catch {
    // Fallback: plain serialize
    return YAML.stringify(data, {
      indent: settings.tabSize,
    });
  }
}
