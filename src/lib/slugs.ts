/**
 * Generate a URL-safe slug from a station name.
 * e.g. "Times Sq-42 St" → "times-sq-42-st"
 */
export function stationSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a URL-safe slug from a route ID.
 * Most subway routes are single characters (A, 1, etc.)
 * Shuttles may be "GS", "FS", "H", "SI".
 */
export function routeSlug(routeId: string): string {
  return routeId.toLowerCase();
}
