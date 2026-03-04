import type { Arrival, ArrivalsView } from "../types";
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

export function renderArrivals(data: ArrivalsView): string {
  const header =
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">` +
    renderRouteBullet(data.route.name, data.route.color, data.route.text_color, "lg") +
    `<span class="station-name">${escapeHtml(data.station)}</span>` +
    `</div>`;

  const uptown =
    `<div class="direction-group">` +
    `<div class="direction-label">Uptown</div>` +
    renderArrivalRows(data.uptown_arrivals) +
    `</div>`;

  const downtown =
    `<div class="direction-group">` +
    `<div class="direction-label">Downtown</div>` +
    renderArrivalRows(data.downtown_arrivals) +
    `</div>`;

  return header + uptown + downtown;
}
