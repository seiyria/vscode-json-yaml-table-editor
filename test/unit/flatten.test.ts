import { describe, it, expect } from "vitest";
import { flattenObject, unflattenRow, guessType } from "../../src/parsers/flatten";

describe("flattenObject", () => {
  it("flattens a simple object", () => {
    const result = flattenObject({ a: 1, b: "hello" });
    expect(result).toEqual({ a: 1, b: "hello" });
  });

  it("flattens nested objects with dot-delimited keys", () => {
    const result = flattenObject({
      name: "Alice",
      address: { city: "NYC", zip: "10001" },
    });
    expect(result).toEqual({
      name: "Alice",
      "address.city": "NYC",
      "address.zip": "10001",
    });
  });

  it("flattens deeply nested objects", () => {
    const result = flattenObject({
      a: { b: { c: "deep" } },
    });
    expect(result).toEqual({ "a.b.c": "deep" });
  });

  it("keeps arrays as values", () => {
    const result = flattenObject({
      tags: ["a", "b"],
    });
    expect(result).toEqual({ tags: ["a", "b"] });
  });

  it("handles null values", () => {
    const result = flattenObject({ x: null });
    expect(result).toEqual({ x: null });
  });
});

describe("unflattenRow", () => {
  it("unflattens dot-delimited keys", () => {
    const result = unflattenRow({
      "address.city": "NYC",
      "address.zip": "10001",
      name: "Alice",
    });
    expect(result).toEqual({
      address: { city: "NYC", zip: "10001" },
      name: "Alice",
    });
  });

  it("skips undefined values", () => {
    const result = unflattenRow({ a: 1, b: undefined });
    expect(result).toEqual({ a: 1 });
  });

  it("creates intermediate objects", () => {
    const result = unflattenRow({ "a.b.c": 42 });
    expect(result).toEqual({ a: { b: { c: 42 } } });
  });
});

describe("guessType", () => {
  it("returns correct types", () => {
    expect(guessType(42)).toBe("number");
    expect(guessType("hello")).toBe("string");
    expect(guessType(true)).toBe("boolean");
    expect(guessType([1, 2])).toBe("array");
    expect(guessType({})).toBe("object");
    expect(guessType(null)).toBe("unknown");
    expect(guessType(undefined)).toBe("unknown");
  });

  it("detects array of objects as arrayOfObjects", () => {
    expect(guessType([{ a: 1 }])).toBe("arrayOfObjects");
    expect(guessType([{ a: 1 }, { b: 2 }])).toBe("arrayOfObjects");
  });

  it("detects plain arrays as array", () => {
    expect(guessType(["a", "b"])).toBe("array");
    expect(guessType([1, 2, 3])).toBe("array");
    expect(guessType([])).toBe("array");
  });

  it("detects mixed arrays with objects as arrayOfObjects", () => {
    expect(guessType([1, { a: 1 }])).toBe("arrayOfObjects");
    expect(guessType([null, { a: 1 }])).toBe("arrayOfObjects");
  });

  it("does not treat arrays of arrays as arrayOfObjects", () => {
    expect(guessType([[1, 2], [3, 4]])).toBe("array");
  });
});
