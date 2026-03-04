import type { TripView } from "../types";
import { renderRouteBullet } from "../components/route-bullet";
import { formatMinutes } from "../components/time";
import { escapeHtml } from "../utils";

export function renderTrip(data: TripView): string {
  const header =
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">` +
    renderRouteBullet(data.route.name, data.route.color, data.route.text_color, "lg") +
    `<span class="station-name">${escapeHtml(data.direction)}</span>` +
    `</div>` +
    `<div style="font-size:12px;color:#666;margin-bottom:12px">Trip ${escapeHtml(data.trip_id)}</div>`;

  const stops = data.stops
    .map((stop) => {
      const statusClass = stop.status;
      const dotStyle =
        stop.status === "upcoming"
          ? `border-color:${escapeHtml(data.route.color)}`
          : "";
      const timeStr =
        stop.minutes_away !== null ? formatMinutes(stop.minutes_away) : "";
      return (
        `<div class="trip-stop ${statusClass}">` +
        `<span class="dot" style="${dotStyle}"></span>` +
        `<span style="flex:1">${escapeHtml(stop.station)}</span>` +
        (timeStr
          ? `<span class="minutes" style="font-size:12px">${escapeHtml(timeStr)}</span>`
          : "") +
        `</div>`
      );
    })
    .join("");

  return header + stops;
}
