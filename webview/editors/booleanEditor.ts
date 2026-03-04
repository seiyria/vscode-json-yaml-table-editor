/**
 * SlickGrid custom editor for boolean cells.
 * Dropdown with true / false / (null) options.
 */
export class BooleanEditor {
  private select!: HTMLSelectElement;
  private originalValue: boolean | null = null;
  private args: any;

  constructor(args: any) {
    this.args = args;
    this.init();
  }

  init() {
    this.select = document.createElement("select");
    this.select.style.width = "100%";
    this.select.style.height = "100%";
    this.select.style.background = "var(--vscode-dropdown-background, #3c3c3c)";
    this.select.style.color = "var(--vscode-dropdown-foreground, #cccccc)";
    this.select.style.border = "1px solid var(--vscode-dropdown-border, #555)";
    this.select.style.fontFamily = "var(--vscode-font-family)";
    this.select.style.fontSize = "13px";
    this.select.style.padding = "0 4px";
    this.select.style.outline = "none";

    for (const opt of ["true", "false", "(null)"]) {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      this.select.appendChild(option);
    }

    this.args.container.appendChild(this.select);
    this.select.focus();
  }

  destroy() {
    this.select.remove();
  }

  focus() {
    this.select.focus();
  }

  loadValue(item: any) {
    const val = item[this.args.column.field];
    this.originalValue = val === true ? true : val === false ? false : null;
    this.select.value =
      this.originalValue === true
        ? "true"
        : this.originalValue === false
          ? "false"
          : "(null)";
  }

  serializeValue(): boolean | null {
    const val = this.select.value;
    if (val === "true") return true;
    if (val === "false") return false;
    return null;
  }

  applyValue(item: any, state: boolean | null) {
    item[this.args.column.field] = state;
  }

  isValueChanged() {
    return this.serializeValue() !== this.originalValue;
  }

  validate() {
    return { valid: true, msg: null };
  }
}
