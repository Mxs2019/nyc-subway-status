/**
 * GET /api/alerts — Active service alerts, optionally filtered by route or station.
 *
 * Query params:
 *   route  — Route slug (e.g. "q", "a") — can be repeated or comma-separated
 *   station — Station slug — filters to alerts affecting that station's stop IDs
 */

import { type NextRequest } from "next/server";
import { apiSuccess, apiError, formatAlert } from "@/lib/api-helpers";
import {
  getRouteBySlug,
  getStationBySlug,
} from "@/lib/gtfs";
import { getServiceAlerts } from "@/lib/gtfsrt";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  const routeParam = request.nextUrl.searchParams.get("route");
  const stationParam = request.nextUrl.searchParams.get("station");

  let routeIds: string[] | undefined;
  let stopIds: string[] | undefined;

  if (routeParam) {
    const slugs = routeParam.split(",").map((s) => s.trim().toLowerCase());
    routeIds = [];
    for (const slug of slugs) {
      const route = getRouteBySlug(slug);
      if (!route) {
        return apiError(
          "ROUTE_NOT_FOUND",
          `Route not found: "${slug}". Use /api/search?q=... to find route slugs.`,
          "/api/alerts",
          404,
        );
      }
      routeIds.push(route.id);
    }
  }

  if (stationParam) {
    const station = getStationBySlug(stationParam);
    if (!station) {
      return apiError(
        "STATION_NOT_FOUND",
        `Station not found: "${stationParam}". Use /api/search?q=... to find station slugs.`,
        "/api/alerts",
        404,
      );
    }
    stopIds = station.childStopIds;
  }

  const alerts = await getServiceAlerts({ routeIds, stopIds });

  return apiSuccess(
    {
      alerts: alerts.map(formatAlert),
      count: alerts.length,
    },
    "/api/alerts",
    true,
  );
}
