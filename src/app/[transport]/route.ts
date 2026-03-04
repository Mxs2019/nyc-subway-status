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
  planTrip,
} from "@/lib/gtfsrt";
import { search } from "@/lib/search";

function formatArrivalForMcp(a: { arrivalTime: number; routeId: string; tripId: string; headsign: string }, now: number) {
  return {
    route_id: a.routeId,
    trip_id: a.tripId,
    headsign: a.headsign,
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
        const matchedRouteIds = new Set(results.routes.map((r) => r.id));

        const stations = results.stations.map((s) => {
          const routeIds = stationRouteMap[s.id] || [];
          const routes = routeIds
            .map((id) => getRouteById(id))
            .filter(Boolean)
            .map((r) => r!.shortName);
          const matched_routes = routeIds
            .filter((id) => matchedRouteIds.has(id))
            .map((id) => getRouteById(id))
            .filter(Boolean)
            .map((r) => r!.shortName);
          return {
            name: s.name,
            slug: s.slug,
            routes,
            ...(matched_routes.length > 0 ? { matched_routes } : {}),
          };
        });

        const routes = results.routes.map((r) => ({
          name: r.shortName,
          long_name: r.longName,
          slug: r.slug,
        }));

        // Build suggested_call if we matched both a station and a route that serves it
        let suggested_call: object | undefined;
        if (stations.length > 0 && routes.length > 0) {
          const topStation = stations[0];
          const topRoute = routes[0];
          const routeIds = stationRouteMap[results.stations[0].id] || [];
          if (routeIds.includes(results.routes[0].id)) {
            suggested_call = {
              tool: "get_arrivals",
              params: { station_slug: topStation.slug, route_slug: topRoute.slug },
            };
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              stations,
              routes,
              ...(suggested_call ? { suggested_call } : {}),
            }, null, 2),
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
        direction: z.enum(["uptown", "downtown"]).optional().describe("Filter to one direction (optional)"),
        limit: z.number().optional().describe("Max arrivals per direction (default: 5, max: 20)"),
      },
      async ({ station_slug, route_slug, direction, limit }) => {
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

        const maxArrivals = Math.min(Math.max(1, limit ?? 5), 20);
        const directions = await getArrivals(station.childStopIds, route.id, maxArrivals);
        const now = Math.floor(Date.now() / 1000);

        const result: Record<string, object[]> = {};

        if (!direction || direction === "uptown") {
          result.uptown_arrivals = directions
            .filter((d) => d.directionId === 0)
            .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now)));
        }
        if (!direction || direction === "downtown") {
          result.downtown_arrivals = directions
            .filter((d) => d.directionId === 1)
            .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now)));
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              station: station.name,
              route: route.shortName,
              ...result,
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
        direction: z.enum(["uptown", "downtown"]).optional().describe("Filter to one direction (optional)"),
        limit: z.number().optional().describe("Max arrivals per direction per route (default: 5, max: 20)"),
        routes: z.array(z.string()).optional().describe('Filter to specific route slugs, e.g. ["q", "n"] (optional)'),
      },
      async ({ station_slug, direction, limit, routes: routeFilter }) => {
        const station = getStationBySlug(station_slug);
        if (!station) {
          return {
            content: [{ type: "text" as const, text: `Station not found: "${station_slug}". Use search_subway to find the correct slug.` }],
            isError: true,
          };
        }

        let routes = getRoutesForStation(station.id);
        if (routeFilter && routeFilter.length > 0) {
          const slugSet = new Set(routeFilter.map((s) => s.toLowerCase()));
          const filtered = routes.filter((r) => slugSet.has(r.slug));
          if (filtered.length > 0) routes = filtered;
        }
        const routeIds = routes.map((r) => r.id);
        const maxArrivals = Math.min(Math.max(1, limit ?? 5), 20);
        const allArrivals = await getAllArrivalsForStation(
          station.childStopIds,
          routeIds,
          maxArrivals,
          30,
        );

        const now = Math.floor(Date.now() / 1000);
        const byRoute: Record<string, Record<string, object[]>> = {};

        for (const [routeId, dirs] of allArrivals) {
          const route = routes.find((r) => r.id === routeId);
          if (!route) continue;
          const entry: Record<string, object[]> = {};
          if (!direction || direction === "uptown") {
            entry.uptown = dirs
              .filter((d) => d.directionId === 0)
              .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now)));
          }
          if (!direction || direction === "downtown") {
            entry.downtown = dirs
              .filter((d) => d.directionId === 1)
              .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now)));
          }
          byRoute[route.shortName] = entry;
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

    // -----------------------------------------------------------------
    // plan_trip
    // -----------------------------------------------------------------
    server.tool(
      "plan_trip",
      "Plan a trip between two stations. Returns upcoming trains with departure, arrival, and travel times. Finds trips across all shared routes or a specific route. Use search_subway first to find station slugs.",
      {
        origin_slug: z.string().describe("Origin station slug"),
        destination_slug: z.string().describe("Destination station slug"),
        route_slug: z.string().optional().describe("Route slug to filter by (optional — if omitted, searches all shared routes)"),
        depart_after: z.string().optional().describe("ISO timestamp — only trips departing at or after this time (optional, default: now)"),
        limit: z.number().optional().describe("Max trips to return (default: 5, max: 20)"),
      },
      async ({ origin_slug, destination_slug, route_slug, depart_after, limit }) => {
        const origin = getStationBySlug(origin_slug);
        if (!origin) {
          return {
            content: [{ type: "text" as const, text: `Station not found: "${origin_slug}". Use search_subway to find the correct slug.` }],
            isError: true,
          };
        }

        const destination = getStationBySlug(destination_slug);
        if (!destination) {
          return {
            content: [{ type: "text" as const, text: `Station not found: "${destination_slug}". Use search_subway to find the correct slug.` }],
            isError: true,
          };
        }

        let routeIds: string[];
        if (route_slug) {
          const route = getRouteBySlug(route_slug);
          if (!route) {
            return {
              content: [{ type: "text" as const, text: `Route not found: "${route_slug}". Valid slugs: ${getRoutes().map((r) => r.slug).join(", ")}` }],
              isError: true,
            };
          }
          routeIds = [route.id];
        } else {
          const originRoutes = new Set(getRoutesForStation(origin.id).map((r) => r.id));
          const destRoutes = getRoutesForStation(destination.id).map((r) => r.id);
          routeIds = destRoutes.filter((id) => originRoutes.has(id));

          if (routeIds.length === 0) {
            return {
              content: [{ type: "text" as const, text: `No direct route between ${origin.name} and ${destination.name}. A transfer would be required.` }],
              isError: true,
            };
          }
        }

        const departAfter = depart_after ? Math.floor(new Date(depart_after).getTime() / 1000) : undefined;
        const maxTrips = Math.min(Math.max(1, limit ?? 5), 20);

        const trips = await planTrip(
          origin.childStopIds,
          destination.childStopIds,
          routeIds,
          departAfter,
          maxTrips,
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

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              origin: origin.name,
              origin_slug: origin.slug,
              destination: destination.name,
              destination_slug: destination.slug,
              trips: formattedTrips,
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
