/**
 * GET /api/stops/{stationSlug} — Realtime arrivals for all routes at a station.
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, formatArrival } from "@/lib/api-helpers";
import {
  type Route,
  getStationBySlug,
  getRouteBySlug,
  getRoutesForStation,
  getRouteById,
} from "@/lib/gtfs";
import { getAllArrivalsForStation } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stationSlug: string }> },
) {
  const { stationSlug } = await params;
  const directionParam = request.nextUrl.searchParams.get("direction") as "uptown" | "downtown" | null;
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 5), 20) : 5;
  const routesParam = request.nextUrl.searchParams.get("routes");
  const station = getStationBySlug(stationSlug);

  if (!station) {
    return apiError(
      "STATION_NOT_FOUND",
      `No station found for slug '${stationSlug}'. Use /api/search?q=... to find station slugs.`,
      `/api/stops/${stationSlug}`,
      404,
    );
  }

  const allStationRoutes = getRoutesForStation(station.id);

  // Filter to specific routes if requested
  let routes = allStationRoutes;
  if (routesParam) {
    const slugs = routesParam.split(",").map((s) => s.trim().toLowerCase());
    const filtered = slugs
      .map((slug) => getRouteBySlug(slug))
      .filter((r): r is Route => r != null && allStationRoutes.some((sr) => sr.id === r.id));
    if (filtered.length > 0) {
      routes = filtered;
    }
  }
  const routeIds = routes.map((r) => r.id);

  const allArrivals = await getAllArrivalsForStation(
    station.childStopIds,
    routeIds,
    limit,
    60,
  );

  const now = Math.floor(Date.now() / 1000);

  // Flat lists: all arrivals combined across routes, split by direction
  const uptownAll: ReturnType<typeof formatArrival>[] = [];
  const downtownAll: ReturnType<typeof formatArrival>[] = [];

  // Per-route breakdown
  const byRoute: Record<
    string,
    {
      uptown: ReturnType<typeof formatArrival>[];
      downtown: ReturnType<typeof formatArrival>[];
    }
  > = {};

  for (const [routeId, directions] of allArrivals) {
    const route = getRouteById(routeId);
    const key = route?.shortName || routeId;
    byRoute[key] = { uptown: [], downtown: [] };

    for (const dir of directions) {
      if (directionParam === "uptown" && dir.directionId !== 0) continue;
      if (directionParam === "downtown" && dir.directionId !== 1) continue;

      const formatted = dir.arrivals.map((a) => formatArrival(a, now));
      if (dir.directionId === 0) {
        byRoute[key].uptown = formatted;
        uptownAll.push(...formatted);
      } else {
        byRoute[key].downtown = formatted;
        downtownAll.push(...formatted);
      }
    }
  }

  // Sort combined lists by arrival time
  uptownAll.sort((a, b) => a.arrival_time - b.arrival_time);
  downtownAll.sort((a, b) => a.arrival_time - b.arrival_time);

  return apiSuccess(
    {
      station: {
        id: station.id,
        name: station.name,
        slug: station.slug,
      },
      routes: routes.map((r) => ({
        id: r.id,
        short_name: r.shortName,
        slug: r.slug,
        color: r.color,
      })),
      arrivals: {
        uptown: uptownAll,
        downtown: downtownAll,
      },
      by_route: byRoute,
    },
    `/api/stops/${stationSlug}`,
    true,
  );
}
