import type { FlatRow, ColumnInfo, CellError } from "../../shared/tableTypes";
import type { Column, GridOption } from "@slickgrid-universal/common";
import { Slicker, SlickVanillaGridBundle } from "@slickgrid-universal/vanilla-bundle";

interface CellChangeArgs {
  row: number;
  cell: number;
  item: any;
}

export interface GridCallbacks {
  onCellChange: (rowIndex: number, columnPath: string, value: unknown) => void;
  onCellClick?: (rowIndex: number, cellIndex: number, item: any) => void;
}

export class GridManager {
  private grid: SlickVanillaGridBundle | null = null;
  private dataset: FlatRow[] = [];
  private columnDefs: Column[] = [];
  private filterText = "";
  private callbacks: GridCallbacks;
  private container: HTMLElement;
  private errors: Map<string, string> = new Map();

  constructor(
    container: HTMLElement,
    columns: Column[],
    rows: FlatRow[],
    callbacks: GridCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.columnDefs = columns;
    this.dataset = rows.map((row, idx) => ({ ...row, __rowIndex: idx }));

    this.init();
  }

  private init() {
    this.container.style.width = "100%";
    this.container.style.flex = "1";
    this.container.style.overflow = "hidden";

    const gridOptions: GridOption = {
      enableAutoResize: false,
      enableCellNavigation: true,
      editable: true,
      autoEdit: false,
      enableColumnReorder: true,
      enableColumnResizeOnDoubleClick: true,
      forceFitColumns: true,
      multiColumnSort: false,
      enableRowSelection: true,
      enableColumnPicker: false,
      enableGridMenu: false,
      enableHeaderMenu: false,
      enableContextMenu: false,
      enableCellMenu: false,
      rowHeight: 30,
      headerRowHeight: 35,
      showHeaderRow: false,
      datasetIdPropertyName: "__rowIndex",
      rowSelectionOptions: {
        selectActiveRow: true,
      },
    };

    this.grid = new Slicker.GridBundle(
      this.container,
      this.columnDefs,
      gridOptions,
      this.dataset
    );

    // Subscribe to cell change
    if (this.grid?.slickGrid) {
      this.grid.slickGrid.onCellChange.subscribe(
        (_e: any, args: CellChangeArgs) => {
          const row = args.item as FlatRow;
          const colDef = this.columnDefs[args.cell];
          if (colDef && colDef.field) {
            const value = row[colDef.field];
            const rowIndex =
              typeof row.__rowIndex === "number"
                ? row.__rowIndex
                : args.row;
            this.callbacks.onCellChange(rowIndex, colDef.field, value);
          }
        }
      );

      // Cell click handler
      this.grid.slickGrid.onClick.subscribe(
        (_e: any, args: { row: number; cell: number }) => {
          if (this.callbacks.onCellClick) {
            const item = this.grid?.dataView?.getItem(args.row);
            const rowIndex =
              item && typeof item.__rowIndex === "number"
                ? item.__rowIndex
                : args.row;
            this.callbacks.onCellClick(rowIndex, args.cell, item);
          }
        }
      );

      // Sort handler — 3-state cycle
      this.grid!.slickGrid!.onSort.subscribe((_e: any, args: any) => {
        const col = args.sortCol;
        const field = col?.field;
        if (!field || !this.grid?.dataView) return;

        const asc = args.sortAsc;
        this.grid.dataView.sort((a: FlatRow, b: FlatRow) => {
          const va = a[field];
          const vb = b[field];
          if (va === vb) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          if (typeof va === "number" && typeof vb === "number") {
            return asc ? va - vb : vb - va;
          }
          const sa = String(va).toLowerCase();
          const sb = String(vb).toLowerCase();
          const cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
          return asc ? cmp : -cmp;
        });
      });
    }

    // Initial layout
    this.resize();
  }

  /** Resize the grid to fill the available space and re-fit columns */
  resize() {
    if (!this.grid?.slickGrid) return;

    const width = document.body.clientWidth;
    const height = this.container.clientHeight || this.container.offsetHeight;
    if (width <= 0) return;

    // Set explicit dimensions on all SlickGrid container elements
    this.container.style.width = width + "px";
    const gridEl = this.container.querySelector('.slickgrid-container') as HTMLElement;
    if (gridEl) {
      gridEl.style.width = width + "px";
      if (height > 0) gridEl.style.height = height + "px";
    }

    this.grid.slickGrid.resizeCanvas();

    // forceFitColumns should handle column widths, but we need to
    // explicitly trigger it by re-setting columns after canvas resize
    const columns = this.grid.slickGrid.getColumns();
    this.grid.slickGrid.setColumns(columns);
    this.grid.slickGrid.resizeCanvas();
  }

  updateData(rows: FlatRow[], columns: ColumnInfo[], errors: CellError[], slickColumns?: Column[]) {
    this.errors.clear();
    for (const err of errors) {
      this.errors.set(err.key, err.message);
    }

    this.dataset = rows.map((row, idx) => ({ ...row, __rowIndex: idx }));

    if (this.grid?.dataView) {
      if (slickColumns && this.columnsChanged(slickColumns)) {
        this.columnDefs = slickColumns;
        this.grid.slickGrid?.setColumns(slickColumns);
        this.resize();
      }
      this.grid.dataView.setItems(this.dataset, "__rowIndex");
      if (this.filterText) {
        this.applyFilter();
      }
      this.applyErrorStyles();
      this.grid.slickGrid?.invalidate();
      this.grid.slickGrid?.render();
    }
  }

  setErrors(errors: CellError[]) {
    this.errors.clear();
    for (const err of errors) {
      this.errors.set(err.key, err.message);
    }
    this.applyErrorStyles();
    this.grid?.slickGrid?.invalidate();
    this.grid?.slickGrid?.render();
  }

  private applyErrorStyles() {
    if (!this.grid?.slickGrid) return;

    // Build a hash of { rowIndex: { columnId: cssClass } }
    const hash: Record<number, Record<string, string>> = {};

    // Build a column field-to-index map (skip row number col at 0)
    const fieldToColIdx: Record<string, number> = {};
    for (let i = 0; i < this.columnDefs.length; i++) {
      const field = this.columnDefs[i].field;
      if (field) fieldToColIdx[field] = i;
    }

    for (const [key, _message] of this.errors) {
      const sepIdx = key.indexOf(":");
      if (sepIdx < 0) continue;
      const rowIndex = parseInt(key.slice(0, sepIdx), 10);
      const columnPath = key.slice(sepIdx + 1);
      if (isNaN(rowIndex) || !columnPath) continue;

      const colIdx = fieldToColIdx[columnPath];
      if (colIdx === undefined) continue;

      const colId = this.columnDefs[colIdx].id as string;
      if (!hash[rowIndex]) hash[rowIndex] = {};
      hash[rowIndex][colId] = "cell-validation-error";
    }

    this.grid.slickGrid.setCellCssStyles("validation-errors", hash);

    // Store error tooltips as data attributes on cells after render
    this.grid.slickGrid.onRendered?.subscribe(() => {
      this.applyErrorTooltips();
    });
    // Also apply immediately for current view
    requestAnimationFrame(() => this.applyErrorTooltips());
  }

  private applyErrorTooltips() {
    if (!this.grid?.slickGrid) return;
    for (const [key, message] of this.errors) {
      const sepIdx = key.indexOf(":");
      if (sepIdx < 0) continue;
      const rowIndex = parseInt(key.slice(0, sepIdx), 10);
      const columnPath = key.slice(sepIdx + 1);
      if (isNaN(rowIndex) || !columnPath) continue;

      // Find column index
      const colIdx = this.columnDefs.findIndex((c) => c.field === columnPath);
      if (colIdx < 0) continue;

      const cellNode = this.grid.slickGrid.getCellNode(rowIndex, colIdx);
      if (cellNode) {
        cellNode.title = message;
      }
    }
  }

  getSelectedRows(): number[] {
    if (!this.grid?.slickGrid) return [];
    return this.grid.slickGrid.getSelectedRows() ?? [];
  }

  getActiveCell(): { row: number; cell: number } | null {
    if (!this.grid?.slickGrid) return null;
    return this.grid.slickGrid.getActiveCell() ?? null;
  }

  getCellFromEvent(e: Event): { row: number; cell: number } | null {
    if (!this.grid?.slickGrid) return null;
    return (this.grid.slickGrid as any).getCellFromEvent(e) ?? null;
  }

  setFilter(text: string) {
    this.filterText = text.toLowerCase();
    this.applyFilter();
  }

  /** Reset view state when drill-down level changes */
  resetView() {
    this.filterText = "";
    this.errors.clear();
    if (this.grid?.dataView) {
      this.grid.dataView.setFilter(() => true);
    }
    if (this.grid?.slickGrid) {
      this.grid.slickGrid.setSortColumns([]);
      this.grid.slickGrid.setCellCssStyles("validation-errors", {});
      this.grid.slickGrid.invalidate();
      this.grid.slickGrid.render();
    }
  }

  private applyFilter() {
    if (!this.grid?.dataView) return;

    if (!this.filterText) {
      this.grid.dataView.setFilter(() => true);
    } else {
      const search = this.filterText;
      this.grid.dataView.setFilter((item: FlatRow) => {
        for (const val of Object.values(item)) {
          if (val === undefined || val === null) continue;
          if (String(val).toLowerCase().includes(search)) return true;
        }
        return false;
      });
    }

    this.grid.slickGrid?.invalidate();
    this.grid.slickGrid?.render();
  }

  private columnsChanged(newColumns: Column[]): boolean {
    if (newColumns.length !== this.columnDefs.length) return true;
    for (let i = 0; i < newColumns.length; i++) {
      if (newColumns[i].id !== this.columnDefs[i].id) return true;
    }
    return false;
  }

  destroy() {
    this.grid?.dispose();
    this.grid = null;
  }
}
