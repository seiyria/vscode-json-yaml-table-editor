export interface ContextMenuCallbacks {
  onDeleteColumn: (columnPath: string) => void;
  onGenerateUuid: (row: number, cell: number) => void;
  onSetNull: (row: number, cell: number) => void;
  onCopyValue: (row: number, cell: number) => void;
  onDrilldown?: (row: number, cell: number) => void;
  onAddRow: (afterIndex: number) => void;
  onDeleteRows: (rowIndices: number[]) => void;
  onDuplicateRows: (rowIndices: number[]) => void;
  onMoveRows: (rowIndices: number[], direction: "up" | "down") => void;
  getSelectedRows: () => number[];
  getTotalRowCount: () => number;
  getCellFromEvent: (e: Event) => { row: number; cell: number } | null;
}

import { columnIdToPath } from "../grid/columnFactory";

export function createContextMenu(
  container: HTMLElement,
  callbacks: ContextMenuCallbacks
) {
  let menu: HTMLDivElement | null = null;

  function removeMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
  }

  container.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeMenu();

    const target = e.target as HTMLElement;
    const header = target.closest(".slick-header-column") as HTMLElement | null;
    const cellEl = target.closest(".slick-cell") as HTMLElement | null;

    menu = document.createElement("div");
    menu.className = "context-menu";
    menu.style.position = "fixed";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.zIndex = "10001";
    menu.style.background = "var(--vscode-menu-background, #252526)";
    menu.style.border = "1px solid var(--vscode-menu-border, #454545)";
    menu.style.padding = "4px 0";
    menu.style.borderRadius = "4px";
    menu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
    menu.style.minWidth = "160px";

    const addItem = (label: string, onClick: () => void) => {
      const item = document.createElement("div");
      item.className = "context-menu-item";
      item.textContent = label;
      item.style.padding = "4px 16px";
      item.style.cursor = "pointer";
      item.style.color = "var(--vscode-menu-foreground, #cccccc)";
      item.addEventListener("mouseenter", () => {
        item.style.background =
          "var(--vscode-menu-selectionBackground, #094771)";
        item.style.color =
          "var(--vscode-menu-selectionForeground, #ffffff)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        item.style.color = "var(--vscode-menu-foreground, #cccccc)";
      });
      item.addEventListener("click", () => {
        onClick();
        removeMenu();
      });
      menu!.appendChild(item);
    };

    if (header) {
      const columnId = header.getAttribute("data-id") || header.dataset.id;
      if (columnId && columnId !== "__rowNum") {
        addItem("Delete Column", () => {
          callbacks.onDeleteColumn(columnIdToPath(columnId));
        });
      }
    }

    if (cellEl) {
      const cellInfo = callbacks.getCellFromEvent(e);
      if (cellInfo && cellInfo.cell === 0) {
        // Row number cell — row operations
        const selected = callbacks.getSelectedRows();
        const rowIndices = selected.length > 0 ? selected : [cellInfo.row];
        addItem("Insert Row Above", () => callbacks.onAddRow(Math.min(...rowIndices) - 1));
        addItem("Insert Row Below", () => callbacks.onAddRow(Math.max(...rowIndices)));
        addItem("Duplicate Row", () => callbacks.onDuplicateRows(rowIndices));
        addItem("Delete Row", () => callbacks.onDeleteRows(rowIndices));
        const totalRows = callbacks.getTotalRowCount();
        if (Math.min(...rowIndices) > 0) {
          addItem("Move Up", () => callbacks.onMoveRows(rowIndices, "up"));
        }
        if (Math.max(...rowIndices) < totalRows - 1) {
          addItem("Move Down", () => callbacks.onMoveRows(rowIndices, "down"));
        }
      } else if (cellInfo && cellInfo.cell > 0) {
        addItem("Copy value", () => callbacks.onCopyValue(cellInfo.row, cellInfo.cell));
        addItem("Set to null", () => callbacks.onSetNull(cellInfo.row, cellInfo.cell));
        addItem("Generate UUID", () => callbacks.onGenerateUuid(cellInfo.row, cellInfo.cell));

        // Show drill-down option for arrayOfObjects cells
        if (callbacks.onDrilldown && cellEl.querySelector(".drilldown-cell")) {
          addItem("Drill into array", () => callbacks.onDrilldown!(cellInfo.row, cellInfo.cell));
        }
      }
    }

    if (menu.children.length === 0) {
      removeMenu();
      return;
    }

    document.body.appendChild(menu);
  });

  document.addEventListener("click", removeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removeMenu();
  });
}
