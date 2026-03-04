export interface ToolbarCallbacks {
  onAddRow: () => void;
  onDeleteRows: () => void;
  onDuplicateRows: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddColumn: () => void;
  onGenerateUuids: () => void;
  onSearch: () => void;
  onValidate: () => void;
}

export function createToolbar(
  container: HTMLElement,
  callbacks: ToolbarCallbacks,
  initialRowCount: number
) {
  container.innerHTML = "";
  container.className = "table-toolbar";

  const buttons: Array<{ label: string; icon: string; onClick: () => void }> = [
    { label: "Add Row", icon: "codicon-add", onClick: callbacks.onAddRow },
    { label: "Delete Row", icon: "codicon-trash", onClick: callbacks.onDeleteRows },
    { label: "Duplicate Row", icon: "codicon-copy", onClick: callbacks.onDuplicateRows },
    { label: "Move Up", icon: "codicon-arrow-up", onClick: callbacks.onMoveUp },
    { label: "Move Down", icon: "codicon-arrow-down", onClick: callbacks.onMoveDown },
    { label: "Add Column", icon: "codicon-split-horizontal", onClick: callbacks.onAddColumn },
    { label: "Generate UUID", icon: "codicon-key", onClick: callbacks.onGenerateUuids },
    { label: "Search", icon: "codicon-search", onClick: callbacks.onSearch },
    { label: "Validate", icon: "codicon-check-all", onClick: callbacks.onValidate },
  ];

  const btnGroup = document.createElement("div");
  btnGroup.className = "toolbar-buttons";

  for (const btn of buttons) {
    const el = document.createElement("button");
    el.className = "toolbar-btn";
    el.title = btn.label;
    el.innerHTML = `<span class="${btn.icon}"></span> ${btn.label}`;
    el.addEventListener("click", btn.onClick);
    btnGroup.appendChild(el);
  }

  container.appendChild(btnGroup);

  const info = document.createElement("div");
  info.style.display = "flex";
  info.style.gap = "8px";
  info.style.alignItems = "center";

  const rowCount = document.createElement("span");
  rowCount.className = "row-count";
  rowCount.textContent = `${initialRowCount} rows`;
  info.appendChild(rowCount);

  const errorCount = document.createElement("span");
  errorCount.className = "row-count validation-count";
  errorCount.style.display = "none";
  info.appendChild(errorCount);

  container.appendChild(info);

  return {
    updateRowCount(count: number) {
      rowCount.textContent = `${count} rows`;
    },
    updateErrorCount(count: number) {
      if (count > 0) {
        errorCount.textContent = `${count} error${count === 1 ? "" : "s"}`;
        errorCount.style.display = "";
        errorCount.style.color = "var(--vscode-errorForeground, #f48771)";
      } else {
        errorCount.textContent = "Valid";
        errorCount.style.display = "";
        errorCount.style.color = "var(--vscode-testing-iconPassed, #73c991)";
      }
    },
    hideErrorCount() {
      errorCount.style.display = "none";
    },
  };
}
