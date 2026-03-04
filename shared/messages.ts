import type { TableData, FlatRow, ColumnInfo, DrilldownPath } from "./tableTypes";

// ─── Messages from extension host → webview ───

export interface InitMessage {
  type: "init";
  data: TableData;
}

export interface UpdateMessage {
  type: "update";
  data: TableData;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface PromptResultMessage {
  type: "promptResult";
  requestId: string;
  value: string | undefined;
}

export interface ValidationResultMessage {
  type: "validationResult";
  errors: import("./tableTypes").CellError[];
}

export type ExtensionToWebviewMessage =
  | InitMessage
  | UpdateMessage
  | ErrorMessage
  | PromptResultMessage
  | ValidationResultMessage;

// ─── Messages from webview → extension host ───

export interface ReadyMessage {
  type: "ready";
}

export interface EditCellMessage {
  type: "editCell";
  rowIndex: number;
  columnPath: string;
  value: unknown;
  drilldownPath?: DrilldownPath;
}

export interface AddRowMessage {
  type: "addRow";
  afterIndex?: number;
  drilldownPath?: DrilldownPath;
}

export interface DeleteRowsMessage {
  type: "deleteRows";
  rowIndices: number[];
  drilldownPath?: DrilldownPath;
}

export interface DuplicateRowsMessage {
  type: "duplicateRows";
  rowIndices: number[];
  drilldownPath?: DrilldownPath;
}

export interface MoveRowsMessage {
  type: "moveRows";
  rowIndices: number[];
  direction: "up" | "down";
  drilldownPath?: DrilldownPath;
}

export interface AddColumnMessage {
  type: "addColumn";
  requestId: string;
  drilldownPath?: DrilldownPath;
}

export interface DeleteColumnMessage {
  type: "deleteColumn";
  columnPath: string;
  drilldownPath?: DrilldownPath;
}

export interface GenerateUuidMessage {
  type: "generateUuid";
  cells: Array<{ rowIndex: number; columnPath: string }>;
  drilldownPath?: DrilldownPath;
}

export interface DrilldownMessage {
  type: "drilldown";
  path: DrilldownPath;
}

export interface DrilldownBackMessage {
  type: "drilldownBack";
  level: number;
}

export interface RequestPromptMessage {
  type: "requestPrompt";
  requestId: string;
  title: string;
  placeholder?: string;
}

export interface SaveColumnLayoutMessage {
  type: "saveColumnLayout";
  columns: Array<{ path: string; width: number }>;
}

export interface ValidateMessage {
  type: "validate";
}

export type WebviewToExtensionMessage =
  | ReadyMessage
  | EditCellMessage
  | AddRowMessage
  | DeleteRowsMessage
  | DuplicateRowsMessage
  | MoveRowsMessage
  | AddColumnMessage
  | DeleteColumnMessage
  | GenerateUuidMessage
  | RequestPromptMessage
  | SaveColumnLayoutMessage
  | ValidateMessage
  | DrilldownMessage
  | DrilldownBackMessage;
