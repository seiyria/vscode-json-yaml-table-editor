import * as vscode from "vscode";
import { TableEditorProvider } from "./tableEditorProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new TableEditorProvider(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "tableEditor.tableView",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tableEditor.generateUuid", () => {
      // Will be wired to active webview in Phase 7
    })
  );
}

export function deactivate() {}
