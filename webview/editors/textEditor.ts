/**
 * SlickGrid custom editor for text/string cells.
 * Uses a textarea overlay for long values (>50 chars), otherwise a simple input.
 */
export class TextEditor {
  private el!: HTMLInputElement | HTMLTextAreaElement;
  private originalValue: any;
  private args: any;
  private isTextarea = false;

  constructor(args: any) {
    this.args = args;
    this.init();
  }

  init() {
    // Placeholder — actual element created in loadValue once we know the value length
    this.el = document.createElement("input");
    this.el.type = "text";
    this.applyStyles(this.el);
    this.args.container.appendChild(this.el);
    this.el.focus();
  }

  destroy() {
    this.el.remove();
  }

  focus() {
    this.el.focus();
  }

  loadValue(item: any) {
    const val = item[this.args.column.field];
    this.originalValue = val;
    const text = val != null ? String(val) : "";

    if (text.length > 50 && !this.isTextarea) {
      // Switch to textarea
      this.el.remove();
      const ta = document.createElement("textarea");
      this.applyStyles(ta);
      ta.style.position = "absolute";
      ta.style.zIndex = "10000";
      ta.style.minWidth = "300px";
      ta.style.minHeight = "80px";
      ta.style.maxWidth = "500px";
      ta.style.maxHeight = "200px";
      ta.style.resize = "both";
      ta.style.whiteSpace = "pre-wrap";
      ta.style.overflowY = "auto";
      ta.style.border = "1px solid var(--vscode-focusBorder, #007fd4)";
      ta.style.borderRadius = "2px";
      ta.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)";
      this.el = ta;
      this.isTextarea = true;
      this.args.container.appendChild(this.el);
    }

    this.el.value = text;

    if (this.isTextarea) {
      this.el.focus();
      (this.el as HTMLTextAreaElement).setSelectionRange(0, 0);
    } else {
      this.el.focus();
      (this.el as HTMLInputElement).select();
    }
  }

  serializeValue() {
    const val = this.el.value;
    if (val === "") return null;
    return val;
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

  private applyStyles(el: HTMLElement) {
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.border = "none";
    el.style.outline = "none";
    el.style.background = "var(--vscode-input-background, #3c3c3c)";
    el.style.color = "var(--vscode-input-foreground, #cccccc)";
    el.style.padding = "4px";
    el.style.boxSizing = "border-box";
    el.style.fontFamily = "var(--vscode-font-family)";
    el.style.fontSize = "13px";
  }
}
