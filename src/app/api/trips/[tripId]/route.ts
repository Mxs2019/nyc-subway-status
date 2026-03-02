/**
 * GET /api/trips/{tripId}?route={routeSlug} — Track a specific train by trip ID.
 * Returns every stop on the trip with arrival times and station details.
 */

import { apiSuccess, apiError } from "@/lib/api-helpers";
import {
  getRouteBySlug,
  getStationByChildStopId,
} from "@/lib/gtfs";
import { getTripById } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const endpoint = `/api/trips/${tripId}`;

  const { searchParams } = new URL(request.url);
  const routeSlug = searchParams.get("route");

  if (!routeSlug) {
    return apiError(
      "MISSING_ROUTE",
      "The 'route' query parameter is required (e.g. ?route=q). Needed to select the correct MTA feed.",
      endpoint,
    );
  }

  const route = getRouteBySlug(routeSlug);
  if (!route) {
    return apiError(
      "ROUTE_NOT_FOUND",
      `No route found for slug '${routeSlug}'. Use /api/lines to list all routes.`,
      endpoint,
      404,
    );
  }

  const trip = await getTripById(route.id, tripId);
  if (!trip) {
    return apiError(
      "TRIP_NOT_FOUND",
      `No active trip found for ID '${tripId}' on route '${route.shortName}'. The train may have completed its run.`,
      endpoint,
      404,
    );
  }

  const now = Math.floor(Date.now() / 1000);

  const stops = trip.stopTimes.map((st) => {
    const station = getStationByChildStopId(st.stopId);
    const time = st.arrivalTime ?? st.departureTime;
    const minutesAway = time != null ? Math.max(0, Math.round((time - now) / 60)) : null;
    const status = time != null && time <= now ? "passed" : "upcoming";

    return {
      station: station
        ? { name: station.name, slug: station.slug }
        : { name: st.stopId, slug: null },
      arrival_time: st.arrivalTime,
      arrival_time_iso: st.arrivalTime
        ? new Date(st.arrivalTime * 1000).toISOString()
        : null,
      departure_time: st.departureTime,
      minutes_away: minutesAway,
      status,
    };
  });

  return apiSuccess(
    {
      trip_id: trip.tripId,
      route: {
        id: route.id,
        short_name: route.shortName,
        slug: route.slug,
        color: route.color,
      },
      direction: trip.directionId === 0 ? "uptown" : "downtown",
      start_date: trip.startDate,
      start_time: trip.startTime,
      stops,
      fetched_at: new Date().toISOString(),
    },
    endpoint,
    true,
  );
}
