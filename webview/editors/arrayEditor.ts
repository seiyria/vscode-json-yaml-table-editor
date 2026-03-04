/**
 * SlickGrid custom editor for array fields.
 * Opens a popup overlay with tag chips for current values,
 * plus checkboxes (enum) or free-text input to add items.
 */
export class ArrayEditor {
  private currentValue: unknown[] = [];
  private originalValue: unknown[] = [];
  private args: any;
  private wrapper!: HTMLDivElement;
  private popup!: HTMLDivElement;
  private tagContainer!: HTMLDivElement;
  private onDocClick: ((e: MouseEvent) => void) | null = null;
  private onDocKeydown: ((e: KeyboardEvent) => void) | null = null;

  constructor(args: any) {
    this.args = args;
    this.init();
  }

  init() {
    // Invisible wrapper inside the cell
    this.wrapper = document.createElement("div");
    this.wrapper.style.width = "100%";
    this.wrapper.style.height = "100%";
    this.wrapper.style.background = "var(--vscode-input-background, #3c3c3c)";
    this.args.container.appendChild(this.wrapper);

    // Popup overlay
    this.popup = document.createElement("div");
    Object.assign(this.popup.style, {
      position: "absolute",
      zIndex: "10000",
      minWidth: "250px",
      maxWidth: "400px",
      maxHeight: "300px",
      background: "var(--vscode-dropdown-background, #3c3c3c)",
      border: "1px solid var(--vscode-focusBorder, #007fd4)",
      borderRadius: "3px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      fontFamily: "var(--vscode-font-family)",
      fontSize: "13px",
    });

    // Tag area (shows current values as chips)
    this.tagContainer = document.createElement("div");
    Object.assign(this.tagContainer.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
      padding: "8px",
      minHeight: "32px",
      borderBottom: "1px solid var(--vscode-panel-border, #444)",
      overflowY: "auto",
      maxHeight: "120px",
    });
    this.popup.appendChild(this.tagContainer);

    const enumValues: string[] =
      this.args.column?.editor?.params?.enumValues ??
      (this.args.column as any).__enumValues ??
      [];

    if (enumValues.length > 0) {
      this.buildCheckboxList(enumValues);
    } else {
      this.buildFreeTextInput();
    }

    this.args.container.appendChild(this.popup);

    // Close on click outside
    this.onDocClick = (e: MouseEvent) => {
      if (!this.popup.contains(e.target as Node)) {
        this.args.commitChanges?.();
      }
    };
    // Close on Escape
    this.onDocKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.args.cancelChanges?.();
      }
    };
    // Defer so the opening click doesn't immediately close
    requestAnimationFrame(() => {
      document.addEventListener("mousedown", this.onDocClick!);
      document.addEventListener("keydown", this.onDocKeydown!, true);
    });
  }

  private buildCheckboxList(enumValues: string[]) {
    const list = document.createElement("div");
    Object.assign(list.style, {
      overflowY: "auto",
      maxHeight: "160px",
      padding: "4px 8px",
    });

    for (const val of enumValues) {
      const label = document.createElement("label");
      Object.assign(label.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 0",
        cursor: "pointer",
        color: "var(--vscode-dropdown-foreground, #cccccc)",
        fontSize: "13px",
      });

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = val;
      cb.dataset.enumVal = val;
      cb.addEventListener("change", () => {
        if (cb.checked) {
          if (!this.currentValue.includes(val)) {
            this.currentValue.push(val);
          }
        } else {
          this.currentValue = this.currentValue.filter((v) => v !== val);
        }
        this.renderTags();
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(val));
      list.appendChild(label);
    }

    this.popup.appendChild(list);
  }

  private buildFreeTextInput() {
    const inputRow = document.createElement("div");
    Object.assign(inputRow.style, {
      display: "flex",
      gap: "4px",
      padding: "8px",
      alignItems: "center",
    });

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type value, press Enter";
    Object.assign(input.style, {
      flex: "1",
      padding: "4px 8px",
      background: "var(--vscode-input-background, #3c3c3c)",
      color: "var(--vscode-input-foreground, #cccccc)",
      border: "1px solid var(--vscode-input-border, #555)",
      borderRadius: "2px",
      outline: "none",
      fontFamily: "var(--vscode-font-family)",
      fontSize: "13px",
    });

    input.addEventListener("focus", () => {
      input.style.borderColor = "var(--vscode-focusBorder, #007fd4)";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "var(--vscode-input-border, #555)";
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const val = input.value.trim();
        if (val) {
          this.currentValue.push(val);
          input.value = "";
          this.renderTags();
        }
      }
      // Prevent grid from stealing keystrokes
      e.stopPropagation();
    });

    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    Object.assign(addBtn.style, {
      padding: "4px 10px",
      background: "var(--vscode-button-background, #0e639c)",
      color: "var(--vscode-button-foreground, #fff)",
      border: "none",
      borderRadius: "2px",
      cursor: "pointer",
      fontSize: "12px",
      whiteSpace: "nowrap",
    });
    addBtn.addEventListener("click", () => {
      const val = input.value.trim();
      if (val) {
        this.currentValue.push(val);
        input.value = "";
        this.renderTags();
        input.focus();
      }
    });

    inputRow.appendChild(input);
    inputRow.appendChild(addBtn);
    this.popup.appendChild(inputRow);

    // Focus the input after a frame
    requestAnimationFrame(() => input.focus());
  }

  private renderTags() {
    this.tagContainer.innerHTML = "";

    if (this.currentValue.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = "No items";
      empty.style.color = "var(--vscode-descriptionForeground, #888)";
      empty.style.fontSize = "12px";
      empty.style.padding = "2px 0";
      this.tagContainer.appendChild(empty);
      return;
    }

    for (let i = 0; i < this.currentValue.length; i++) {
      const val = this.currentValue[i];
      const tag = document.createElement("span");
      Object.assign(tag.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 6px",
        background: "var(--vscode-badge-background, #4d4d4d)",
        color: "var(--vscode-badge-foreground, #cccccc)",
        borderRadius: "3px",
        fontSize: "12px",
        lineHeight: "1.4",
        maxWidth: "200px",
        overflow: "hidden",
      });

      const text = document.createElement("span");
      text.textContent = String(val);
      text.style.overflow = "hidden";
      text.style.textOverflow = "ellipsis";
      text.style.whiteSpace = "nowrap";
      tag.appendChild(text);

      const removeBtn = document.createElement("span");
      removeBtn.textContent = "\u00D7";
      Object.assign(removeBtn.style, {
        cursor: "pointer",
        fontSize: "14px",
        lineHeight: "1",
        opacity: "0.7",
        flexShrink: "0",
      });
      removeBtn.addEventListener("mouseenter", () => {
        removeBtn.style.opacity = "1";
      });
      removeBtn.addEventListener("mouseleave", () => {
        removeBtn.style.opacity = "0.7";
      });

      const idx = i;
      removeBtn.addEventListener("click", () => {
        const removed = this.currentValue[idx];
        this.currentValue.splice(idx, 1);
        this.renderTags();
        // Uncheck corresponding checkbox if enum mode
        const cb = this.popup.querySelector(
          `input[data-enum-val="${removed}"]`
        ) as HTMLInputElement | null;
        if (cb) cb.checked = false;
      });

      tag.appendChild(removeBtn);
      this.tagContainer.appendChild(tag);
    }
  }

  destroy() {
    if (this.onDocClick) document.removeEventListener("mousedown", this.onDocClick);
    if (this.onDocKeydown) document.removeEventListener("keydown", this.onDocKeydown, true);
    this.popup.remove();
    this.wrapper.remove();
  }

  focus() {
    const input = this.popup.querySelector("input[type=text]") as HTMLInputElement | null;
    if (input) input.focus();
  }

  loadValue(item: any) {
    const val = item[this.args.column.field];
    this.originalValue = Array.isArray(val) ? [...val] : [];
    this.currentValue = [...this.originalValue];

    // Sync checkboxes
    const checkboxes = this.popup.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]"
    );
    for (const cb of checkboxes) {
      cb.checked = this.currentValue.includes(cb.value);
    }

    this.renderTags();
  }

  serializeValue() {
    return [...this.currentValue];
  }

  applyValue(item: any, state: any) {
    item[this.args.column.field] = state;
  }

  isValueChanged() {
    if (this.currentValue.length !== this.originalValue.length) return true;
    return this.currentValue.some((v, i) => v !== this.originalValue[i]);
  }

  validate() {
    return { valid: true, msg: null };
  }
}
