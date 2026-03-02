/**
 * GET /api/search?q={query} — Search stations and routes by name.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { search } from "@/lib/search";
import { getStationRoutes, getRouteStations, getRoutes } from "@/lib/gtfs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || !q.trim()) {
    return apiError(
      "MISSING_QUERY",
      "The 'q' query parameter is required. Example: /api/search?q=72+st+q",
      "/api/search",
      400,
    );
  }

  const results = search(q, 10);
  const stationRouteMap = getStationRoutes();
  const routeStationMap = getRouteStations();
  const allRoutes = getRoutes();
  const routeMap = new Map(allRoutes.map((r) => [r.id, r]));

  // Enrich stations with their routes and potential arrivals_url
  const enrichedStations = results.stations.map((station) => {
    const routeIds = stationRouteMap[station.id] || [];
    const routes = routeIds
      .map((id) => routeMap.get(id))
      .filter(Boolean)
      .map((r) => ({
        id: r!.id,
        short_name: r!.shortName,
        slug: r!.slug,
      }));

    // If a route from the search results serves this station, include arrivals_url
    let arrivals_url: string | null = null;
    if (results.routes.length > 0) {
      const matchedRoute = results.routes.find((r) =>
        routeIds.includes(r.id),
      );
      if (matchedRoute) {
        arrivals_url = `/api/stops/${station.slug}/lines/${matchedRoute.slug}`;
      }
    }

    return {
      id: station.id,
      name: station.name,
      slug: station.slug,
      routes,
      detail_url: `/api/stops/${station.slug}`,
      ...(arrivals_url ? { arrivals_url } : {}),
    };
  });

  // Enrich routes with station counts
  const enrichedRoutes = results.routes.map((route) => ({
    id: route.id,
    short_name: route.shortName,
    long_name: route.longName,
    slug: route.slug,
    color: route.color,
    station_count: (routeStationMap[route.id] || []).length,
    detail_url: `/api/lines/${route.slug}`,
  }));

  // Build suggestion if we matched both a station and a route
  let suggestion: string | null = null;
  if (enrichedStations.length > 0 && enrichedRoutes.length > 0) {
    const topStation = enrichedStations[0];
    const topRoute = enrichedRoutes[0];
    const routeServes = (stationRouteMap[results.stations[0].id] || []).includes(
      results.routes[0].id,
    );
    if (routeServes && topStation.arrivals_url) {
      suggestion = `For ${topRoute.short_name} train arrivals at ${topStation.name}, call: ${topStation.arrivals_url}`;
    }
  }

  return apiSuccess(
    {
      query: q,
      stations: enrichedStations,
      routes: enrichedRoutes,
      ...(suggestion ? { suggestion } : {}),
    },
    "/api/search",
  );
}
