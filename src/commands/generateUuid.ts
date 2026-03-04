import * as crypto from "crypto";

/** Generate a v4 UUID */
export function generateUuid(): string {
  return crypto.randomUUID();
}
