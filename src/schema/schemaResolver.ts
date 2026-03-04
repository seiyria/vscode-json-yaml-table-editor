import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { minimatch } from "minimatch";
import type { ColumnInfo, ColumnType, DrilldownPath } from "../../shared/tableTypes";

interface SchemaEntry {
  fileMatch: string;
  schemaPath: string;
}

interface JsonSchema {
  type?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  enum?: unknown[];
  $ref?: string;
  [key: string]: unknown;
}

/**
 * Resolve a JSON Schema for the given document from multiple sources.
 * Priority: tableEditor.schemas > json.schemas > yaml.schemas
 */
export async function resolveSchema(
  document: vscode.TextDocument
): Promise<JsonSchema | null> {
  const filePath = document.uri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const workspaceRoot = workspaceFolder?.uri.fsPath ?? "";

  // 1. tableEditor.schemas
  const teConfig = vscode.workspace.getConfiguration("tableEditor");
  const teSchemas: SchemaEntry[] = teConfig.get("schemas", []);
  for (const entry of teSchemas) {
    if (matchesFile(filePath, entry.fileMatch, workspaceRoot)) {
      const schema = await loadSchema(entry.schemaPath, workspaceRoot);
      if (schema) return resolveRefs(schema, entry.schemaPath, workspaceRoot);
    }
  }

  // 2. json.schemas
  const jsonConfig = vscode.workspace.getConfiguration("json");
  const jsonSchemas: any[] = jsonConfig.get("schemas", []);
  for (const entry of jsonSchemas) {
    const fileMatch: string[] = entry.fileMatch ?? [];
    for (const pattern of fileMatch) {
      if (matchesFile(filePath, pattern, workspaceRoot)) {
        const url = entry.url || entry.schema;
        if (typeof url === "string") {
          const schema = await loadSchema(url, workspaceRoot);
          if (schema) return resolveRefs(schema, url, workspaceRoot);
        } else if (typeof url === "object") {
          return resolveRefs(url, "", workspaceRoot);
        }
      }
    }
  }

  // 3. yaml.schemas
  const yamlConfig = vscode.workspace.getConfiguration("yaml");
  const yamlSchemas: Record<string, string | string[]> =
    yamlConfig.get("schemas", {});
  for (const [schemaPath, patterns] of Object.entries(yamlSchemas)) {
    const patternList = Array.isArray(patterns) ? patterns : [patterns];
    for (const pattern of patternList) {
      if (matchesFile(filePath, pattern, workspaceRoot)) {
        const schema = await loadSchema(schemaPath, workspaceRoot);
        if (schema) return resolveRefs(schema, schemaPath, workspaceRoot);
      }
    }
  }

  return null;
}

/**
 * Derive ColumnInfo array from a schema's items.properties.
 */
export function deriveColumnsFromSchema(
  schema: JsonSchema,
  prefix = ""
): ColumnInfo[] {
  const items = schema.items;
  if (!items) return [];

  // Merge properties from allOf, anyOf, oneOf into a single map
  const merged = collectProperties(items);
  if (Object.keys(merged).length === 0) return [];

  const columns: ColumnInfo[] = [];

  for (const [key, propSchema] of Object.entries(merged)) {
    const path = prefix ? `${prefix}.${key}` : key;
    walkProperty(path, propSchema, columns);
  }

  return columns;
}

/**
 * Collect all properties from a schema, merging allOf/anyOf/oneOf entries.
 */
function collectProperties(schema: JsonSchema): Record<string, JsonSchema> {
  const result: Record<string, JsonSchema> = {};

  if (schema.properties) {
    Object.assign(result, schema.properties);
  }

  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const list = schema[keyword];
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (entry && typeof entry === "object") {
          Object.assign(result, collectProperties(entry as JsonSchema));
        }
      }
    }
  }

  return result;
}

function walkProperty(
  path: string,
  schema: JsonSchema,
  columns: ColumnInfo[]
) {
  if (schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      walkProperty(`${path}.${key}`, subSchema, columns);
    }
    return;
  }

  const type = mapSchemaType(schema);
  const col: ColumnInfo = {
    path,
    label: path,
    type,
    fromSchema: true,
  };

  if (schema.enum) {
    col.enumValues = schema.enum.map(String);
  }

  if (schema.type === "array" && schema.items?.enum) {
    col.enumValues = schema.items.enum.map(String);
  }

  columns.push(col);
}

function mapSchemaType(schema: JsonSchema): ColumnType {
  switch (schema.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array": {
      // Check if items have properties (array of objects)
      if (schema.items) {
        const props = collectProperties(schema.items);
        if (Object.keys(props).length > 0) {
          return "arrayOfObjects";
        }
      }
      return "array";
    }
    case "object":
      return "object";
    default:
      return "string";
  }
}

/**
 * Walk a schema along the given drilldown path to find the sub-array's item schema.
 * Returns null if the path can't be resolved.
 */
export function getSubSchema(
  schema: JsonSchema,
  drilldownPath: DrilldownPath
): JsonSchema | null {
  if (!schema || drilldownPath.length === 0) return schema;

  // Start at the items level (the schema for each row)
  let current: JsonSchema | undefined = schema.items;
  if (!current) return null;

  for (const segment of drilldownPath) {
    // Resolve properties at this level
    const props = collectProperties(current);
    const fieldParts = segment.fieldPath.split(".");
    let fieldSchema: JsonSchema | undefined;

    for (const part of fieldParts) {
      const resolvedProps = fieldSchema ? collectProperties(fieldSchema) : props;
      fieldSchema = resolvedProps[part];
      if (!fieldSchema) return null;
    }

    if (!fieldSchema || fieldSchema.type !== "array" || !fieldSchema.items) {
      return null;
    }

    // Build a wrapper schema with items for deriveColumnsFromSchema
    current = fieldSchema.items;
  }

  // Return a wrapper that deriveColumnsFromSchema expects (with items)
  return { type: "array", items: current };
}

function matchesFile(
  filePath: string,
  pattern: string,
  workspaceRoot: string
): boolean {
  // Normalize paths for matching
  const relPath = workspaceRoot
    ? path.relative(workspaceRoot, filePath).replace(/\\/g, "/")
    : path.basename(filePath);

  return (
    minimatch(relPath, pattern) ||
    minimatch(path.basename(filePath), pattern) ||
    minimatch(filePath.replace(/\\/g, "/"), pattern)
  );
}

async function loadSchema(
  schemaPath: string,
  workspaceRoot: string
): Promise<JsonSchema | null> {
  try {
    // URL
    if (schemaPath.startsWith("http://") || schemaPath.startsWith("https://")) {
      const resp = await fetch(schemaPath);
      return (await resp.json()) as JsonSchema;
    }

    // Absolute path
    let resolved = schemaPath;
    if (!path.isAbsolute(schemaPath) && workspaceRoot) {
      resolved = path.join(workspaceRoot, schemaPath);
    }

    const content = fs.readFileSync(resolved, "utf-8");
    return JSON.parse(content) as JsonSchema;
  } catch {
    return null;
  }
}

function resolveRefs(
  schema: JsonSchema,
  schemaPath: string,
  workspaceRoot: string
): JsonSchema {
  const seen = new Set<string>();

  function resolve(obj: any, basePath: string): any {
    if (typeof obj !== "object" || obj === null) return obj;

    if (obj.$ref && typeof obj.$ref === "string") {
      const ref = obj.$ref;
      if (seen.has(ref)) return obj;
      seen.add(ref);

      if (ref.startsWith("#")) {
        // Local reference
        const pointer = ref.slice(2).split("/");
        let target: any = schema;
        for (const part of pointer) {
          target = target?.[part];
        }
        return target ? resolve(target, basePath) : obj;
      } else {
        // External reference
        try {
          const [filePart, fragmentPart] = ref.split("#");
          let refPath = filePart;
          if (!path.isAbsolute(refPath)) {
            const baseDir = basePath
              ? path.dirname(
                  path.isAbsolute(basePath)
                    ? basePath
                    : path.join(workspaceRoot, basePath)
                )
              : workspaceRoot;
            refPath = path.join(baseDir, refPath);
          }
          const content = fs.readFileSync(refPath, "utf-8");
          let external = JSON.parse(content);
          if (fragmentPart) {
            const pointer = fragmentPart.slice(1).split("/");
            for (const part of pointer) {
              external = external?.[part];
            }
          }
          return external ? resolve(external, refPath) : obj;
        } catch {
          return obj;
        }
      }
    }

    const result: any = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolve(value, basePath);
    }
    return result;
  }

  return resolve(schema, schemaPath);
}
