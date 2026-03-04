/**
 * GET /api/trips/plan — Plan a trip between two stations.
 *
 * Query params:
 *   origin      — Origin station slug (required)
 *   destination — Destination station slug (required)
 *   route       — Route slug filter (optional; if omitted, searches all shared routes)
 *   depart_after — ISO timestamp, only trips departing at or after this time (optional, default: now)
 *   limit       — Max trips to return (optional, default: 5, max: 20)
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import {
  getStationBySlug,
  getRouteBySlug,
  getRouteById,
  getRoutesForStation,
} from "@/lib/gtfs";
import { planTrip } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  const endpoint = "/api/trips/plan";
  const sp = request.nextUrl.searchParams;

  const originSlug = sp.get("origin");
  const destinationSlug = sp.get("destination");
  const routeSlug = sp.get("route");
  const departAfterParam = sp.get("depart_after");
  const limitParam = sp.get("limit");

  if (!originSlug) {
    return apiError("MISSING_ORIGIN", "The 'origin' query parameter is required (station slug).", endpoint);
  }
  if (!destinationSlug) {
    return apiError("MISSING_DESTINATION", "The 'destination' query parameter is required (station slug).", endpoint);
  }

  const origin = getStationBySlug(originSlug);
  if (!origin) {
    return apiError("STATION_NOT_FOUND", `No station found for origin slug '${originSlug}'. Use /api/search?q=... to find station slugs.`, endpoint, 404);
  }

  const destination = getStationBySlug(destinationSlug);
  if (!destination) {
    return apiError("STATION_NOT_FOUND", `No station found for destination slug '${destinationSlug}'. Use /api/search?q=... to find station slugs.`, endpoint, 404);
  }

  // Determine which routes to search
  let routeIds: string[];
  if (routeSlug) {
    const route = getRouteBySlug(routeSlug);
    if (!route) {
      return apiError("ROUTE_NOT_FOUND", `No route found for slug '${routeSlug}'.`, endpoint, 404);
    }
    routeIds = [route.id];
  } else {
    // Find routes that serve both stations
    const originRoutes = new Set(getRoutesForStation(origin.id).map((r) => r.id));
    const destRoutes = getRoutesForStation(destination.id).map((r) => r.id);
    routeIds = destRoutes.filter((id) => originRoutes.has(id));

    if (routeIds.length === 0) {
      return apiError(
        "NO_DIRECT_ROUTE",
        `No direct route between ${origin.name} and ${destination.name}. A transfer would be required.`,
        endpoint,
      );
    }
  }

  const departAfter = departAfterParam ? Math.floor(new Date(departAfterParam).getTime() / 1000) : undefined;
  const limit = Math.min(Math.max(1, parseInt(limitParam || "5", 10) || 5), 20);

  const trips = await planTrip(
    origin.childStopIds,
    destination.childStopIds,
    routeIds,
    departAfter,
    limit,
  );

  const now = Math.floor(Date.now() / 1000);

  const formattedTrips = trips.map((t) => {
    const route = getRouteById(t.routeId);
    return {
      trip_id: t.tripId,
      route: route?.shortName ?? t.routeId,
      depart_origin_iso: new Date(t.departOriginTime * 1000).toISOString(),
      depart_origin_minutes: Math.max(0, Math.round((t.departOriginTime - now) / 60)),
      arrive_destination_iso: new Date(t.arriveDestinationTime * 1000).toISOString(),
      arrive_destination_minutes: Math.max(0, Math.round((t.arriveDestinationTime - now) / 60)),
      travel_time_minutes: Math.round((t.arriveDestinationTime - t.departOriginTime) / 60),
      num_stops: t.numStops,
    };
  });

  return apiSuccess(
    {
      origin: { name: origin.name, slug: origin.slug },
      destination: { name: destination.name, slug: destination.slug },
      trips: formattedTrips,
      fetched_at: new Date().toISOString(),
    },
    endpoint,
    true,
  );
}
