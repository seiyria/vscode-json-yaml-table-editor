/**
 * SlickGrid custom editor for number cells.
 * Rejects non-numeric input.
 */
export class NumberEditor {
  private input!: HTMLInputElement;
  private originalValue: any;
  private args: any;

  constructor(args: any) {
    this.args = args;
    this.init();
  }

  init() {
    this.input = document.createElement("input");
    this.input.type = "number";
    this.input.className = "editor-number";
    this.input.style.width = "100%";
    this.input.style.height = "100%";
    this.input.style.border = "none";
    this.input.style.outline = "none";
    this.input.style.background = "var(--vscode-input-background, #3c3c3c)";
    this.input.style.color = "var(--vscode-input-foreground, #cccccc)";
    this.input.style.padding = "0 4px";
    this.input.style.boxSizing = "border-box";

    this.args.container.appendChild(this.input);
    this.input.focus();
    this.input.select();
  }

  destroy() {
    this.input.remove();
  }

  focus() {
    this.input.focus();
  }

  loadValue(item: any) {
    const val = item[this.args.column.field];
    this.originalValue = val;
    this.input.value = val != null ? String(val) : "";
    this.input.select();
  }

  serializeValue() {
    const val = this.input.value.trim();
    if (val === "") return null;
    const num = Number(val);
    return isNaN(num) ? this.originalValue : num;
  }

  applyValue(item: any, state: any) {
    item[this.args.column.field] = state;
  }

  isValueChanged() {
    const serialized = this.serializeValue();
    return serialized !== this.originalValue;
  }

  validate() {
    const val = this.input.value.trim();
    if (val === "") return { valid: true, msg: null };
    if (isNaN(Number(val))) {
      return { valid: false, msg: "Please enter a valid number" };
    }
    return { valid: true, msg: null };
  }
}
