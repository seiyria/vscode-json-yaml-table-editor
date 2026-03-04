# YAML/JSON Table Editor

A VS Code extension that lets you edit JSON and YAML array files as interactive spreadsheet-style tables.

## Features

### Spreadsheet-Style Editing

Open any `.json`, `.yaml`, or `.yml` file containing a top-level array and edit it as a table. Each array element becomes a row, and object keys become columns. Nested objects are flattened with dot-notation paths (e.g. `address.city`).

- **Inline cell editing** with type-aware editors (text, number, boolean, enum dropdown, array tags)
- **Row operations**: add, delete, duplicate, and reorder rows via toolbar or keyboard shortcuts
- **Column operations**: add, delete, resize, reorder, and sort columns
- **Multi-row selection** for bulk operations
- **Copy** cell values or rows as TSV to clipboard

### Drill-Down Navigation

Columns containing arrays of objects display as `[N items] >`. Click to drill into the sub-array as its own table. A breadcrumb bar shows your navigation path and lets you jump back to any level. Breadcrumbs show the row's `name` or `id` field for easy identification.

### JSON Schema Validation

Link JSON Schemas to your files for:

- **Enum dropdowns** generated from `enum` definitions in the schema
- **On-demand validation** with per-cell error highlighting and tooltips
- **Schema-driven column detection** to show all expected columns even before data exists
- **Array enum support** with checkbox-based tag editors

### Search & Filter

Press `Ctrl+F` to open the search bar. Rows are filtered in real-time as you type, searching across all visible columns.

### Column Layout Persistence

Column widths are saved per-file in `.vscode/tableEditor.json` and automatically restored when you reopen the file.

### VS Code Theme Integration

Fully themed using VS Code CSS variables — works with dark, light, and high-contrast themes out of the box.

## Keyboard Shortcuts

| Shortcut      | Action                           |
| ------------- | -------------------------------- |
| `Ctrl+I`      | Insert row after selection       |
| `Ctrl+D`      | Duplicate row                    |
| `Delete`      | Clear active cell                |
| `Ctrl+Delete` | Delete row                       |
| `Alt+Up`      | Move row up                      |
| `Alt+Down`    | Move row down                    |
| `Alt+Left`    | Navigate up one drill-down level |
| `Ctrl+F`      | Toggle search bar                |
| `Ctrl+C`      | Copy cell/rows to clipboard      |
| `Escape`      | Close search or cancel editing   |

## Context Menu

**Right-click a column header:**

- Delete Column

**Right-click a row number (#) cell:**

- Insert Row Above / Below
- Move Up / Down
- Duplicate Row
- Delete Row

**Right-click a data cell:**

- Copy Value
- Set to Null
- Generate UUID
- Drill into Array (for array-of-objects columns)

## Configuration

### Schema Association

Associate JSON Schemas with files using the `tableEditor.schemas` setting:

```jsonc
// .vscode/settings.json
{
  "tableEditor.schemas": [
    {
      "fileMatch": "data/**/*.json",
      "schemaPath": "./schemas/mySchema.json",
    },
    {
      "fileMatch": "**/*.data.yaml",
      "schemaPath": "https://example.com/schema.json",
    },
  ],
}
```

Schema paths can be absolute, workspace-relative, or URLs. The extension also picks up schemas from the built-in `json.schemas` and `yaml.schemas` settings.

## Supported File Types

| Extension | Format |
| --------- | ------ |
| `.json`   | JSON   |
| `.yaml`   | YAML   |
| `.yml`    | YAML   |

Files must contain a top-level array to be displayed as a table. The editor is registered with `"option"` priority, so you can choose between this editor and the default text editor via **Reopen Editor With...** in VS Code.

## YAML Format Preservation

YAML files are serialized using the `yaml` library's Document API, which preserves comments, formatting, and key ordering from the original file.
