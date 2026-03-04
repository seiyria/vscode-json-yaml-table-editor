import * as vscode from "vscode";

export interface EditorSettings {
  tabSize: number;
  insertSpaces: boolean;
}

export function getEditorSettings(document: vscode.TextDocument): EditorSettings {
  const config = vscode.workspace.getConfiguration("editor", document.uri);
  const tabSize = config.get<number>("tabSize", 2);
  const insertSpaces = config.get<boolean>("insertSpaces", true);
  return { tabSize, insertSpaces };
}
