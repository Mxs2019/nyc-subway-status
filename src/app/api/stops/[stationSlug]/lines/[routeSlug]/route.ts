/**
 * GET /api/stops/{stationSlug}/lines/{routeSlug} — Realtime arrivals for a specific route at a station.
 */

import { apiSuccess, apiError, formatArrival } from "@/lib/api-helpers";
import {
  getStationBySlug,
  getRouteBySlug,
  getRoutesForStation,
} from "@/lib/gtfs";
import { getArrivals } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ stationSlug: string; routeSlug: string }> },
) {
  const { stationSlug, routeSlug } = await params;
  const station = getStationBySlug(stationSlug);

  if (!station) {
    return apiError(
      "STATION_NOT_FOUND",
      `No station found for slug '${stationSlug}'. Use /api/search?q=... to find station slugs.`,
      `/api/stops/${stationSlug}/lines/${routeSlug}`,
      404,
    );
  }

  const route = getRouteBySlug(routeSlug);

  if (!route) {
    return apiError(
      "ROUTE_NOT_FOUND",
      `No route found for slug '${routeSlug}'. Use /api/lines to list all routes.`,
      `/api/stops/${stationSlug}/lines/${routeSlug}`,
      404,
    );
  }

  const directions = await getArrivals(station.childStopIds, route.id);
  const now = Math.floor(Date.now() / 1000);

  const uptown = directions
    .filter((d) => d.directionId === 0)
    .flatMap((d) => d.arrivals.map((a) => formatArrival(a, now)));

  const downtown = directions
    .filter((d) => d.directionId === 1)
    .flatMap((d) => d.arrivals.map((a) => formatArrival(a, now)));

  // Other routes at this station for discoverability
  const allRoutes = getRoutesForStation(station.id);
  const otherRoutes = allRoutes
    .filter((r) => r.id !== route.id)
    .map((r) => ({
      id: r.id,
      short_name: r.shortName,
      slug: r.slug,
      arrivals_url: `/api/stops/${station.slug}/lines/${r.slug}`,
    }));

  return apiSuccess(
    {
      station: {
        id: station.id,
        name: station.name,
        slug: station.slug,
      },
      route: {
        id: route.id,
        short_name: route.shortName,
        long_name: route.longName,
        slug: route.slug,
        color: route.color,
      },
      arrivals: { uptown, downtown },
      other_routes_at_station: otherRoutes,
    },
    `/api/stops/${stationSlug}/lines/${routeSlug}`,
    true,
  );
}
