import type { SearchView } from "../types";
import { renderRouteBullet } from "../components/route-bullet";
import { escapeHtml } from "../utils";

export function renderSearch(data: SearchView): string {
  const parts: string[] = [];

  if (data.stations.length > 0) {
    parts.push(`<div class="section-title">Stations</div>`);
    for (const station of data.stations) {
      const pills = station.routes
        .map((r) => renderRouteBullet(r.name, r.color, r.text_color, "sm"))
        .join("");
      parts.push(
        `<div class="search-result">` +
          `<span class="station-name">${escapeHtml(station.name)}</span>` +
          `<span class="route-pills">${pills}</span>` +
          `</div>`
      );
    }
  }

  if (data.routes.length > 0) {
    parts.push(`<div class="section-title">Routes</div>`);
    for (const route of data.routes) {
      parts.push(
        `<div class="search-result">` +
          renderRouteBullet(route.name, route.color, route.text_color) +
          `<span>${escapeHtml(route.long_name)}</span>` +
          `</div>`
      );
    }
  }

  if (data.stations.length === 0 && data.routes.length === 0) {
    parts.push(`<div class="empty-state">No results found</div>`);
  }

  return parts.join("");
}
