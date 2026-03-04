import type { FlatRow, ColumnInfo } from "../../shared/tableTypes";
import type { EditorSettings } from "../settings/editorSettings";
import { parseJson, serializeJson } from "./jsonParser";
import { parseYaml, serializeYaml } from "./yamlParser";
import type { ParseResult, ParseError } from "./jsonParser";

export type { ParseResult, ParseError } from "./jsonParser";

export function parseDocument(
  text: string,
  fileType: string
): ParseResult | ParseError {
  if (fileType === "yaml") {
    return parseYaml(text);
  }
  return parseJson(text);
}

export function serializeDocument(
  rows: FlatRow[],
  columns: ColumnInfo[],
  fileType: string,
  settings: EditorSettings,
  originalText: string
): string {
  if (fileType === "yaml") {
    return serializeYaml(rows, columns, settings, originalText);
  }
  return serializeJson(rows, columns, settings);
}
