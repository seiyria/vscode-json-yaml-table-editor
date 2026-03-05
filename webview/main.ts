import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "../shared/messages";
import type { TableData, FlatRow, ColumnInfo, DrilldownPath } from "../shared/tableTypes";
import { GridManager } from "./grid/gridManager";
import { buildColumns } from "./grid/columnFactory";
import { createToolbar } from "./toolbar/toolbar";
import { createSearchBar } from "./toolbar/searchBar";
import { createBreadcrumbs } from "./toolbar/breadcrumbs";
import { createContextMenu } from "./context/contextMenu";
import slickgridBaseCss from "@slickgrid-universal/common/dist/styles/css/slickgrid-theme-default.lite.css";
import slickgridCss from "./theme/slickgrid-vscode.css";

// Inject styles — base first, then our overrides
const baseStyleEl = document.createElement("style");
baseStyleEl.textContent = slickgridBaseCss;
document.head.appendChild(baseStyleEl);

const styleEl = document.createElement("style");
styleEl.textContent = slickgridCss;
document.head.appendChild(styleEl);

// Acquire VS Code API
const vscode = acquireVsCodeApi();

function postMessage(msg: WebviewToExtensionMessage) {
  vscode.postMessage(msg);
}

/** Attach drilldownPath to an outgoing edit message */
function withDrilldown<T>(msg: T): T & { drilldownPath?: DrilldownPath } {
  if (currentDrilldownPath.length > 0) {
    return { ...msg, drilldownPath: currentDrilldownPath };
  }
  return msg;
}

let gridManager: GridManager | null = null;
let currentData: TableData | null = null;
let toolbar: ReturnType<typeof createToolbar> | null = null;
let searchBar: ReturnType<typeof createSearchBar> | null = null;
let breadcrumbs: ReturnType<typeof createBreadcrumbs> | null = null;
let currentDrilldownPath: DrilldownPath = [];

/** Get a display label for a row — prefers name, then id, falls back to "Row N" */
function getRowLabel(row: number): string {
  if (!currentData) return `Row ${row + 1}`;
  const rowData = currentData.rows[row];
  if (!rowData) return `Row ${row + 1}`;
  const name = rowData["name"] ?? rowData["Name"];
  if (name != null && name !== "") return String(name);
  const id = rowData["id"] ?? rowData["Id"] ?? rowData["ID"];
  if (id != null && id !== "") return String(id);
  return `Row ${row + 1}`;
}

function drilldownPathsEqual(a: DrilldownPath, b: DrilldownPath): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].rowIndex !== b[i].rowIndex || a[i].fieldPath !== b[i].fieldPath) return false;
  }
  return true;
}

// Message handling
window.addEventListener("message", (event) => {
  const msg = event.data as ExtensionToWebviewMessage;

  switch (msg.type) {
    case "init":
      hideLoading();
      currentData = msg.data;
      currentDrilldownPath = msg.data.drilldownPath ?? [];
      initGrid(msg.data);
      break;

    case "update": {
      currentData = msg.data;
      const newPath = msg.data.drilldownPath ?? [];
      const pathChanged = !drilldownPathsEqual(currentDrilldownPath, newPath);
      currentDrilldownPath = newPath;

      if (gridManager) {
        if (pathChanged) {
          gridManager.resetView();
        }
        const updatedColumns = buildColumns(msg.data.columns);
        gridManager.updateData(msg.data.rows, msg.data.columns, msg.data.errors, updatedColumns);
      }
      if (toolbar) {
        toolbar.updateRowCount(msg.data.rows.length);
      }
      if (breadcrumbs) {
        breadcrumbs.update(currentDrilldownPath);
      }
      break;
    }

    case "error":
      hideLoading();
      showError(msg.message);
      break;

    case "validationResult":
      if (gridManager) {
        gridManager.setErrors(msg.errors);
      }
      if (toolbar) {
        toolbar.updateErrorCount(msg.errors.length);
      }
      break;

    case "promptResult":
      // Handled by pending promise resolvers if needed
      break;
  }
});

function hideLoading() {
  const el = document.getElementById("loading");
  if (el) el.style.display = "none";
}

function showError(message: string) {
  const el = document.getElementById("error-message");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
  const grid = document.getElementById("grid-container");
  if (grid) grid.style.display = "none";
  const tb = document.getElementById("toolbar");
  if (tb) tb.style.display = "none";
}

function initGrid(data: TableData) {
  const errorEl = document.getElementById("error-message");
  if (errorEl) errorEl.style.display = "none";
  const gridContainer = document.getElementById("grid-container");
  if (gridContainer) gridContainer.style.display = "block";
  const toolbarEl = document.getElementById("toolbar");
  if (toolbarEl) toolbarEl.style.display = "block";

  // Build toolbar
  toolbar = createToolbar(
    document.getElementById("toolbar")!,
    {
      onAddRow: () => {
        const sel = gridManager?.getSelectedRows() ?? [];
        const afterIndex = sel.length > 0 ? Math.max(...sel) : undefined;
        postMessage(withDrilldown({ type: "addRow" as const, afterIndex }));
      },
      onDeleteRows: () => {
        const sel = gridManager?.getSelectedRows() ?? [];
        if (sel.length === 0) return;
        postMessage(withDrilldown({ type: "deleteRows" as const, rowIndices: sel }));
      },
      onDuplicateRows: () => {
        const sel = gridManager?.getSelectedRows() ?? [];
        if (sel.length === 0) return;
        postMessage(withDrilldown({ type: "duplicateRows" as const, rowIndices: sel }));
      },
      onMoveUp: () => {
        const sel = gridManager?.getSelectedRows() ?? [];
        if (sel.length === 0) return;
        postMessage(withDrilldown({ type: "moveRows" as const, rowIndices: sel, direction: "up" as const }));
      },
      onMoveDown: () => {
        const sel = gridManager?.getSelectedRows() ?? [];
        if (sel.length === 0) return;
        postMessage(withDrilldown({ type: "moveRows" as const, rowIndices: sel, direction: "down" as const }));
      },
      onAddColumn: () => {
        const requestId = crypto.randomUUID();
        postMessage(withDrilldown({ type: "addColumn" as const, requestId }));
      },
      onGenerateUuids: () => {
        if (!gridManager || !currentData) return;
        const activeCell = gridManager.getActiveCell();
        if (!activeCell) return;
        const col = currentData.columns[activeCell.cell - 1]; // -1 for row number column
        if (!col) return;
        postMessage(withDrilldown({
          type: "generateUuid" as const,
          cells: [{ rowIndex: activeCell.row, columnPath: col.path }],
        }));
      },
      onSearch: () => {
        if (searchBar) searchBar.toggle();
      },
      onValidate: () => {
        postMessage({ type: "validate" });
      },
    },
    data.rows.length
  );

  // Build search bar
  searchBar = createSearchBar(
    document.getElementById("search-bar")!,
    (filter: string) => {
      if (gridManager) gridManager.setFilter(filter);
    }
  );

  // Build breadcrumbs
  breadcrumbs = createBreadcrumbs(
    document.getElementById("breadcrumbs")!,
    {
      onNavigate: (level: number) => {
        postMessage({ type: "drilldownBack", level });
      },
    }
  );
  breadcrumbs.update(data.drilldownPath ?? []);

  // Build context menu (after gridManager is created)
  const initContextMenu = () => {
    createContextMenu(
      document.getElementById("grid-container")!,
      {
        onDeleteColumn: (columnPath: string) => {
          postMessage(withDrilldown({ type: "deleteColumn" as const, columnPath }));
        },
        onGenerateUuid: (row: number, cell: number) => {
          if (!currentData) return;
          const col = currentData.columns[cell - 1]; // -1 for row number column
          if (!col) return;
          postMessage(withDrilldown({
            type: "generateUuid" as const,
            cells: [{ rowIndex: row, columnPath: col.path }],
          }));
        },
        onSetNull: (row: number, cell: number) => {
          if (!currentData) return;
          const col = currentData.columns[cell - 1];
          if (!col) return;
          postMessage(withDrilldown({ type: "editCell" as const, rowIndex: row, columnPath: col.path, value: null }));
        },
        onEditValue: (row: number, cell: number) => {
          if (!currentData) return;
          const col = currentData.columns[cell - 1];
          if (!col) return;
          const currentVal = currentData.rows[row]?.[col.path];
          const text = currentVal === null || currentVal === undefined ? "" : String(currentVal);
          showEditDialog(text, (newValue) => {
            let value: unknown = newValue;
            if (col.type === "number" && newValue !== null) {
              const num = Number(newValue);
              if (!isNaN(num)) value = num;
            } else if (col.type === "boolean" && newValue !== null) {
              value = newValue === "true";
            }
            postMessage(withDrilldown({ type: "editCell" as const, rowIndex: row, columnPath: col.path, value }));
          });
        },
        onCopyValue: (row: number, cell: number) => {
          if (!currentData) return;
          const col = currentData.columns[cell - 1];
          if (!col) return;
          const val = currentData.rows[row]?.[col.path];
          const text = val === null || val === undefined ? "" : Array.isArray(val) ? val.join(", ") : String(val);
          navigator.clipboard.writeText(text);
        },
        onDrilldown: (row: number, cell: number) => {
          if (!currentData) return;
          const col = currentData.columns[cell - 1];
          if (!col || col.type !== "arrayOfObjects") return;
          const newSegment = {
            rowIndex: row,
            fieldPath: col.path,
            label: `${getRowLabel(row)} > ${col.path}`,
          };
          postMessage({
            type: "drilldown",
            path: [...currentDrilldownPath, newSegment],
          });
        },
        onAddRow: (afterIndex: number) => {
          postMessage(withDrilldown({ type: "addRow" as const, afterIndex }));
        },
        onDeleteRows: (rowIndices: number[]) => {
          postMessage(withDrilldown({ type: "deleteRows" as const, rowIndices }));
        },
        onDuplicateRows: (rowIndices: number[]) => {
          postMessage(withDrilldown({ type: "duplicateRows" as const, rowIndices }));
        },
        onMoveRows: (rowIndices: number[], direction: "up" | "down") => {
          postMessage(withDrilldown({ type: "moveRows" as const, rowIndices, direction }));
        },
        getSelectedRows: () => gridManager?.getSelectedRows() ?? [],
        getTotalRowCount: () => currentData?.rows.length ?? 0,
        getCellFromEvent: (e: Event) => {
          return gridManager?.getCellFromEvent(e) ?? null;
        },
      }
    );
  };

  // Build and init grid
  const columns = buildColumns(data.columns);

  gridManager = new GridManager(
    document.getElementById("grid-container")!,
    columns,
    data.rows,
    {
      onCellChange: (rowIndex: number, columnPath: string, value: unknown) => {
        postMessage(withDrilldown({ type: "editCell" as const, rowIndex, columnPath, value }));
      },
      onCellClick: (rowIndex: number, cellIndex: number, _item: any) => {
        if (!currentData) return;
        const col = currentData.columns[cellIndex - 1]; // -1 for row number column
        if (!col || col.type !== "arrayOfObjects") return;
        const newSegment = {
          rowIndex,
          fieldPath: col.path,
          label: `${getRowLabel(rowIndex)} > ${col.path}`,
        };
        postMessage({
          type: "drilldown",
          path: [...currentDrilldownPath, newSegment],
        });
      },
    }
  );

  initContextMenu();

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+I: Insert row
    if (e.ctrlKey && e.key === "i" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const sel = gridManager?.getSelectedRows() ?? [];
      const afterIndex = sel.length > 0 ? Math.max(...sel) : undefined;
      postMessage(withDrilldown({ type: "addRow" as const, afterIndex }));
    }

    // Ctrl+D: Duplicate row
    if (e.ctrlKey && e.key === "d" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const sel = gridManager?.getSelectedRows() ?? [];
      if (sel.length > 0) {
        postMessage(withDrilldown({ type: "duplicateRows" as const, rowIndices: sel }));
      }
    }

    // Delete: Clear active cell
    if (e.key === "Delete" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (!gridManager || !currentData) return;
      const activeCell = gridManager.getActiveCell();
      if (activeCell) {
        const col = currentData.columns[activeCell.cell - 1]; // -1 for row number column
        if (col) {
          e.preventDefault();
          postMessage(withDrilldown({ type: "editCell" as const, rowIndex: activeCell.row, columnPath: col.path, value: undefined }));
        }
      }
    }

    // Ctrl+Delete: Delete row
    if (e.ctrlKey && e.key === "Delete" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const sel = gridManager?.getSelectedRows() ?? [];
      if (sel.length > 0) {
        postMessage(withDrilldown({ type: "deleteRows" as const, rowIndices: sel }));
      }
    }

    // Alt+Up: Move row up
    if (e.altKey && e.key === "ArrowUp" && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      const sel = gridManager?.getSelectedRows() ?? [];
      if (sel.length > 0) {
        postMessage(withDrilldown({ type: "moveRows" as const, rowIndices: sel, direction: "up" as const }));
      }
    }

    // Alt+Down: Move row down
    if (e.altKey && e.key === "ArrowDown" && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      const sel = gridManager?.getSelectedRows() ?? [];
      if (sel.length > 0) {
        postMessage(withDrilldown({ type: "moveRows" as const, rowIndices: sel, direction: "down" as const }));
      }
    }

    // Alt+Left: Navigate up one drill-down level
    if (e.altKey && e.key === "ArrowLeft" && !e.ctrlKey && !e.shiftKey) {
      if (currentDrilldownPath.length > 0) {
        e.preventDefault();
        postMessage({ type: "drilldownBack", level: currentDrilldownPath.length - 1 });
      }
    }

    // Backspace: Navigate up one drill-down level (when not editing)
    if (e.key === "Backspace" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      // Only navigate if not editing a cell
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        activeEl.tagName === "INPUT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.tagName === "SELECT" ||
        (activeEl as HTMLElement).isContentEditable
      );
      if (!isEditing && currentDrilldownPath.length > 0) {
        e.preventDefault();
        postMessage({ type: "drilldownBack", level: currentDrilldownPath.length - 1 });
      }
    }

    // Ctrl+F: Toggle search
    if (e.ctrlKey && e.key === "f" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (searchBar) searchBar.toggle();
    }

    // Ctrl+C: Copy as TSV
    if (e.ctrlKey && e.key === "c" && !e.shiftKey && !e.altKey) {
      if (!gridManager || !currentData) return;
      const activeCell = gridManager.getActiveCell();
      const selectedRows = gridManager.getSelectedRows();

      if (selectedRows.length > 1) {
        // Multi-row: TSV
        const cols = currentData.columns;
        const lines = selectedRows.map((rowIdx) => {
          const row = currentData!.rows[rowIdx];
          return cols.map((c) => formatCellValue(row[c.path])).join("\t");
        });
        navigator.clipboard.writeText(lines.join("\n"));
        e.preventDefault();
      } else if (activeCell) {
        const col = currentData.columns[activeCell.cell - 1];
        if (col) {
          const val = currentData.rows[activeCell.row]?.[col.path];
          navigator.clipboard.writeText(formatCellValue(val));
          e.preventDefault();
        }
      }
    }
  });
}

function showEditDialog(currentValue: string, onSave: (value: string | null) => void) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "10002";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.4)";

  const dialog = document.createElement("div");
  dialog.style.background = "var(--vscode-editor-background, #1e1e1e)";
  dialog.style.border = "1px solid var(--vscode-menu-border, #454545)";
  dialog.style.borderRadius = "6px";
  dialog.style.padding = "12px";
  dialog.style.minWidth = "300px";
  dialog.style.maxWidth = "500px";
  dialog.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";

  const label = document.createElement("div");
  label.textContent = "Edit value:";
  label.style.color = "var(--vscode-foreground, #cccccc)";
  label.style.marginBottom = "8px";
  label.style.fontSize = "13px";
  dialog.appendChild(label);

  const textarea = document.createElement("textarea");
  textarea.value = currentValue;
  textarea.style.width = "100%";
  textarea.style.minHeight = "80px";
  textarea.style.maxHeight = "300px";
  textarea.style.resize = "vertical";
  textarea.style.background = "var(--vscode-input-background, #3c3c3c)";
  textarea.style.color = "var(--vscode-input-foreground, #cccccc)";
  textarea.style.border = "1px solid var(--vscode-focusBorder, #007fd4)";
  textarea.style.borderRadius = "2px";
  textarea.style.padding = "6px";
  textarea.style.boxSizing = "border-box";
  textarea.style.fontFamily = "var(--vscode-font-family)";
  textarea.style.fontSize = "13px";
  textarea.style.outline = "none";
  dialog.appendChild(textarea);

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.justifyContent = "flex-end";
  buttons.style.gap = "8px";
  buttons.style.marginTop = "8px";

  const btnStyle = (btn: HTMLButtonElement) => {
    btn.style.padding = "4px 12px";
    btn.style.border = "none";
    btn.style.borderRadius = "2px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "13px";
    btn.style.fontFamily = "var(--vscode-font-family)";
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  btnStyle(cancelBtn);
  cancelBtn.style.background = "var(--vscode-button-secondaryBackground, #3a3d41)";
  cancelBtn.style.color = "var(--vscode-button-secondaryForeground, #cccccc)";
  buttons.appendChild(cancelBtn);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  btnStyle(saveBtn);
  saveBtn.style.background = "var(--vscode-button-background, #0e639c)";
  saveBtn.style.color = "var(--vscode-button-foreground, #ffffff)";
  buttons.appendChild(saveBtn);

  dialog.appendChild(buttons);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  textarea.focus();
  textarea.setSelectionRange(0, textarea.value.length);

  const close = () => overlay.remove();

  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  saveBtn.addEventListener("click", () => {
    const val = textarea.value;
    onSave(val === "" ? null : val);
    close();
  });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      const val = textarea.value;
      onSave(val === "" ? null : val);
      close();
    }
  });
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

// Resize columns to fill width on any resize event
let resizeTimer: number | null = null;
function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (gridManager) {
      gridManager.resize();
    }
  }, 100);
}
window.addEventListener("resize", handleResize);

// Also use ResizeObserver on document.body as a fallback
const bodyObserver = new ResizeObserver(handleResize);
bodyObserver.observe(document.body);

// Tell extension we're ready
postMessage({ type: "ready" });

// Declare VS Code API type
declare function acquireVsCodeApi(): {
  postMessage(msg: any): void;
  getState(): any;
  setState(state: any): void;
};
