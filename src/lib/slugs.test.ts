import { describe, it, expect } from "vitest";
import { stationSlug, routeSlug } from "./slugs";

describe("stationSlug", () => {
  it("converts name to lowercase hyphenated slug", () => {
    expect(stationSlug("Times Sq-42 St")).toBe("times-sq-42-st");
  });

  it("handles simple station names", () => {
    expect(stationSlug("Fulton St")).toBe("fulton-st");
  });

  it("removes ASCII apostrophes", () => {
    // The regex strips ' (U+0027) — "King's" → "kings"
    expect(stationSlug("King's Highway")).toBe("kings-highway");
  });

  it("treats curly quotes as non-alphanumeric separators", () => {
    // Right single quotation mark (U+2019) is not in the strip list,
    // so it falls through to the [^a-z0-9]+ replacement → hyphen
    expect(stationSlug("King\u2019s Highway")).toBe("king-s-highway");
  });

  it("collapses multiple special characters into single hyphen", () => {
    expect(stationSlug("14 St / 8 Av")).toBe("14-st-8-av");
  });

  it("strips leading and trailing hyphens", () => {
    expect(stationSlug("-Test-")).toBe("test");
    expect(stationSlug("  Hello  ")).toBe("hello");
  });

  it("handles numeric station names", () => {
    expect(stationSlug("34 St-Penn Station")).toBe("34-st-penn-station");
    expect(stationSlug("125 St")).toBe("125-st");
  });

  it("handles empty string", () => {
    expect(stationSlug("")).toBe("");
  });
});

describe("routeSlug", () => {
  it("lowercases single-letter routes", () => {
    expect(routeSlug("A")).toBe("a");
    expect(routeSlug("Q")).toBe("q");
  });

  it("lowercases numeric routes", () => {
    expect(routeSlug("7")).toBe("7");
  });

  it("lowercases multi-character routes", () => {
    expect(routeSlug("SI")).toBe("si");
    expect(routeSlug("GS")).toBe("gs");
    expect(routeSlug("FS")).toBe("fs");
  });

  it("handles already lowercase input", () => {
    expect(routeSlug("a")).toBe("a");
  });
});
