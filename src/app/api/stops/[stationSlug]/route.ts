/**
 * GET /api/stops/{stationSlug} — Realtime arrivals for all routes at a station.
 */

import { apiSuccess, apiError, formatArrival } from "@/lib/api-helpers";
import {
  getStationBySlug,
  getRoutesForStation,
  getRouteById,
} from "@/lib/gtfs";
import { getAllArrivalsForStation } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stationSlug: string }> },
) {
  const { stationSlug } = await params;
  const station = getStationBySlug(stationSlug);

  if (!station) {
    return apiError(
      "STATION_NOT_FOUND",
      `No station found for slug '${stationSlug}'. Use /api/search?q=... to find station slugs.`,
      `/api/stops/${stationSlug}`,
      404,
    );
  }

  const routes = getRoutesForStation(station.id);
  const routeIds = routes.map((r) => r.id);

  const allArrivals = await getAllArrivalsForStation(
    station.childStopIds,
    routeIds,
    5,
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
