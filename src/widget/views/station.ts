import type { Arrival, StationView } from "../types";
import { renderRouteBullet } from "../components/route-bullet";
import { formatMinutes } from "../components/time";
import { escapeHtml } from "../utils";

function renderArrivalRows(arrivals: Arrival[]): string {
  if (arrivals.length === 0) {
    return `<div class="empty-state">No upcoming arrivals</div>`;
  }
  return arrivals
    .map((a) => {
      const isArriving = a.minutes_away === 0;
      const minutesClass = isArriving ? "minutes arriving" : "minutes";
      return (
        `<div class="arrival-row">` +
        `<span class="${minutesClass}">${escapeHtml(formatMinutes(a.minutes_away))}</span>` +
        `<span class="headsign">${escapeHtml(a.headsign)}</span>` +
        `</div>`
      );
    })
    .join("");
}

export function renderStation(data: StationView): string {
  const header = `<div class="station-name" style="margin-bottom:12px">${escapeHtml(data.station)}</div>`;

  const routeSections = data.routes
    .map((route) => {
      const bullet = renderRouteBullet(route.name, route.color, route.text_color);
      const uptown =
        `<div class="direction-group">` +
        `<div class="direction-label">Uptown</div>` +
        renderArrivalRows(route.uptown) +
        `</div>`;
      const downtown =
        `<div class="direction-group">` +
        `<div class="direction-label">Downtown</div>` +
        renderArrivalRows(route.downtown) +
        `</div>`;
      return (
        `<div style="margin-bottom:16px">` +
        `<div class="section-title" style="display:flex;align-items:center;gap:6px">${bullet} <span>${escapeHtml(route.name)} Train</span></div>` +
        uptown +
        downtown +
        `</div>`
      );
    })
    .join("");

  return header + routeSections;
}
