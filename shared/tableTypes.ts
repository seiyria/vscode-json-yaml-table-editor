/** A flat row where nested objects are dot-delimited keys */
export interface FlatRow {
  [columnPath: string]: unknown;
}

/** Column type as inferred from data or schema */
export type ColumnType = "string" | "number" | "boolean" | "array" | "arrayOfObjects" | "object" | "unknown";

/** A segment of a drilldown navigation path */
export interface DrilldownSegment {
  /** Row index in the parent table */
  rowIndex: number;
  /** Field path of the array column (e.g. "bonuses") */
  fieldPath: string;
  /** Display label for breadcrumbs (e.g. "Row 1 > bonuses") */
  label: string;
}

/** Full drilldown path from root to current level */
export type DrilldownPath = DrilldownSegment[];

/** Metadata about a single column */
export interface ColumnInfo {
  /** Dot-delimited path (e.g. "address.city") */
  path: string;
  /** Display label for column header */
  label: string;
  /** Inferred or schema-driven type */
  type: ColumnType;
  /** Enum values from schema, if any */
  enumValues?: string[];
  /** Whether this column came from a schema vs data inference */
  fromSchema: boolean;
}

/** Validation error for a specific cell */
export interface CellError {
  /** "rowIndex:columnPath" */
  key: string;
  message: string;
}

/** Full table data sent from extension host to webview */
export interface TableData {
  columns: ColumnInfo[];
  rows: FlatRow[];
  errors: CellError[];
  /** The file extension (.json, .yaml, .yml) */
  fileType: string;
  /** Whether a schema was found and applied */
  hasSchema: boolean;
  /** Current drilldown path (empty = root level) */
  drilldownPath: DrilldownPath;
}
