/**
 * MCP Server — exposes NYC subway data as tools for AI agents.
 *
 * Endpoints (handled by mcp-handler via [transport] dynamic segment):
 *   POST /mcp  — Streamable HTTP (recommended)
 *   GET  /sse  — SSE fallback for older clients
 *
 * Tools:
 *   search_subway        — Search stations/routes by name
 *   get_arrivals         — Realtime arrivals for a route at a station
 *   get_station_arrivals — Realtime arrivals for ALL routes at a station
 *   list_stations        — List all stations (optionally filtered by route)
 *   list_routes          — List all subway routes
 *   get_trip             — Track a specific train by trip ID
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  getStations,
  getRoutes,
  getStationBySlug,
  getRouteBySlug,
  getRouteById,
  getRoutesForStation,
  getStationsForRoute,
  getStationRoutes,
  getStationByChildStopId,
} from "@/lib/gtfs";
import {
  getArrivals,
  getAllArrivalsForStation,
  getTripById,
} from "@/lib/gtfsrt";
import { search } from "@/lib/search";

function formatArrivalForMcp(a: { arrivalTime: number; routeId: string }, now: number) {
  return {
    route_id: a.routeId,
    minutes_away: Math.max(0, Math.round((a.arrivalTime - now) / 60)),
    arrival_time_iso: new Date(a.arrivalTime * 1000).toISOString(),
  };
}

const handler = createMcpHandler(
  (server) => {
    // -----------------------------------------------------------------
    // search_subway
    // -----------------------------------------------------------------
    server.tool(
      "search_subway",
      "Search for subway stations or routes by name. Use this first when you don't know the exact station or route slug. Returns slugs needed for other tools.",
      { query: z.string().describe('Search query, e.g. "union square", "72 st", "Q train"') },
      async ({ query }) => {
        const results = search(query, 10);
        const stationRouteMap = getStationRoutes();

        const stations = results.stations.map((s) => {
          const routeIds = stationRouteMap[s.id] || [];
          const routes = routeIds
            .map((id) => getRouteById(id))
            .filter(Boolean)
            .map((r) => r!.shortName);
          return { name: s.name, slug: s.slug, routes };
        });

        const routes = results.routes.map((r) => ({
          name: r.shortName,
          long_name: r.longName,
          slug: r.slug,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ stations, routes }, null, 2),
          }],
        };
      },
    );

    // -----------------------------------------------------------------
    // get_arrivals
    // -----------------------------------------------------------------
    server.tool(
      "get_arrivals",
      "Get real-time arrival times for a specific route at a specific station. Returns upcoming trains in both directions with minutes_away. Use search_subway first to find slugs.",
      {
        station_slug: z.string().describe('Station slug from search_subway, e.g. "72-st-n-q-r"'),
        route_slug: z.string().describe('Route slug (lowercase), e.g. "q", "a", "7"'),
      },
      async ({ station_slug, route_slug }) => {
        const station = getStationBySlug(station_slug);
        if (!station) {
          return {
            content: [{ type: "text" as const, text: `Station not found: "${station_slug}". Use search_subway to find the correct slug.` }],
            isError: true,
          };
        }

        const route = getRouteBySlug(route_slug);
        if (!route) {
          return {
            content: [{ type: "text" as const, text: `Route not found: "${route_slug}". Valid slugs: ${getRoutes().map((r) => r.slug).join(", ")}` }],
            isError: true,
          };
        }

        const directions = await getArrivals(station.childStopIds, route.id);
        const now = Math.floor(Date.now() / 1000);

        const uptown = directions
          .filter((d) => d.directionId === 0)
          .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now)));

        const downtown = directions
          .filter((d) => d.directionId === 1)
          .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now)));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              station: station.name,
              route: route.shortName,
              uptown_arrivals: uptown,
              downtown_arrivals: downtown,
              fetched_at: new Date().toISOString(),
            }, null, 2),
          }],
        };
      },
    );

    // -----------------------------------------------------------------
    // get_station_arrivals
    // -----------------------------------------------------------------
    server.tool(
      "get_station_arrivals",
      "Get real-time arrivals for ALL routes at a station. Returns arrivals grouped by route and direction. Use when the user asks about a station without specifying a line.",
      {
        station_slug: z.string().describe("Station slug from search_subway"),
      },
      async ({ station_slug }) => {
        const station = getStationBySlug(station_slug);
        if (!station) {
          return {
            content: [{ type: "text" as const, text: `Station not found: "${station_slug}". Use search_subway to find the correct slug.` }],
            isError: true,
          };
        }

        const routes = getRoutesForStation(station.id);
        const routeIds = routes.map((r) => r.id);
        const allArrivals = await getAllArrivalsForStation(
          station.childStopIds,
          routeIds,
          5,
          30,
        );

        const now = Math.floor(Date.now() / 1000);
        const byRoute: Record<string, { uptown: object[]; downtown: object[] }> = {};

        for (const [routeId, dirs] of allArrivals) {
          const route = routes.find((r) => r.id === routeId);
          if (!route) continue;
          byRoute[route.shortName] = {
            uptown: dirs
              .filter((d) => d.directionId === 0)
              .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now))),
            downtown: dirs
              .filter((d) => d.directionId === 1)
              .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now))),
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              station: station.name,
              routes_served: routes.map((r) => r.shortName),
              arrivals_by_route: byRoute,
              fetched_at: new Date().toISOString(),
            }, null, 2),
          }],
        };
      },
    );

    // -----------------------------------------------------------------
    // list_stations
    // -----------------------------------------------------------------
    server.tool(
      "list_stations",
      "List all NYC subway stations, optionally filtered by route. Returns station names and slugs.",
      {
        route_slug: z.string().optional().describe('Filter to stations on this route, e.g. "q" (optional)'),
      },
      async ({ route_slug }) => {
        let stations = getStations();

        if (route_slug) {
          const route = getRouteBySlug(route_slug);
          if (!route) {
            return {
              content: [{ type: "text" as const, text: `Route not found: "${route_slug}".` }],
              isError: true,
            };
          }
          stations = getStationsForRoute(route.id);
        }

        const data = stations.map((s) => ({ name: s.name, slug: s.slug }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    );

    // -----------------------------------------------------------------
    // list_routes
    // -----------------------------------------------------------------
    server.tool(
      "list_routes",
      "List all NYC subway routes/lines. Returns route names, slugs, and colors.",
      {},
      async () => {
        const routes = getRoutes();
        const data = routes.map((r) => ({
          name: r.shortName,
          long_name: r.longName,
          slug: r.slug,
          color: r.color,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      },
    );

    // -----------------------------------------------------------------
    // get_trip
    // -----------------------------------------------------------------
    server.tool(
      "get_trip",
      "Track a specific train by trip ID. Returns every upcoming stop with arrival times. Use get_arrivals first to find trip IDs.",
      {
        trip_id: z.string().describe("Trip ID from get_arrivals response"),
        route_slug: z.string().describe("Route slug (lowercase), e.g. 'q'"),
      },
      async ({ trip_id, route_slug }) => {
        const route = getRouteBySlug(route_slug);
        if (!route) {
          return {
            content: [{ type: "text" as const, text: `Route not found: "${route_slug}". Valid slugs: ${getRoutes().map((r) => r.slug).join(", ")}` }],
            isError: true,
          };
        }

        const trip = await getTripById(route.id, trip_id);
        if (!trip) {
          return {
            content: [{ type: "text" as const, text: `No active trip found for ID "${trip_id}" on route ${route.shortName}. The train may have completed its run.` }],
            isError: true,
          };
        }

        const now = Math.floor(Date.now() / 1000);
        const stops = trip.stopTimes.map((st) => {
          const station = getStationByChildStopId(st.stopId);
          const time = st.arrivalTime ?? st.departureTime;
          const minutesAway = time != null ? Math.max(0, Math.round((time - now) / 60)) : null;
          const status = time != null && time <= now ? "passed" : "upcoming";

          return {
            station: station ? station.name : st.stopId,
            station_slug: station?.slug ?? null,
            arrival_time_iso: st.arrivalTime
              ? new Date(st.arrivalTime * 1000).toISOString()
              : null,
            minutes_away: minutesAway,
            status,
          };
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              trip_id: trip.tripId,
              route: route.shortName,
              direction: trip.directionId === 0 ? "uptown" : "downtown",
              stops,
              fetched_at: new Date().toISOString(),
            }, null, 2),
          }],
        };
      },
    );
  },
  {},
  {
    basePath: "",
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
