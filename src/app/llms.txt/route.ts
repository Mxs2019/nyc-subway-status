/**
 * GET /llms.txt — Plain text API guide for LLM/AI agent discovery.
 */

export async function GET() {
  const text = `# NYC Subway Status API

> Real-time NYC subway arrival times. No authentication required.

## Quick Start

1. Search for a station: GET /api/search?q=72+st+q
2. Use the returned slug to get arrivals: GET /api/stops/72-st-n-q-r/lines/q

## Endpoints

### GET /api
Discovery endpoint. Returns JSON listing all endpoints and tips.

### GET /api/search?q={query}
Search stations and routes by name. Returns matching stations with their slugs,
route lists, and a suggested arrivals_url when both a station and route match.
Example: /api/search?q=union+square

### GET /api/stops
List all stations. Optional filter: ?route=q (lowercase route slug).
Each station includes its routes and slug for drilling down.

### GET /api/stops/{stationSlug}
Realtime arrivals for ALL routes at a station. Returns arrivals grouped
by direction (uptown/downtown) and also broken down by_route.
Example: /api/stops/14-st-union-sq

### GET /api/stops/{stationSlug}/lines/{routeSlug}
Realtime arrivals for ONE route at a station. Most precise endpoint.
Example: /api/stops/72-st-n-q-r/lines/q

### GET /api/lines
List all subway routes with station counts.

### GET /api/lines/{routeSlug}
Next arrival at every station on a route. Each station has next_uptown
and next_downtown with minutes_away, or null if no upcoming train.
Example: /api/lines/q

## Slug Examples

Station slugs: 14-st-union-sq, 72-st-n-q-r, times-sq-42-st, fulton-st
Route slugs: a, q, 7, si, gs (lowercase)

## Response Format

All JSON responses use this envelope:
{
  "ok": true,
  "data": { ... },
  "_meta": { "timestamp": "...", "endpoint": "...", "realtime": true|false }
}

Errors:
{
  "ok": false,
  "error": { "code": "...", "message": "..." },
  "_meta": { ... }
}

## MCP Server (for AI agents)

This site also runs an MCP (Model Context Protocol) server for native
AI agent integration. Connect via Streamable HTTP:

  URL: https://nyc-subway-status.com/api/mcp

Tools: search_subway, get_arrivals, get_station_arrivals, list_stations, list_routes

Claude Desktop / Cursor config:
{
  "mcpServers": {
    "nyc-subway": { "url": "https://nyc-subway-status.com/api/mcp" }
  }
}

## Tips

- Always search first (/api/search or search_subway tool) — don't guess slugs.
- minutes_away is pre-computed; no client-side math needed.
- Directions: "uptown" = northbound, "downtown" = southbound.
- All arrival times include both Unix timestamp and ISO 8601.
`;

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
