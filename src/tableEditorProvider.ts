import * as vscode from "vscode";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "../shared/messages";
import type {
  ColumnInfo,
  DrilldownPath,
  FlatRow,
  TableData,
} from "../shared/tableTypes";
import { parseDocument, serializeDocument } from "./parsers";
import { applySubArrayEdit, extractSubArray } from "./parsers/drilldown";
import {
  deriveColumnsFromSchema,
  getSubSchema,
  resolveSchema,
} from "./schema/schemaResolver";
import { validateRows } from "./schema/validator";
import { saveColumnLayout } from "./settings/columnLayout";
import { getEditorSettings } from "./settings/editorSettings";

export class TableEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = "tableEditor.tableView";

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
      ],
    };

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    );

    const nonce = getNonce();

    webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}';
      font-src ${webview.cspSource};
      img-src ${webview.cspSource} data:;">
  <title>YAML/JSON Table Editor</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      height: 100%;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      display: flex;
      flex-direction: column;
    }
    #error-message {
      display: none;
      padding: 20px;
      color: var(--vscode-errorForeground);
    }
    #loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div id="loading">Loading table...</div>
  <div id="error-message"></div>
  <div id="toolbar"></div>
  <div id="breadcrumbs"></div>
  <div id="search-bar"></div>
  <div id="grid-container"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;

    let isApplyingEdit = false;
    let cachedSchema: any = null;
    let schemaColumns: ColumnInfo[] = [];
    let statusBarItem: vscode.StatusBarItem | null = null;
    let schemaStatusBarItem: vscode.StatusBarItem | null = null;
    let currentDrilldownPath: DrilldownPath = [];

    const postMessage = (msg: ExtensionToWebviewMessage) => {
      webview.postMessage(msg);
    };

    const getFileType = (): string => {
      const fsPath = document.uri.fsPath;
      if (fsPath.endsWith(".yaml") || fsPath.endsWith(".yml")) return "yaml";
      return "json";
    };

    const mergeColumns = (
      dataColumns: ColumnInfo[],
      schemaCols: ColumnInfo[],
    ): ColumnInfo[] => {
      if (schemaCols.length === 0) return dataColumns;

      const merged = new Map<string, ColumnInfo>();
      // Schema columns first (canonical order & type authority)
      for (const col of schemaCols) {
        merged.set(col.path, col);
      }
      // Data columns fill in gaps; for existing cols, preserve schema type
      for (const col of dataColumns) {
        const existing = merged.get(col.path);
        if (!existing) {
          merged.set(col.path, col);
        } else if (col.enumValues && !existing.enumValues) {
          // Data found enum values that schema didn't — keep schema type but add enums
          merged.set(col.path, { ...existing, enumValues: col.enumValues });
        }
      }
      return Array.from(merged.values());
    };

    const updateSchemaStatusBar = (hasSchema: boolean) => {
      if (!schemaStatusBarItem) {
        schemaStatusBarItem = vscode.window.createStatusBarItem(
          vscode.StatusBarAlignment.Right,
          99,
        );
      }
      if (hasSchema) {
        schemaStatusBarItem.text = "$(check) Schema linked";
        schemaStatusBarItem.tooltip =
          "YAML/JSON Table Editor: JSON Schema is linked to this file";
      } else {
        schemaStatusBarItem.text = "$(circle-slash) No schema";
        schemaStatusBarItem.tooltip =
          "YAML/JSON Table Editor: No JSON Schema linked. Configure via tableEditor.schemas setting.";
      }
      schemaStatusBarItem.show();
    };

    const updateStatusBar = (errorCount: number) => {
      if (errorCount > 0) {
        if (!statusBarItem) {
          statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100,
          );
        }
        statusBarItem.text = `$(error) ${errorCount} validation error${errorCount === 1 ? "" : "s"}`;
        statusBarItem.tooltip = "YAML/JSON Table Editor: validation errors";
        statusBarItem.show();
      } else if (statusBarItem) {
        statusBarItem.hide();
      }
    };

    /**
     * Build TableData for the current drilldown level.
     * Returns null if extraction fails (e.g. parent row deleted).
     */
    const buildTableData = (
      rootResult: { columns: ColumnInfo[]; rows: FlatRow[] },
      fileType: string,
      msgType: "init" | "update",
    ): TableData | null => {
      let columns: ColumnInfo[];
      let rows: FlatRow[];
      let errors: import("../shared/tableTypes").CellError[];

      if (currentDrilldownPath.length === 0) {
        // Root level
        const schemaCols = cachedSchema
          ? deriveColumnsFromSchema(cachedSchema)
          : [];
        columns = mergeColumns(rootResult.columns, schemaCols);
        rows = rootResult.rows;
        errors = cachedSchema ? validateRows(rows, cachedSchema) : [];
      } else {
        // Drilled-down level
        const subResult = extractSubArray(
          rootResult.rows,
          currentDrilldownPath,
        );
        if ("error" in subResult) {
          // Path invalid — fall back to root
          currentDrilldownPath = [];
          const schemaCols = cachedSchema
            ? deriveColumnsFromSchema(cachedSchema)
            : [];
          columns = mergeColumns(rootResult.columns, schemaCols);
          rows = rootResult.rows;
          errors = cachedSchema ? validateRows(rows, cachedSchema) : [];
        } else {
          // Schema for this sub-level
          let subSchemaColumns: ColumnInfo[] = [];
          if (cachedSchema) {
            const subSchema = getSubSchema(cachedSchema, currentDrilldownPath);
            if (subSchema) {
              subSchemaColumns = deriveColumnsFromSchema(subSchema);
            }
          }
          columns = mergeColumns(subResult.columns, subSchemaColumns);
          rows = subResult.rows;

          // Validate sub-level
          if (cachedSchema) {
            const subSchema = getSubSchema(cachedSchema, currentDrilldownPath);
            if (subSchema) {
              errors = validateRows(rows, subSchema);
            } else {
              errors = [];
            }
          } else {
            errors = [];
          }
        }
      }

      updateStatusBar(errors.length);

      return {
        columns,
        rows,
        fileType,
        hasSchema: cachedSchema !== null,
        errors,
        drilldownPath: currentDrilldownPath,
      };
    };

    const sendTableData = async () => {
      try {
        const text = document.getText();
        const fileType = getFileType();
        const result = parseDocument(text, fileType);

        if ("error" in result) {
          postMessage({ type: "error", message: result.error });
          return;
        }

        // Resolve schema
        cachedSchema = await resolveSchema(document);
        if (cachedSchema) {
          schemaColumns = deriveColumnsFromSchema(cachedSchema);
        }
        updateSchemaStatusBar(cachedSchema !== null);

        const tableData = buildTableData(result, fileType, "init");
        if (tableData) {
          postMessage({ type: "init", data: tableData });
        }
      } catch (e: any) {
        postMessage({
          type: "error",
          message: e.message || "Failed to parse document",
        });
      }
    };

    /**
     * Handle a scoped edit: if drilldownPath is non-empty, extract sub-array,
     * apply the edit function to it, then write back via applySubArrayEdit.
     */
    const handleScopedEdit = async (
      drilldownPath: DrilldownPath | undefined,
      editFn: (
        rows: FlatRow[],
        columns: ColumnInfo[],
      ) => { rows: FlatRow[]; columns: ColumnInfo[] },
    ) => {
      const path = drilldownPath ?? [];
      const text = document.getText();
      const fileType = getFileType();
      const rootResult = parseDocument(text, fileType);
      if ("error" in rootResult) return;

      if (path.length === 0) {
        // Root-level edit
        const edited = editFn(rootResult.rows, rootResult.columns);
        await applyRows(edited.rows, edited.columns, fileType, text);
      } else {
        // Sub-array edit
        const subResult = extractSubArray(rootResult.rows, path);
        if ("error" in subResult) return;

        const edited = editFn(subResult.rows, subResult.columns);
        const newTopRows = applySubArrayEdit(
          rootResult.rows,
          path,
          edited.rows,
        );
        await applyRows(newTopRows, rootResult.columns, fileType, text);
      }
    };

    // Listen for webview messages
    webview.onDidReceiveMessage(
      async (msg: WebviewToExtensionMessage) => {
        switch (msg.type) {
          case "ready":
            sendTableData();
            break;

          case "drilldown": {
            currentDrilldownPath = msg.path;
            sendUpdate();
            break;
          }

          case "drilldownBack": {
            currentDrilldownPath = currentDrilldownPath.slice(0, msg.level);
            sendUpdate();
            break;
          }

          case "editCell": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              if (msg.rowIndex < 0 || msg.rowIndex >= rows.length)
                return { rows, columns };
              if (msg.value === undefined) {
                delete rows[msg.rowIndex][msg.columnPath];
              } else {
                rows[msg.rowIndex][msg.columnPath] = msg.value;
              }
              return { rows, columns };
            });
            break;
          }

          case "addRow": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              const newRow: Record<string, unknown> = {};
              const insertAt =
                msg.afterIndex !== undefined ? msg.afterIndex + 1 : rows.length;
              rows.splice(insertAt, 0, newRow);
              return { rows, columns };
            });
            break;
          }

          case "deleteRows": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              const sorted = [...msg.rowIndices].sort((a, b) => b - a);
              for (const idx of sorted) {
                if (idx >= 0 && idx < rows.length) {
                  rows.splice(idx, 1);
                }
              }
              return { rows, columns };
            });
            break;
          }

          case "duplicateRows": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              const sorted = [...msg.rowIndices].sort((a, b) => a - b);
              let offset = 0;
              for (const idx of sorted) {
                const actualIdx = idx + offset;
                if (actualIdx >= 0 && actualIdx < rows.length) {
                  const clone = { ...rows[actualIdx] };
                  rows.splice(actualIdx + 1, 0, clone);
                  offset++;
                }
              }
              return { rows, columns };
            });
            break;
          }

          case "moveRows": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              const indices = [...msg.rowIndices].sort((a, b) => a - b);
              if (msg.direction === "up") {
                for (const idx of indices) {
                  if (idx > 0 && idx < rows.length) {
                    [rows[idx - 1], rows[idx]] = [rows[idx], rows[idx - 1]];
                  }
                }
              } else {
                for (let i = indices.length - 1; i >= 0; i--) {
                  const idx = indices[i];
                  if (idx >= 0 && idx < rows.length - 1) {
                    [rows[idx], rows[idx + 1]] = [rows[idx + 1], rows[idx]];
                  }
                }
              }
              return { rows, columns };
            });
            break;
          }

          case "addColumn": {
            const name = await vscode.window.showInputBox({
              title: "Add Column",
              prompt:
                "Enter column name (use dots for nested, e.g. address.city)",
              placeHolder: "columnName",
            });
            postMessage({
              type: "promptResult",
              requestId: msg.requestId,
              value: name,
            });

            if (name) {
              await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
                if (rows.length > 0 && !(name in rows[0])) {
                  rows[0][name] = null;
                }
                if (!columns.find((c) => c.path === name)) {
                  columns.push({
                    path: name,
                    label: name,
                    type: "string",
                    fromSchema: false,
                  });
                }
                return { rows, columns };
              });
            }
            break;
          }

          case "deleteColumn": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              for (const row of rows) {
                delete row[msg.columnPath];
              }
              const filtered = columns.filter((c) => c.path !== msg.columnPath);
              return { rows, columns: filtered };
            });
            break;
          }

          case "generateUuid": {
            await handleScopedEdit(msg.drilldownPath, (rows, columns) => {
              for (const cell of msg.cells) {
                if (cell.rowIndex >= 0 && cell.rowIndex < rows.length) {
                  rows[cell.rowIndex][cell.columnPath] = crypto.randomUUID();
                }
              }
              return { rows, columns };
            });
            break;
          }

          case "validate": {
            const text = document.getText();
            const fileType = getFileType();
            const result = parseDocument(text, fileType);
            if ("error" in result) return;

            const schema = cachedSchema ?? (await resolveSchema(document));
            if (schema) {
              if (currentDrilldownPath.length > 0) {
                const subSchema = getSubSchema(schema, currentDrilldownPath);
                if (subSchema) {
                  const subResult = extractSubArray(
                    result.rows,
                    currentDrilldownPath,
                  );
                  if (!("error" in subResult)) {
                    const errors = validateRows(subResult.rows, subSchema);
                    updateStatusBar(errors.length);
                    postMessage({ type: "validationResult", errors });
                    break;
                  }
                }
              }
              const errors = validateRows(result.rows, schema);
              updateStatusBar(errors.length);
              postMessage({ type: "validationResult", errors });
            } else {
              postMessage({ type: "validationResult", errors: [] });
            }
            break;
          }

          case "saveColumnLayout": {
            await saveColumnLayout(document, msg.columns);
            break;
          }
        }
      },
      undefined,
      [],
    );

    // Listen for external document changes
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        if (!isApplyingEdit) {
          sendUpdate();
        }
      }
    });

    // Show/hide status bar items based on panel visibility
    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.visible) {
        statusBarItem?.show();
        schemaStatusBarItem?.show();
      } else {
        statusBarItem?.hide();
        schemaStatusBarItem?.hide();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      statusBarItem?.dispose();
      schemaStatusBarItem?.dispose();
    });

    // Helpers
    const sendUpdate = () => {
      try {
        const text = document.getText();
        const fileType = getFileType();
        const result = parseDocument(text, fileType);

        if ("error" in result) {
          postMessage({ type: "error", message: result.error });
          return;
        }

        const tableData = buildTableData(result, fileType, "update");
        if (tableData) {
          postMessage({ type: "update", data: tableData });
        }
      } catch (e: any) {
        postMessage({
          type: "error",
          message: e.message || "Failed to parse document",
        });
      }
    };

    async function applyRows(
      rows: Record<string, unknown>[],
      columns: {
        path: string;
        label: string;
        type: string;
        fromSchema: boolean;
      }[],
      fileType: string,
      originalText: string,
    ) {
      const settings = getEditorSettings(document);
      const serialized = serializeDocument(
        rows,
        columns as any,
        fileType,
        settings,
        originalText,
      );

      isApplyingEdit = true;
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(originalText.length),
      );
      edit.replace(document.uri, fullRange, serialized);
      await vscode.workspace.applyEdit(edit);
      isApplyingEdit = false;

      sendUpdate();
    }
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
