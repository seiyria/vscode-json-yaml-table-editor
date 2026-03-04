import type { Column, Formatter } from "@slickgrid-universal/common";
import type { ColumnInfo } from "../../shared/tableTypes";
import { TextEditor } from "../editors/textEditor";
import { NumberEditor } from "../editors/numberEditor";
import { BooleanEditor } from "../editors/booleanEditor";
import { EnumEditor } from "../editors/enumEditor";
import { ArrayEditor } from "../editors/arrayEditor";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function withTooltip(text: string): string {
  if (!text) return "";
  return `<span title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}

/** Format cell display values */
const defaultFormatter: Formatter = (_row, _cell, value) => {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return withTooltip(text);
};

const booleanFormatter: Formatter = (_row, _cell, value) => {
  if (value === null || value === undefined) return "";
  return withTooltip(value ? "true" : "false");
};

const arrayFormatter: Formatter = (_row, _cell, value) => {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  if (!text) return "";
  return withTooltip(text);
};

const arrayOfObjectsFormatter: Formatter = (_row, _cell, value) => {
  const count = Array.isArray(value) ? value.length : 0;
  const label = `[${count} item${count === 1 ? "" : "s"}]`;
  return `<span class="drilldown-cell" title="Click to drill into array">${escapeHtml(label)} &#9654;</span>`;
};

/** Convert a dot-delimited path to a safe SlickGrid column ID */
export function pathToColumnId(path: string): string {
  return path.replace(/\./g, "___");
}

/** Convert a sanitized column ID back to a dot-delimited path */
export function columnIdToPath(id: string): string {
  return id.replace(/___/g, ".");
}

/**
 * Build SlickGrid column definitions from ColumnInfo array.
 * Adds a row number column at position 0.
 */
export function buildColumns(columnInfos: ColumnInfo[]): Column[] {
  // Row number column
  const rowNumCol: Column = {
    id: "__rowNum",
    name: "#",
    field: "__rowIndex",
    width: 50,
    minWidth: 40,
    maxWidth: 80,
    resizable: false,
    selectable: false,
    focusable: false,
    cssClass: "row-number-cell",
    headerCssClass: "row-number-header",
    formatter: (_row, _cell, _value, _colDef, dataContext) => {
      return String(
        typeof dataContext.__rowIndex === "number"
          ? dataContext.__rowIndex + 1
          : _row + 1
      );
    },
  };

  const dataCols: Column[] = columnInfos.map((info) => {
    // Ensure minWidth fits the full header label (~8px per char + 24px padding/sort icon)
    const headerMinWidth = Math.max(80, info.label.length * 8 + 24);
    const col: Column = {
      id: pathToColumnId(info.path),
      name: info.label,
      field: info.path,
      minWidth: headerMinWidth,
      width: Math.max(150, headerMinWidth),
      resizable: true,
      sortable: true,
      editor: undefined as any,
      formatter: defaultFormatter,
    };

    switch (info.type) {
      case "number":
        col.editor = { model: NumberEditor };
        break;
      case "boolean":
        col.editor = { model: BooleanEditor };
        col.formatter = booleanFormatter;
        break;
      case "array":
        col.editor = info.enumValues
          ? { model: ArrayEditor, params: { enumValues: info.enumValues } }
          : { model: ArrayEditor };
        col.formatter = arrayFormatter;
        if (info.enumValues) {
          (col as any).__enumValues = info.enumValues;
        }
        break;
      case "arrayOfObjects":
        col.formatter = arrayOfObjectsFormatter;
        col.editor = undefined as any;
        col.cssClass = "cell-drilldown";
        break;
      default:
        if (info.enumValues && info.enumValues.length > 0) {
          col.editor = { model: EnumEditor, params: { enumValues: info.enumValues } };
          (col as any).__enumValues = info.enumValues;
        } else {
          // Default text editor
          col.editor = { model: TextEditor };
        }
        break;
    }

    return col;
  });

  return [rowNumCol, ...dataCols];
}
