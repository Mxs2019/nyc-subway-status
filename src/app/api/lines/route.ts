/**
 * GET /api/lines — List all subway routes with station counts.
 */

import { apiSuccess } from "@/lib/api-helpers";
import { getRoutes, getRouteStations } from "@/lib/gtfs";

export async function GET() {
  const routes = getRoutes();
  const routeStationMap = getRouteStations();

  const data = routes.map((route) => ({
    id: route.id,
    short_name: route.shortName,
    long_name: route.longName,
    slug: route.slug,
    color: route.color,
    text_color: route.textColor,
    station_count: (routeStationMap[route.id] || []).length,
    detail_url: `/api/lines/${route.slug}`,
  }));

  return apiSuccess({ count: data.length, lines: data }, "/api/lines");
}
