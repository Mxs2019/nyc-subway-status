import { describe, it, expect } from "vitest";
import { hasExactRouteMatch } from "./home-search";

const ROUTES = [
  { shortName: "Q" },
  { shortName: "6" },
  { shortName: "B" },
  { shortName: "A" },
  { shortName: "SI" },
  { shortName: "N" },
];

describe("hasExactRouteMatch", () => {
  it("returns true for exact single-letter route match", () => {
    expect(hasExactRouteMatch("Q", ROUTES)).toBe(true);
    expect(hasExactRouteMatch("B", ROUTES)).toBe(true);
    expect(hasExactRouteMatch("A", ROUTES)).toBe(true);
  });

  it("returns true for exact number route match", () => {
    expect(hasExactRouteMatch("6", ROUTES)).toBe(true);
  });

  it("returns true for multi-letter route match (SI)", () => {
    expect(hasExactRouteMatch("SI", ROUTES)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasExactRouteMatch("q", ROUTES)).toBe(true);
    expect(hasExactRouteMatch("si", ROUTES)).toBe(true);
    expect(hasExactRouteMatch("Si", ROUTES)).toBe(true);
  });

  it("trims whitespace", () => {
    expect(hasExactRouteMatch(" Q ", ROUTES)).toBe(true);
    expect(hasExactRouteMatch("  SI  ", ROUTES)).toBe(true);
  });

  it("returns false for station-like queries with no exact route match", () => {
    expect(hasExactRouteMatch("Union", ROUTES)).toBe(false);
    expect(hasExactRouteMatch("14", ROUTES)).toBe(false);
    expect(hasExactRouteMatch("Broadway", ROUTES)).toBe(false);
  });

  it("returns false for empty or whitespace-only queries", () => {
    expect(hasExactRouteMatch("", ROUTES)).toBe(false);
    expect(hasExactRouteMatch("   ", ROUTES)).toBe(false);
  });

  it("returns false for partial route matches", () => {
    expect(hasExactRouteMatch("QR", ROUTES)).toBe(false);
    expect(hasExactRouteMatch("S", ROUTES)).toBe(false);
  });
});
