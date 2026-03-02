/**
 * GET /api/lines/{routeSlug} — Next arrival at every station on a route.
 */

import { apiSuccess, apiError, formatArrival } from "@/lib/api-helpers";
import { getRouteBySlug, getStationsForRoute } from "@/lib/gtfs";
import { getNextArrivalsForRoute } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ routeSlug: string }> },
) {
  const { routeSlug } = await params;
  const route = getRouteBySlug(routeSlug);

  if (!route) {
    return apiError(
      "ROUTE_NOT_FOUND",
      `No route found for slug '${routeSlug}'. Use /api/lines to list all routes.`,
      `/api/lines/${routeSlug}`,
      404,
    );
  }

  const stations = getStationsForRoute(route.id);
  const nextArrivals = await getNextArrivalsForRoute(
    route.id,
    stations.map((s) => ({ id: s.id, childStopIds: s.childStopIds })),
  );

  const now = Math.floor(Date.now() / 1000);

  const stationData = stations.map((station) => {
    const entry = nextArrivals.get(station.id);
    return {
      id: station.id,
      name: station.name,
      slug: station.slug,
      next_uptown: entry?.uptown ? formatArrival(entry.uptown, now) : null,
      next_downtown: entry?.downtown
        ? formatArrival(entry.downtown, now)
        : null,
      arrivals_url: `/api/stops/${station.slug}/lines/${route.slug}`,
    };
  });

  return apiSuccess(
    {
      route: {
        id: route.id,
        short_name: route.shortName,
        long_name: route.longName,
        slug: route.slug,
        color: route.color,
        text_color: route.textColor,
      },
      station_count: stationData.length,
      stations: stationData,
    },
    `/api/lines/${routeSlug}`,
    true,
  );
}
