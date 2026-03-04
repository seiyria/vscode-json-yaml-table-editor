# PRD: VS Code Table Editor Extension

## Introduction

A VS Code extension that lets users edit JSON and YAML files containing arrays of objects as interactive spreadsheet-style tables. Instead of manually editing raw text, users open a custom table editor that presents each array element as a row and each property as a column. The editor supports JSON Schema for validation and type hints, nested objects (flattened into sub-columns), array fields (editable via dropdowns), a built-in UUID generator, and full keyboard-driven navigation modeled after spreadsheet conventions. YAML files are read and saved back as YAML with formatting preserved.

Inspiration: [Alturos JSON Table Editor](https://marketplace.visualstudio.com/items?itemName=Alturos.vscjsontableeditor)

## Goals

- Provide a visual, spreadsheet-like editing experience for JSON/YAML array data within VS Code
- Support all common data types: string, number, boolean, array (dropdown), and nested objects (flattened sub-columns)
- Optionally consume JSON Schema (configured in VS Code settings) for column types, validation, and dropdown options
- Maintain full YAML read/write parity — open YAML, edit in table, save back as valid YAML
- Offer both toolbar buttons and keyboard shortcuts for all row/cell operations
- Include a built-in UUID generator for quick ID population
- Feel native to VS Code (theming, custom editor API, command palette integration)

## User Stories

### US-001: Register custom editor provider
**Description:** As a developer, I need the extension to register a `CustomTextEditorProvider` so that users can right-click a JSON or YAML file and choose "Open With..." → "Table Editor".

**Acceptance Criteria:**
- [ ] Extension activates for `.json`, `.yaml`, and `.yml` file types
- [ ] Custom editor appears in the "Open With..." menu for those file types
- [ ] Opening the custom editor renders a webview with an empty table shell
- [ ] The default VS Code text editor remains available as an alternative
- [ ] Extension does not activate or show errors for non-array files (graceful fallback message)
- [ ] Typecheck/lint passes

### US-002: Parse JSON files into table data
**Description:** As a user, I want to open a JSON file containing an array of objects and see it rendered as a table so I can understand the data at a glance.

**Acceptance Criteria:**
- [ ] Opening a JSON file with a top-level array renders one row per array element
- [ ] Each unique property key across all objects becomes a column header
- [ ] Cells display the value for each row/column intersection (empty string for missing keys)
- [ ] Primitive values (string, number, boolean, null) render as plain text in their cell
- [ ] If the file does not contain a top-level array, show a user-friendly message: "This file does not contain a top-level array and cannot be displayed as a table."
- [ ] Typecheck/lint passes

### US-003: Parse YAML files into table data
**Description:** As a user, I want to open a YAML file containing an array of objects and see it rendered as a table, just like JSON.

**Acceptance Criteria:**
- [ ] Opening a `.yaml` or `.yml` file with a top-level array renders identically to the JSON equivalent
- [ ] YAML-specific types (e.g., unquoted strings, multiline strings) are handled correctly
- [ ] Non-array YAML files show the same fallback message as JSON
- [ ] Typecheck/lint passes

### US-004: Save table edits back to JSON
**Description:** As a user, I want my table edits to be saved back to the original JSON file so that the source file stays in sync.

**Acceptance Criteria:**
- [ ] Editing a cell and pressing Ctrl+S (or Cmd+S) writes the updated array back to the JSON file
- [ ] Output JSON indentation respects VS Code's `editor.tabSize` and `editor.insertSpaces` settings; defaults to 2-space indent if no setting is configured
- [ ] The VS Code dirty/unsaved indicator (dot on the tab) shows when there are unsaved changes
- [ ] Undo/redo in the webview integrates with VS Code's document undo stack
- [ ] Round-trip: opening a saved file produces the same table state
- [ ] Typecheck/lint passes

### US-005: Save table edits back to YAML
**Description:** As a user, I want edits to YAML files saved back as valid YAML, preserving the YAML format.

**Acceptance Criteria:**
- [ ] Edits to a YAML-sourced table are written back as YAML (not JSON)
- [ ] Basic YAML formatting is preserved (indentation style, flow vs block)
- [ ] The file remains valid, parseable YAML after save
- [ ] Dirty indicator and undo/redo work the same as JSON
- [ ] Typecheck/lint passes

### US-006: Render nested objects as flattened sub-columns
**Description:** As a user, I want nested object properties shown as separate columns (e.g., `address.city`, `address.zip`) so I can edit each sub-property individually.

**Acceptance Criteria:**
- [ ] An object-valued property `foo` with keys `a`, `b` renders as columns `foo.a` and `foo.b`
- [ ] Nesting works to at least 3 levels deep (e.g., `foo.bar.baz`)
- [ ] Column headers show the dot-delimited path
- [ ] Editing a sub-column cell updates only that nested property in the source data
- [ ] Adding a value to a sub-column for a row that had no parent object creates the intermediate objects
- [ ] Typecheck/lint passes

### US-007: Render array fields as dropdown selectors
**Description:** As a user, I want array-valued fields displayed as a dropdown/tag list so I can select or deselect values easily.

**Acceptance Criteria:**
- [ ] Array-valued cells show a comma-separated summary (e.g., "red, blue, green")
- [ ] Clicking or pressing Enter on an array cell opens a dropdown/multi-select overlay
- [ ] User can add new items, remove existing items, and reorder items
- [ ] If a JSON Schema provides an `enum` for the array's items, the dropdown shows those options
- [ ] Without a schema, the dropdown allows free-text entry of new values
- [ ] Changes reflect immediately in the table cell after closing the dropdown
- [ ] Typecheck/lint passes

### US-008: Support JSON Schema from VS Code settings
**Description:** As a user, I want the extension to resolve JSON Schemas so that columns get proper types, validation, and dropdown options — using both its own settings and existing VS Code schema configurations.

**Acceptance Criteria:**
- [ ] Extension contributes a setting `tableEditor.schemas` — an array of `{ fileMatch: string, schemaPath: string }` objects
- [ ] `fileMatch` supports glob patterns (e.g., `**/fixtures/*.json`)
- [ ] `schemaPath` can be an absolute path, a workspace-relative path, or a URL
- [ ] Extension also reads schemas from VS Code's existing editor settings: `.vscode/settings.json` → `json.schemas` and `yaml.schemas` properties
- [ ] Schema resolution priority: `tableEditor.schemas` > `json.schemas` / `yaml.schemas` > no schema (guessed mode)
- [ ] `$ref` references within schemas are fully resolved (both local same-file `$ref` and cross-file `$ref`)
- [ ] When a schema matches the open file, column types are inferred from the schema's `items.properties`
- [ ] `enum` values in the schema populate dropdown options for the cell
- [ ] `type` in the schema drives the cell editor (text input for string, number spinner for number, checkbox for boolean)
- [ ] If no schema matches, columns are inferred from the data (guessed mode)
- [ ] Typecheck/lint passes

### US-009: Validate cells against JSON Schema
**Description:** As a user, I want cells validated against the schema so I can catch errors before saving.

**Acceptance Criteria:**
- [ ] Cells that violate the schema (wrong type, out of enum range, pattern mismatch) show a red border or highlight
- [ ] Hovering over an invalid cell shows the validation error message
- [ ] Validation runs on cell edit (not just on save)
- [ ] A status bar item or badge shows the count of validation errors in the current file
- [ ] Saving is still allowed with validation errors (non-blocking)
- [ ] Typecheck/lint passes

### US-010: Cell editing — string and number types
**Description:** As a user, I want to click or press Enter on a cell to edit its value inline.

**Acceptance Criteria:**
- [ ] Single-clicking a cell selects it (highlighted border); double-click or Enter enters edit mode
- [ ] String cells show a text input; pressing Enter or Tab confirms the edit; Escape cancels
- [ ] Number cells show a number input that rejects non-numeric characters
- [ ] Boolean cells toggle on Enter or Space (no text input needed)
- [ ] Null cells display as empty; typing into them sets the value to a string (or appropriate type per schema)
- [ ] Typecheck/lint passes

### US-011: Spreadsheet-style keyboard navigation
**Description:** As a user, I want to navigate the table with arrow keys, Tab, Enter, and Escape like a spreadsheet so editing is fast and keyboard-driven.

**Acceptance Criteria:**
- [ ] Arrow keys move the selected cell up/down/left/right
- [ ] Tab moves to the next cell (left to right, wrapping to the next row); Shift+Tab moves backward
- [ ] Enter on a selected cell enters edit mode; Enter in edit mode confirms and moves down one row
- [ ] Escape in edit mode cancels the edit and returns to selection mode
- [ ] Home/End jump to first/last column in the current row
- [ ] Ctrl+Home / Ctrl+End jump to the first/last cell in the table
- [ ] Page Up / Page Down scroll by one visible page of rows
- [ ] Focus is trapped within the table when navigating (does not leak to VS Code chrome)
- [ ] Typecheck/lint passes

### US-012: Row operations — add, delete, duplicate, reorder
**Description:** As a user, I want to add, delete, duplicate, and reorder rows via both toolbar buttons and keyboard shortcuts.

**Acceptance Criteria:**
- [ ] Toolbar buttons: "Add Row", "Delete Row", "Duplicate Row", "Move Up", "Move Down"
- [ ] Keyboard shortcuts: Ctrl+I (insert row below), Ctrl+D (duplicate selected row), Ctrl+Delete (delete selected row), Alt+Up/Down (move row up/down)
- [ ] New rows are inserted with default values (empty string / null / schema defaults)
- [ ] Duplicate copies all cell values from the selected row
- [ ] Delete prompts for confirmation if more than one row is selected
- [ ] All row operations update the dirty state and are undoable
- [ ] Typecheck/lint passes

### US-013: Multi-row selection
**Description:** As a user, I want to select multiple rows so I can delete or duplicate them in bulk.

**Acceptance Criteria:**
- [ ] Clicking a row number selects the entire row
- [ ] Ctrl+Click adds/removes individual rows from the selection
- [ ] Shift+Click selects a contiguous range of rows
- [ ] Selected rows are visually highlighted
- [ ] Delete and Duplicate operations apply to all selected rows
- [ ] Typecheck/lint passes

### US-014: Built-in UUID generator
**Description:** As a user, I want to quickly generate UUIDs for ID fields so I don't need to leave VS Code or use another tool.

**Acceptance Criteria:**
- [ ] Right-clicking a cell shows a context menu option: "Generate UUID"
- [ ] Selecting "Generate UUID" fills the cell with a new v4 UUID
- [ ] A toolbar button "Generate UUIDs" fills the selected column's empty cells with unique UUIDs
- [ ] A command palette entry "Table Editor: Generate UUID" is available and fills the currently selected cell
- [ ] Generated UUIDs are lowercase, hyphenated, standard v4 format (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- [ ] Typecheck/lint passes

### US-015: Column sorting
**Description:** As a user, I want to click a column header to sort the table so I can quickly find and organize data.

**Acceptance Criteria:**
- [ ] Clicking a column header sorts ascending; clicking again sorts descending; third click removes sort
- [ ] Sort indicator (arrow icon) is visible on the sorted column header
- [ ] Sorting is visual only and does not reorder the underlying data unless the user explicitly saves
- [ ] String sorting is case-insensitive; number sorting is numeric
- [ ] Typecheck/lint passes

### US-016: Column resizing and reordering
**Description:** As a user, I want to resize and reorder columns by dragging so I can customize the table layout.

**Acceptance Criteria:**
- [ ] Dragging a column header border resizes the column
- [ ] Double-clicking a column border auto-fits to content width
- [ ] Dragging a column header to a new position reorders columns
- [ ] Column layout changes are visual only and do not affect the source data key order
- [ ] Typecheck/lint passes

### US-017: Search and filter rows
**Description:** As a user, I want to search/filter the table to quickly find specific data.

**Acceptance Criteria:**
- [ ] Ctrl+F opens a search bar above the table
- [ ] Typing in the search bar filters rows to those containing the search text (case-insensitive, across all columns)
- [ ] Matching cells are highlighted
- [ ] Pressing Escape or clicking a close button clears the filter and shows all rows
- [ ] Search does not modify the underlying data
- [ ] Typecheck/lint passes

### US-018: VS Code theme integration
**Description:** As a user, I want the table editor to match my VS Code color theme so it looks native.

**Acceptance Criteria:**
- [ ] The webview reads VS Code CSS variables (`--vscode-editor-background`, `--vscode-editor-foreground`, etc.)
- [ ] Table renders correctly in light, dark, and high-contrast themes
- [ ] Fonts match the editor font family and size settings
- [ ] Selection, hover, and focus colors match the active theme's accent colors
- [ ] Typecheck/lint passes

### US-019: Virtual scrolling for large files
**Description:** As a user, I want the table to handle large files (1000+ rows) without lag so performance stays smooth.

**Acceptance Criteria:**
- [ ] Only visible rows are rendered in the DOM (virtual scrolling)
- [ ] Scrolling through 5,000 rows is smooth (no jank or dropped frames)
- [ ] Row count is displayed in the toolbar or status area
- [ ] Selection and keyboard navigation work correctly with virtual scrolling
- [ ] Typecheck/lint passes

### US-020: Copy cells as tab-separated values
**Description:** As a user, I want to copy selected cells so I can paste them into Excel, Google Sheets, or other spreadsheet applications.

**Acceptance Criteria:**
- [ ] Ctrl+C copies the currently selected cell(s) to the clipboard as tab-separated values (TSV)
- [ ] Copying a single cell copies its display value as plain text
- [ ] Copying multiple cells (via multi-row selection) copies rows separated by newlines, columns separated by tabs
- [ ] Pasted output is compatible with Excel and Google Sheets (standard TSV format)
- [ ] Typecheck/lint passes

### US-021: Persist column layout preferences
**Description:** As a user, I want my column order and width preferences remembered so I don't have to reconfigure the table every time I open a file.

**Acceptance Criteria:**
- [ ] Column widths and order are persisted per-file in a `.vscode/tableEditor.json` file
- [ ] Workspace-level defaults can be set in `.vscode/tableEditor.json` under a `"defaults"` key
- [ ] Per-file entries override workspace defaults
- [ ] If no preferences exist, columns use auto-fit defaults
- [ ] Changing column layout marks the preference file as dirty (not the data file)
- [ ] Typecheck/lint passes

### US-022: Add and remove columns
**Description:** As a user, I want to add new columns or remove existing ones to modify the shape of my data.

**Acceptance Criteria:**
- [ ] A toolbar button "Add Column" prompts for a column name (and optional type if schema is present)
- [ ] Adding a column adds the property (with null/default value) to every row
- [ ] Right-clicking a column header shows "Delete Column" option
- [ ] Deleting a column removes that property from every row in the data
- [ ] Both operations are undoable
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Register a `CustomTextEditorProvider` for `.json`, `.yaml`, and `.yml` files accessible via "Open With..." context menu
- FR-2: Parse top-level JSON arrays into a row-per-element, column-per-property table structure
- FR-3: Parse top-level YAML arrays into the same table structure, using a YAML parsing library (e.g., `yaml` npm package)
- FR-4: Save edits back to JSON (pretty-printed, indentation from VS Code `editor.tabSize`/`editor.insertSpaces` settings, defaulting to 2-space) or YAML (preserving format) based on the source file type
- FR-5: Integrate with VS Code's document model for dirty state, undo/redo, and save
- FR-6: Flatten nested object properties into dot-delimited sub-columns (up to at least 3 levels)
- FR-7: Render array-valued cells as comma-separated summaries with a multi-select dropdown editor
- FR-8: Read JSON Schema configuration from: (1) the `tableEditor.schemas` extension setting, (2) VS Code's `json.schemas` setting, (3) VS Code's `yaml.schemas` setting — in that priority order
- FR-9: Resolve `$ref` references in JSON Schemas (both local/same-file and cross-file references)
- FR-10: Use matched JSON Schema to infer column types, populate enum dropdowns, and set default values
- FR-11: Validate cell values against JSON Schema on edit and display errors inline (red border + tooltip)
- FR-12: Provide a text input editor for strings, number input for numbers, toggle for booleans, and dropdown for enums/arrays
- FR-13: Implement spreadsheet keyboard navigation: arrow keys, Tab/Shift+Tab, Enter to edit, Escape to cancel, Home/End, Ctrl+Home/End, Page Up/Down
- FR-14: Provide toolbar buttons for Add Row, Delete Row, Duplicate Row, Move Row Up, Move Row Down
- FR-15: Provide keyboard shortcuts for row operations: Ctrl+I (insert), Ctrl+D (duplicate), Ctrl+Delete (delete), Alt+Up/Down (move)
- FR-16: Support multi-row selection via Ctrl+Click and Shift+Click on row numbers
- FR-17: Provide UUID v4 generation via cell context menu, toolbar button (fill empty cells in column), and command palette
- FR-18: Implement column header click-to-sort (ascending → descending → none) with visual indicators
- FR-19: Implement column resizing (drag border, double-click auto-fit) and drag-to-reorder
- FR-20: Implement Ctrl+F search bar that filters rows by text match across all columns
- FR-21: Style the webview using VS Code CSS theme variables for full theme compatibility
- FR-22: Implement virtual scrolling so only visible rows are rendered in the DOM
- FR-23: Provide Add Column and Delete Column operations via toolbar and context menu
- FR-24: Show a row count indicator in the toolbar or status area
- FR-25: Show a validation error count in the status bar when a schema is active
- FR-26: Ctrl+C copies selected cells as tab-separated values (TSV) for spreadsheet compatibility
- FR-27: Persist column width and order preferences per-file in `.vscode/tableEditor.json`, with workspace-level defaults; per-file overrides workspace defaults

## Non-Goals (Out of Scope)

- **Formulas or computed columns** — this is a data editor, not a spreadsheet engine
- **Multi-file editing** — each table editor instance works on a single file
- **Real-time collaboration** — no shared editing between users
- **CSV/TSV support** — only JSON and YAML in v1
- **Schema editing** — the extension consumes schemas, it does not provide a schema editor
- **ElasticSearch integration or test execution** — features from the inspiration extension that are not relevant
- **Remote file support** — only local filesystem files
- **Inline image or rich media rendering** — cells display text only
- **Git diff integration** — table view does not show diffs between versions
- **Automatic schema inference saved to a file** — schema inference is ephemeral (in-memory only)

## Design Considerations

- Use VS Code's `CustomTextEditorProvider` API so the editor replaces the default text editor via "Open With..." and integrates with VS Code's save/undo model
- The webview UI should be a single-page application using lightweight DOM rendering (consider a virtual table library or custom implementation)
- Toolbar should use VS Code codicon icons for a native look
- Column headers for nested objects should use a visual grouping (e.g., `address` header spanning `address.city` and `address.zip` sub-headers)
- The dropdown/multi-select overlay for array cells should support both keyboard and mouse interaction
- Consider using a monospace font for cell content to keep column alignment consistent

## Technical Considerations

- **Language:** TypeScript (extension host + webview)
- **Build tool:** esbuild or webpack for bundling the extension and webview
- **YAML library:** `yaml` (npm) — supports parsing and stringifying with format preservation via its CST API
- **JSON Schema validation:** `ajv` (npm) — fast, widely-used JSON Schema validator
- **UUID generation:** `crypto.randomUUID()` (available in modern Node.js and browser APIs)
- **Webview communication:** VS Code `postMessage` / `onDidReceiveMessage` API for extension ↔ webview messaging
- **Virtual scrolling:** Implement or use a lightweight virtual list (avoid heavy framework dependencies to keep the extension fast)
- **State management:** The webview should maintain an in-memory representation of the table data; syncing to the document model on edit via `WorkspaceEdit`
- **Testing:** Unit tests for parsing, serialization, and schema logic; integration tests using `@vscode/test-electron`
- **Packaging:** Standard `.vsix` via `vsce`; target VS Code engine `^1.85.0` or latest stable

## Success Metrics

- User can open a JSON or YAML array file as a table in under 2 seconds (for files < 1MB)
- All cell edits round-trip correctly (open → edit → save → reopen produces expected state)
- Keyboard navigation allows editing 50 cells without touching the mouse
- Virtual scrolling handles 5,000+ rows without visible jank
- JSON Schema validation catches type mismatches and enum violations in real-time
- Extension installs and activates without errors on Windows, macOS, and Linux

## Resolved Decisions

- **Column layout persistence:** Per-file settings stored in `.vscode/tableEditor.json`, with workspace-level defaults. Per-file overrides workspace defaults.
- **Sync scroll:** Not needed — the custom editor replaces the text editor, so side-by-side sync is not applicable.
- **JSON Schema `$ref` support:** Yes, fully resolve `$ref` references in v1 (both local and cross-file). Also resolve schemas from VS Code's existing `json.schemas` and `yaml.schemas` settings.
- **JSON indentation:** Respect VS Code's `editor.tabSize` and `editor.insertSpaces` settings. Default to 2-space indent if no setting exists.
- **Clipboard copy:** Ctrl+C copies as tab-separated values (TSV) for spreadsheet compatibility.

## Open Questions

_None — all questions have been resolved._
