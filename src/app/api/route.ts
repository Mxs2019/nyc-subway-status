/**
 * GET /api — Discovery endpoint describing all available API endpoints.
 */

import { apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  return apiSuccess(
    {
      name: "NYC Subway Status API",
      description:
        "Real-time NYC subway arrival times. No authentication required.",
      endpoints: {
        discovery: {
          url: "/api",
          description: "This endpoint. Lists all available API endpoints.",
        },
        llms_txt: {
          url: "/llms.txt",
          description:
            "Plain text API guide optimized for LLM/AI agent consumption.",
        },
        search: {
          url: "/api/search?q={query}",
          description:
            "Search stations and routes by name. Returns slugs and suggested next calls. Start here if you don't know the station slug.",
          params: { q: "Search query (required)" },
        },
        stops: {
          url: "/api/stops",
          description: "List all stations, optionally filtered by route.",
          params: { route: "Filter by route slug (optional, e.g. 'q')" },
        },
        stop_detail: {
          url: "/api/stops/{stationSlug}",
          description:
            "Realtime arrivals for all routes at a station. Returns uptown/downtown arrivals grouped by route.",
          example: "/api/stops/72-st-n-q-r",
        },
        stop_line_arrivals: {
          url: "/api/stops/{stationSlug}/lines/{routeSlug}",
          description:
            "Realtime arrivals for a specific route at a station. Most precise endpoint.",
          example: "/api/stops/72-st-n-q-r/lines/q",
        },
        lines: {
          url: "/api/lines",
          description: "List all subway routes with station counts.",
        },
        line_detail: {
          url: "/api/lines/{routeSlug}",
          description:
            "Next arrival at every station on a route. Includes minutes_away.",
          example: "/api/lines/q",
        },
        trip_detail: {
          url: "/api/trips/{tripId}?route={routeSlug}",
          description:
            "Track a specific train by trip ID. Returns every stop with arrival times and station names. Get trip IDs from any arrivals endpoint.",
          params: {
            route: "Route slug (required, e.g. 'q')",
          },
          example: "/api/trips/051800_Q..N03R?route=q",
        },
        trip_plan: {
          url: "/api/trips/plan?origin={stationSlug}&destination={stationSlug}",
          description:
            "Plan a trip between two stations. Returns upcoming trains with departure, arrival, and travel times.",
          params: {
            origin: "Origin station slug (required)",
            destination: "Destination station slug (required)",
            route: "Route slug filter (optional)",
            depart_after: "ISO timestamp — only trips departing at/after this time (optional)",
            limit: "Max trips to return (optional, default: 5, max: 20)",
          },
          example: "/api/trips/plan?origin=14-st-union-sq&destination=72-st-n-q-r&route=q",
        },
        mcp_server: {
          url: "/mcp",
          description:
            "MCP (Model Context Protocol) server for native AI agent integration. POST JSON-RPC to this endpoint.",
          tools: [
            "search_subway",
            "get_arrivals",
            "get_station_arrivals",
            "list_stations",
            "list_routes",
            "get_trip",
            "plan_trip",
          ],
        },
      },
      tips: [
        "Use /api/search first to find station slugs — no need to memorize them.",
        "All realtime endpoints return minutes_away computed server-side.",
        "Arrival times are Unix timestamps (seconds). ISO 8601 strings also included.",
        "Directions are 'uptown' (northbound) and 'downtown' (southbound).",
        "Route slugs are lowercase route letters/numbers: 'a', 'q', '7', 'si'.",
      ],
    },
    "/api",
  );
}
