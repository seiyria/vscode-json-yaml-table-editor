import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

interface ColumnLayoutEntry {
  path: string;
  width: number;
}

interface TableEditorConfig {
  defaults?: {
    columns?: ColumnLayoutEntry[];
  };
  files?: Record<string, { columns?: ColumnLayoutEntry[] }>;
}

const CONFIG_FILENAME = "tableEditor.json";

/**
 * Read column layout preferences from .vscode/tableEditor.json.
 * Per-file entries override workspace defaults.
 */
export function readColumnLayout(
  document: vscode.TextDocument
): ColumnLayoutEntry[] | null {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) return null;

  const configPath = path.join(
    workspaceFolder.uri.fsPath,
    ".vscode",
    CONFIG_FILENAME
  );

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config: TableEditorConfig = JSON.parse(content);

    // Per-file override
    const relPath = path
      .relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
      .replace(/\\/g, "/");

    if (config.files?.[relPath]?.columns) {
      return config.files[relPath].columns!;
    }

    // Workspace defaults
    if (config.defaults?.columns) {
      return config.defaults.columns;
    }
  } catch {
    // File doesn't exist or invalid
  }

  return null;
}

/**
 * Save column layout preferences to .vscode/tableEditor.json.
 */
export async function saveColumnLayout(
  document: vscode.TextDocument,
  columns: ColumnLayoutEntry[]
): Promise<void> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) return;

  const vscodeDir = path.join(workspaceFolder.uri.fsPath, ".vscode");
  const configPath = path.join(vscodeDir, CONFIG_FILENAME);

  let config: TableEditorConfig = {};

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(content);
  } catch {
    // New file
  }

  const relPath = path
    .relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
    .replace(/\\/g, "/");

  if (!config.files) config.files = {};
  config.files[relPath] = { columns };

  // Ensure .vscode directory exists
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
