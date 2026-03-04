import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { CellError, FlatRow } from "../../shared/tableTypes";
import { unflattenRow } from "../parsers/flatten";

let ajvInstance: Ajv | null = null;

function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      strict: false,
      verbose: true,
    });
    addFormats(ajvInstance);
  }
  return ajvInstance;
}

/**
 * Validate rows against a JSON Schema.
 * Returns errors keyed by "rowIndex:columnPath".
 */
export function validateRows(
  rows: FlatRow[],
  schema: any
): CellError[] {
  if (!schema) return [];

  const ajv = getAjv();
  let validate: ReturnType<typeof ajv.compile>;

  try {
    validate = ajv.compile(schema);
  } catch {
    return [];
  }

  const errors: CellError[] = [];
  const data = rows.map((row) => unflattenRow(row));

  // Validate the whole array
  const arraySchema = {
    type: "array",
    items: schema.items ?? schema,
  };

  let validateArray: ReturnType<typeof ajv.compile>;
  try {
    validateArray = ajv.compile(arraySchema);
  } catch {
    return [];
  }

  validateArray(data);

  if (validateArray.errors) {
    for (const err of validateArray.errors) {
      const instancePath = err.instancePath || "";
      // Parse path like /0/name or /0/address/city
      const match = instancePath.match(/^\/(\d+)\/(.+)$/);
      if (match) {
        const rowIndex = parseInt(match[1], 10);
        const columnPath = match[2].replace(/\//g, ".");
        errors.push({
          key: `${rowIndex}:${columnPath}`,
          message: err.message || "Validation error",
        });
      } else {
        // Row-level error — for "required", map to the specific missing property
        const rowMatch = instancePath.match(/^\/(\d+)(\/.*)?$/);
        if (rowMatch) {
          const rowIndex = parseInt(rowMatch[1], 10);
          const subPath = rowMatch[2] ? rowMatch[2].slice(1).replace(/\//g, ".") : "";

          if (err.keyword === "required" && err.params && (err.params as any).missingProperty) {
            const missing = (err.params as any).missingProperty;
            const columnPath = subPath ? `${subPath}.${missing}` : missing;
            errors.push({
              key: `${rowIndex}:${columnPath}`,
              message: `required property "${missing}" is missing`,
            });
          } else {
            errors.push({
              key: `${rowIndex}:${subPath}`,
              message: err.message || "Validation error",
            });
          }
        }
      }
    }
  }

  return errors;
}
