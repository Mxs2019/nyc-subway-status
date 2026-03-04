import type { PlannerView } from "../types";
import { renderRouteBullet } from "../components/route-bullet";
import { escapeHtml } from "../utils";

export function renderPlanner(data: PlannerView): string {
  const header =
    `<div class="station-name" style="margin-bottom:12px">` +
    `${escapeHtml(data.origin)} &rarr; ${escapeHtml(data.destination)}` +
    `</div>`;

  if (data.trips.length === 0) {
    return header + `<div class="empty-state">No trips found</div>`;
  }

  const trips = data.trips
    .map((trip) => {
      const bullet = renderRouteBullet(
        trip.route.name,
        trip.route.color,
        trip.route.text_color
      );
      return (
        `<div class="trip-option">` +
        bullet +
        `<div style="flex:1">` +
        `<div>Depart in ${trip.depart_minutes} min &middot; Arrive in ${trip.arrive_minutes} min</div>` +
        `<div class="trip-detail">${trip.travel_minutes} min travel &middot; ${trip.num_stops} stop${trip.num_stops !== 1 ? "s" : ""}</div>` +
        `</div>` +
        `</div>`
      );
    })
    .join("");

  return header + trips;
}
