/**
 * GET /api/stops — List all stations, optionally filtered by route.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import {
  getStations,
  getStationRoutes,
  getRouteStations,
  getRoutes,
  getRouteBySlug,
} from "@/lib/gtfs";

export async function GET(request: NextRequest) {
  const routeFilter = request.nextUrl.searchParams.get("route");

  const allRoutes = getRoutes();
  const routeMap = new Map(allRoutes.map((r) => [r.id, r]));
  const stationRouteMap = getStationRoutes();

  let stations = getStations();

  // If filtered by route, narrow to stations on that route
  if (routeFilter) {
    const route = getRouteBySlug(routeFilter.toLowerCase());
    if (!route) {
      return apiError(
        "ROUTE_NOT_FOUND",
        `No route found for slug '${routeFilter}'. Use /api/lines to list all routes.`,
        "/api/stops",
        404,
      );
    }
    const routeStationMap = getRouteStations();
    const stationIds = new Set(routeStationMap[route.id] || []);
    stations = stations.filter((s) => stationIds.has(s.id));
  }

  const data = stations.map((station) => {
    const routeIds = stationRouteMap[station.id] || [];
    return {
      id: station.id,
      name: station.name,
      slug: station.slug,
      routes: routeIds
        .map((id) => routeMap.get(id))
        .filter(Boolean)
        .map((r) => ({
          id: r!.id,
          short_name: r!.shortName,
          slug: r!.slug,
        })),
      detail_url: `/api/stops/${station.slug}`,
    };
  });

  return apiSuccess(
    {
      count: data.length,
      ...(routeFilter ? { filtered_by_route: routeFilter } : {}),
      stops: data,
    },
    "/api/stops",
  );
}
