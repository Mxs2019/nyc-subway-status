/**
 * MCP Server — Next.js App Router route handler.
 *
 * Uses @modelcontextprotocol/sdk + @modelcontextprotocol/ext-apps to expose
 * NYC subway data as tools for AI agents, with structured content for app UIs.
 *
 * Tools:
 *   search_subway        — Search stations/routes by name
 *   get_arrivals         — Realtime arrivals for a route at a station
 *   get_station_arrivals — Realtime arrivals for ALL routes at a station
 *   list_stations        — List all stations (optionally filtered by route)
 *   list_routes          — List all subway routes
 *   get_trip             — Track a specific train by trip ID
 *   plan_trip            — Plan a trip between two stations
 *   refresh_arrivals     — App-only: refresh arrivals without model involvement
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Widget HTML — read from build output (built by scripts/build-widget.ts)
// ---------------------------------------------------------------------------

let _widgetHtml: string | null = null;
function getWidgetHtml(): string {
  if (_widgetHtml !== null) return _widgetHtml;
  try {
    const widgetPath = path.join(
      process.cwd(),
      "src",
      "widget",
      "dist",
      "widget.html",
    );
    _widgetHtml = fs.readFileSync(widgetPath, "utf-8");
  } catch {
    _widgetHtml = "";
  }
  return _widgetHtml;
}

// ---------------------------------------------------------------------------
// Shared helper — format a single arrival for MCP responses
// ---------------------------------------------------------------------------

function formatArrivalForMcp(
  a: { arrivalTime: number; routeId: string; tripId: string; headsign: string },
  now: number,
) {
  return {
    route_id: a.routeId,
    trip_id: a.tripId,
    headsign: a.headsign,
    minutes_away: Math.max(0, Math.round((a.arrivalTime - now) / 60)),
    arrival_time_iso: new Date(a.arrivalTime * 1000).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Create and configure the MCP server with all tools + resources
// ---------------------------------------------------------------------------

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "nyc-subway-status",
    version: "1.0.0",
  });

  // -----------------------------------------------------------------
  // Widget resource
  // -----------------------------------------------------------------
  registerAppResource(
    server,
    "widget",
    "ui://nyc-subway/widget.html",
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: "ui://nyc-subway/widget.html",
          mimeType: RESOURCE_MIME_TYPE,
          text: getWidgetHtml(),
          _meta: {
            ui: {
              csp: {
                connectDomains: ["https://nyc-subway-status.com"],
              },
              domain: "https://nyc-subway-status.com",
            },
          },
        },
      ],
    }),
  );

  // -----------------------------------------------------------------
  // search_subway
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "search_subway",
    {
      title: "Search Subway",
      description:
        'Search for subway stations or routes by name. Use this first when you don\'t know the exact station or route slug. Returns slugs needed for other tools.',
      inputSchema: {
        query: z
          .string()
          .describe('Search query, e.g. "union square", "72 st", "Q train"'),
      },
      _meta: { ui: { resourceUri: "ui://nyc-subway/widget.html" } },
    },
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
          routes: routes.map((rName) => {
            const r = getRoutes().find((rt) => rt.shortName === rName);
            return r
              ? {
                  name: r.shortName,
                  color: `#${r.color}`,
                  text_color: `#${r.textColor}`,
                }
              : null;
          }).filter(Boolean),
          ...(matched_routes.length > 0 ? { matched_routes } : {}),
        };
      });

      const routes = results.routes.map((r) => {
        const route = getRouteBySlug(r.slug);
        return {
          name: r.shortName,
          long_name: r.longName,
          slug: r.slug,
          color: route ? `#${route.color}` : "#999",
          text_color: route ? `#${route.textColor}` : "#fff",
        };
      });

      // Build suggested_call if we matched both a station and a route that serves it
      let suggested_call: object | undefined;
      if (stations.length > 0 && routes.length > 0) {
        const topStation = stations[0];
        const topRoute = routes[0];
        const routeIds = stationRouteMap[results.stations[0].id] || [];
        if (routeIds.includes(results.routes[0].id)) {
          suggested_call = {
            tool: "get_arrivals",
            params: {
              station_slug: topStation.slug,
              route_slug: topRoute.slug,
            },
          };
        }
      }

      const data = {
        stations,
        routes,
        ...(suggested_call ? { suggested_call } : {}),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
        structuredContent: {
          view: "search",
          ...data,
        },
      };
    },
  );

  // -----------------------------------------------------------------
  // get_arrivals (shared logic, used by both get_arrivals and refresh_arrivals)
  // -----------------------------------------------------------------
  async function handleGetArrivals({
    station_slug,
    route_slug,
    direction,
    limit,
  }: {
    station_slug: string;
    route_slug: string;
    direction?: "uptown" | "downtown";
    limit?: number;
  }) {
    const station = getStationBySlug(station_slug);
    if (!station) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Station not found: "${station_slug}". Use search_subway to find the correct slug.`,
          },
        ],
        isError: true,
      };
    }

    const route = getRouteBySlug(route_slug);
    if (!route) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Route not found: "${route_slug}". Valid slugs: ${getRoutes().map((r) => r.slug).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    const maxArrivals = Math.min(Math.max(1, limit ?? 5), 20);
    const directions = await getArrivals(
      station.childStopIds,
      route.id,
      maxArrivals,
    );
    const now = Math.floor(Date.now() / 1000);

    const uptownArr: ReturnType<typeof formatArrivalForMcp>[] = [];
    const downtownArr: ReturnType<typeof formatArrivalForMcp>[] = [];

    if (!direction || direction === "uptown") {
      uptownArr.push(
        ...directions
          .filter((d) => d.directionId === 0)
          .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now))),
      );
    }
    if (!direction || direction === "downtown") {
      downtownArr.push(
        ...directions
          .filter((d) => d.directionId === 1)
          .flatMap((d) => d.arrivals.map((a) => formatArrivalForMcp(a, now))),
      );
    }

    const textData: Record<string, unknown> = {
      station: station.name,
      route: route.shortName,
      fetched_at: new Date().toISOString(),
    };
    if (!direction || direction === "uptown")
      textData.uptown_arrivals = uptownArr;
    if (!direction || direction === "downtown")
      textData.downtown_arrivals = downtownArr;

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(textData, null, 2) },
      ],
      structuredContent: {
        view: "arrivals" as const,
        station: station.name,
        route: {
          name: route.shortName,
          color: `#${route.color}`,
          text_color: `#${route.textColor}`,
        },
        uptown_arrivals: uptownArr.map((a) => ({
          headsign: a.headsign,
          minutes_away: a.minutes_away,
          trip_id: a.trip_id,
        })),
        downtown_arrivals: downtownArr.map((a) => ({
          headsign: a.headsign,
          minutes_away: a.minutes_away,
          trip_id: a.trip_id,
        })),
      },
    };
  }

  const arrivalsInputSchema = {
    station_slug: z
      .string()
      .describe('Station slug from search_subway, e.g. "72-st-n-q-r"'),
    route_slug: z
      .string()
      .describe('Route slug (lowercase), e.g. "q", "a", "7"'),
    direction: z
      .enum(["uptown", "downtown"])
      .optional()
      .describe("Filter to one direction (optional)"),
    limit: z
      .number()
      .optional()
      .describe("Max arrivals per direction (default: 5, max: 20)"),
  };

  registerAppTool(
    server,
    "get_arrivals",
    {
      title: "Get Arrivals",
      description:
        "Get real-time arrival times for a specific route at a specific station. Returns upcoming trains in both directions with minutes_away. Use search_subway first to find slugs.",
      inputSchema: arrivalsInputSchema,
      _meta: { ui: { resourceUri: "ui://nyc-subway/widget.html" } },
    },
    handleGetArrivals,
  );

  // -----------------------------------------------------------------
  // refresh_arrivals — app-only tool for widget refresh
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "refresh_arrivals",
    {
      title: "Refresh Arrivals",
      description:
        "Refresh real-time arrival data. Same as get_arrivals but designed for app widget auto-refresh without model involvement.",
      inputSchema: arrivalsInputSchema,
      _meta: {
        ui: {
          resourceUri: "ui://nyc-subway/widget.html",
          visibility: ["app"],
        },
      },
    },
    handleGetArrivals,
  );

  // -----------------------------------------------------------------
  // get_station_arrivals
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "get_station_arrivals",
    {
      title: "Get Station Arrivals",
      description:
        "Get real-time arrivals for ALL routes at a station. Returns arrivals grouped by route and direction. Use when the user asks about a station without specifying a line.",
      inputSchema: {
        station_slug: z
          .string()
          .describe("Station slug from search_subway"),
        direction: z
          .enum(["uptown", "downtown"])
          .optional()
          .describe("Filter to one direction (optional)"),
        limit: z
          .number()
          .optional()
          .describe(
            "Max arrivals per direction per route (default: 5, max: 20)",
          ),
        routes: z
          .array(z.string())
          .optional()
          .describe(
            'Filter to specific route slugs, e.g. ["q", "n"] (optional)',
          ),
      },
      _meta: { ui: { resourceUri: "ui://nyc-subway/widget.html" } },
    },
    async ({ station_slug, direction, limit, routes: routeFilter }) => {
      const station = getStationBySlug(station_slug);
      if (!station) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Station not found: "${station_slug}". Use search_subway to find the correct slug.`,
            },
          ],
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
            .flatMap((d) =>
              d.arrivals.map((a) => formatArrivalForMcp(a, now)),
            );
        }
        if (!direction || direction === "downtown") {
          entry.downtown = dirs
            .filter((d) => d.directionId === 1)
            .flatMap((d) =>
              d.arrivals.map((a) => formatArrivalForMcp(a, now)),
            );
        }
        byRoute[route.shortName] = entry;
      }

      const textData = {
        station: station.name,
        routes_served: routes.map((r) => r.shortName),
        arrivals_by_route: byRoute,
        fetched_at: new Date().toISOString(),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(textData, null, 2) },
        ],
        structuredContent: {
          view: "station",
          station: station.name,
          routes: Object.entries(byRoute).map(([routeName, dirs]) => {
            const r = getRoutes().find((rt) => rt.shortName === routeName);
            return {
              name: routeName,
              color: r ? `#${r.color}` : "#999",
              text_color: r ? `#${r.textColor}` : "#fff",
              uptown: dirs.uptown || [],
              downtown: dirs.downtown || [],
            };
          }),
        },
      };
    },
  );

  // -----------------------------------------------------------------
  // list_stations — text only, no widget view
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "list_stations",
    {
      title: "List Stations",
      description:
        "List all NYC subway stations, optionally filtered by route. Returns station names and slugs.",
      inputSchema: {
        route_slug: z
          .string()
          .optional()
          .describe(
            'Filter to stations on this route, e.g. "q" (optional)',
          ),
      },
    },
    async ({ route_slug }) => {
      let stations = getStations();

      if (route_slug) {
        const route = getRouteBySlug(route_slug);
        if (!route) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Route not found: "${route_slug}".`,
              },
            ],
            isError: true,
          };
        }
        stations = getStationsForRoute(route.id);
      }

      const data = stations.map((s) => ({ name: s.name, slug: s.slug }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // -----------------------------------------------------------------
  // list_routes — text only, no widget view
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "list_routes",
    {
      title: "List Routes",
      description:
        "List all NYC subway routes/lines. Returns route names, slugs, and colors.",
      inputSchema: {},
    },
    async () => {
      const routes = getRoutes();
      const data = routes.map((r) => ({
        name: r.shortName,
        long_name: r.longName,
        slug: r.slug,
        color: r.color,
      }));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(data, null, 2) },
        ],
      };
    },
  );

  // -----------------------------------------------------------------
  // get_trip
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "get_trip",
    {
      title: "Get Trip",
      description:
        "Track a specific train by trip ID. Returns every upcoming stop with arrival times. Use get_arrivals first to find trip IDs.",
      inputSchema: {
        trip_id: z.string().describe("Trip ID from get_arrivals response"),
        route_slug: z
          .string()
          .describe("Route slug (lowercase), e.g. 'q'"),
      },
      _meta: { ui: { resourceUri: "ui://nyc-subway/widget.html" } },
    },
    async ({ trip_id, route_slug }) => {
      const route = getRouteBySlug(route_slug);
      if (!route) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Route not found: "${route_slug}". Valid slugs: ${getRoutes().map((r) => r.slug).join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const trip = await getTripById(route.id, trip_id);
      if (!trip) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No active trip found for ID "${trip_id}" on route ${route.shortName}. The train may have completed its run.`,
            },
          ],
          isError: true,
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const stops = trip.stopTimes.map((st) => {
        const stationObj = getStationByChildStopId(st.stopId);
        const time = st.arrivalTime ?? st.departureTime;
        const minutesAway =
          time != null ? Math.max(0, Math.round((time - now) / 60)) : null;
        const status = time != null && time <= now ? "passed" : "upcoming";

        return {
          station: stationObj ? stationObj.name : st.stopId,
          station_slug: stationObj?.slug ?? null,
          arrival_time_iso: st.arrivalTime
            ? new Date(st.arrivalTime * 1000).toISOString()
            : null,
          minutes_away: minutesAway,
          status,
        };
      });

      const textData = {
        trip_id: trip.tripId,
        route: route.shortName,
        direction: trip.directionId === 0 ? "uptown" : "downtown",
        stops,
        fetched_at: new Date().toISOString(),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(textData, null, 2) },
        ],
        structuredContent: {
          view: "trip",
          trip_id: trip.tripId,
          route: {
            name: route.shortName,
            color: `#${route.color}`,
            text_color: `#${route.textColor}`,
          },
          direction: trip.directionId === 0 ? "uptown" : "downtown",
          stops: stops.map((s) => ({
            station: s.station,
            minutes_away: s.minutes_away,
            status: s.status,
          })),
        },
      };
    },
  );

  // -----------------------------------------------------------------
  // plan_trip
  // -----------------------------------------------------------------
  registerAppTool(
    server,
    "plan_trip",
    {
      title: "Plan Trip",
      description:
        "Plan a trip between two stations. Returns upcoming trains with departure, arrival, and travel times. Finds trips across all shared routes or a specific route. Use search_subway first to find station slugs.",
      inputSchema: {
        origin_slug: z.string().describe("Origin station slug"),
        destination_slug: z.string().describe("Destination station slug"),
        route_slug: z
          .string()
          .optional()
          .describe(
            "Route slug to filter by (optional -- if omitted, searches all shared routes)",
          ),
        depart_after: z
          .string()
          .optional()
          .describe(
            "ISO timestamp -- only trips departing at or after this time (optional, default: now)",
          ),
        limit: z
          .number()
          .optional()
          .describe("Max trips to return (default: 5, max: 20)"),
      },
      _meta: { ui: { resourceUri: "ui://nyc-subway/widget.html" } },
    },
    async ({ origin_slug, destination_slug, route_slug, depart_after, limit }) => {
      const origin = getStationBySlug(origin_slug);
      if (!origin) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Station not found: "${origin_slug}". Use search_subway to find the correct slug.`,
            },
          ],
          isError: true,
        };
      }

      const destination = getStationBySlug(destination_slug);
      if (!destination) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Station not found: "${destination_slug}". Use search_subway to find the correct slug.`,
            },
          ],
          isError: true,
        };
      }

      let routeIds: string[];
      if (route_slug) {
        const route = getRouteBySlug(route_slug);
        if (!route) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Route not found: "${route_slug}". Valid slugs: ${getRoutes().map((r) => r.slug).join(", ")}`,
              },
            ],
            isError: true,
          };
        }
        routeIds = [route.id];
      } else {
        const originRoutes = new Set(
          getRoutesForStation(origin.id).map((r) => r.id),
        );
        const destRoutes = getRoutesForStation(destination.id).map(
          (r) => r.id,
        );
        routeIds = destRoutes.filter((id) => originRoutes.has(id));

        if (routeIds.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No direct route between ${origin.name} and ${destination.name}. A transfer would be required.`,
              },
            ],
            isError: true,
          };
        }
      }

      const departAfter = depart_after
        ? Math.floor(new Date(depart_after).getTime() / 1000)
        : undefined;
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
          depart_origin_minutes: Math.max(
            0,
            Math.round((t.departOriginTime - now) / 60),
          ),
          arrive_destination_iso: new Date(
            t.arriveDestinationTime * 1000,
          ).toISOString(),
          arrive_destination_minutes: Math.max(
            0,
            Math.round((t.arriveDestinationTime - now) / 60),
          ),
          travel_time_minutes: Math.round(
            (t.arriveDestinationTime - t.departOriginTime) / 60,
          ),
          num_stops: t.numStops,
        };
      });

      const textData = {
        origin: origin.name,
        origin_slug: origin.slug,
        destination: destination.name,
        destination_slug: destination.slug,
        trips: formattedTrips,
        fetched_at: new Date().toISOString(),
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(textData, null, 2) },
        ],
        structuredContent: {
          view: "planner",
          origin: origin.name,
          destination: destination.name,
          trips: formattedTrips.map((t) => {
            const r = getRoutes().find((rt) => rt.shortName === t.route);
            return {
              route: {
                name: t.route,
                color: r ? `#${r.color}` : "#999",
                text_color: r ? `#${r.textColor}` : "#fff",
              },
              depart_minutes: t.depart_origin_minutes,
              arrive_minutes: t.arrive_destination_minutes,
              travel_minutes: t.travel_time_minutes,
              num_stops: t.num_stops,
            };
          }),
        },
      };
    },
  );

  return server;
}

// ---------------------------------------------------------------------------
// Node.js adapter helpers — bridge Web Request/Response to Node http types
// ---------------------------------------------------------------------------

function toNodeRequest(webReq: Request): IncomingMessage {
  const mockSocket = new Duplex({
    read() {},
    write(_chunk, _encoding, cb) {
      cb();
    },
  });
  const nodeReq = new IncomingMessage(mockSocket as never);
  nodeReq.method = webReq.method;
  nodeReq.url = "/mcp";
  webReq.headers.forEach((v, k) => {
    nodeReq.headers[k] = v;
  });
  return nodeReq;
}

function captureResponse(): {
  res: ServerResponse;
  promise: Promise<Response>;
} {
  const mockSocket = new Duplex({
    read() {},
    write(_chunk, _encoding, cb) {
      cb();
    },
  });
  const fakeReq = new IncomingMessage(mockSocket as never);
  const res = new ServerResponse(fakeReq);

  let statusCode = 200;
  const headers: Record<string, string> = {};
  const chunks: Uint8Array[] = [];

  const promise = new Promise<Response>((resolve) => {
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = function (code: number, ...args: unknown[]) {
      statusCode = code;
      // writeHead can be called as (code, headers) or (code, statusMessage, headers)
      const hdrs = args.length === 1 ? args[0] : args[1];
      if (hdrs && typeof hdrs === "object" && !Array.isArray(hdrs)) {
        for (const [k, v] of Object.entries(
          hdrs as Record<string, string>,
        )) {
          if (typeof v === "string") headers[k] = v;
        }
      }
      return origWriteHead(code, ...(args as [Record<string, string>]));
    } as typeof res.writeHead;

    res.write = function (chunk: unknown) {
      if (chunk) {
        chunks.push(
          typeof chunk === "string"
            ? new TextEncoder().encode(chunk)
            : (chunk as Uint8Array),
        );
      }
      return true;
    } as typeof res.write;

    res.end = function (chunk?: unknown) {
      if (chunk) {
        chunks.push(
          typeof chunk === "string"
            ? new TextEncoder().encode(chunk)
            : (chunk as Uint8Array),
        );
      }
      const body = new Blob(chunks);
      resolve(new Response(body, { status: statusCode, headers }));
      return this;
    } as typeof res.end;
  });

  return { res, promise };
}

// ---------------------------------------------------------------------------
// Next.js App Router HTTP handlers
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  const nodeReq = toNodeRequest(request);
  const { res, promise } = captureResponse();

  await transport.handleRequest(nodeReq, res, body);

  return promise;
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ error: "Method not allowed. Use POST for MCP requests." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(): Promise<Response> {
  return new Response(JSON.stringify({ error: "Method not allowed. This server runs in stateless mode." }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
