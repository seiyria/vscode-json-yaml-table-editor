/**
 * SlickGrid custom editor for enum fields.
 * Renders a <select> dropdown from ColumnInfo.enumValues.
 */
export class EnumEditor {
  private select!: HTMLSelectElement;
  private originalValue: any;
  private args: any;

  constructor(args: any) {
    this.args = args;
    this.init();
  }

  init() {
    this.select = document.createElement("select");
    this.select.style.width = "100%";
    this.select.style.height = "100%";
    this.select.style.border = "none";
    this.select.style.outline = "none";
    this.select.style.background = "var(--vscode-input-background, #3c3c3c)";
    this.select.style.color = "var(--vscode-input-foreground, #cccccc)";
    this.select.style.padding = "0 4px";
    this.select.style.boxSizing = "border-box";

    // Empty option
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "(empty)";
    this.select.appendChild(emptyOpt);

    // Get enum values from column definition
    const enumValues: string[] =
      this.args.column?.editor?.params?.enumValues ??
      (this.args.column as any).__enumValues ??
      [];
    for (const val of enumValues) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      this.select.appendChild(opt);
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
    this.originalValue = val;
    this.select.value = val != null ? String(val) : "";
  }

  serializeValue() {
    const val = this.select.value;
    return val === "" ? null : val;
  }

  applyValue(item: any, state: any) {
    item[this.args.column.field] = state;
  }

  isValueChanged() {
    return this.serializeValue() !== this.originalValue;
  }

  validate() {
    return { valid: true, msg: null };
  }
}
