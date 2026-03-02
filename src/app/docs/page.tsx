import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Docs",
  description:
    "Public REST API and MCP server documentation for NYC Subway Status. Real-time arrival times for AI agents and developers — no authentication required.",
};

export default function DocsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <a
        href="/"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        &larr; Home
      </a>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">API Docs</h1>
      <p className="mt-2 text-muted text-xs leading-relaxed">
        Real-time NYC subway arrival times. No authentication required.
      </p>

      {/* Quick Start */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Quick Start</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted list-decimal list-inside">
          <li>
            Search for a station:{" "}
            <code className="text-foreground">
              GET /api/search?q=72+st+q
            </code>
          </li>
          <li>
            Get arrivals using the returned slug:{" "}
            <code className="text-foreground">
              GET /api/stops/72-st-n-q-r/lines/q
            </code>
          </li>
        </ol>
      </section>

      {/* REST Endpoints */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">REST Endpoints</h2>
        <div className="mt-4 space-y-6">
          <Endpoint
            method="GET"
            path="/api"
            description="Discovery endpoint. Lists all available endpoints and tips."
          />
          <Endpoint
            method="GET"
            path="/api/search?q={query}"
            description="Search stations and routes by name. Returns matching stations with slugs, route lists, and a suggested arrivals URL when both a station and route match."
            params={[["q", "Search query (required)"]]}
            example="/api/search?q=union+square"
          />
          <Endpoint
            method="GET"
            path="/api/stops"
            description="List all stations, optionally filtered by route."
            params={[["route", "Filter by route slug, e.g. q (optional)"]]}
          />
          <Endpoint
            method="GET"
            path="/api/stops/{stationSlug}"
            description="Realtime arrivals for all routes at a station. Returns uptown/downtown arrivals and a per-route breakdown."
            example="/api/stops/14-st-union-sq"
            realtime
          />
          <Endpoint
            method="GET"
            path="/api/stops/{stationSlug}/lines/{routeSlug}"
            description="Realtime arrivals for a specific route at a station. The most precise endpoint."
            example="/api/stops/72-st-n-q-r/lines/q"
            realtime
          />
          <Endpoint
            method="GET"
            path="/api/lines"
            description="List all subway routes with station counts and colors."
          />
          <Endpoint
            method="GET"
            path="/api/lines/{routeSlug}"
            description="Next arrival at every station on a route. Each station includes next_uptown and next_downtown with minutes_away."
            example="/api/lines/q"
            realtime
          />
        </div>
      </section>

      {/* Response Format */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Response Format</h2>
        <p className="mt-2 text-sm text-muted">
          All JSON responses use this envelope:
        </p>
        <pre className="mt-3 p-3 text-xs bg-[var(--background)] border border-border rounded overflow-x-auto">
{`{
  "ok": true,
  "data": { ... },
  "_meta": {
    "timestamp": "2025-01-01T00:00:00.000Z",
    "endpoint": "/api/...",
    "realtime": true
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-muted">Errors return:</p>
        <pre className="mt-3 p-3 text-xs bg-[var(--background)] border border-border rounded overflow-x-auto">
{`{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "..." },
  "_meta": { ... }
}`}
        </pre>
      </section>

      {/* Slugs */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Slugs</h2>
        <p className="mt-2 text-sm text-muted">
          Use <code className="text-foreground">/api/search</code> to find
          slugs — don&apos;t guess them.
        </p>
        <div className="mt-3 text-sm text-muted space-y-1">
          <p>
            <span className="text-foreground font-semibold">Stations:</span>{" "}
            14-st-union-sq, 72-st-n-q-r, times-sq-42-st, fulton-st
          </p>
          <p>
            <span className="text-foreground font-semibold">Routes:</span>{" "}
            a, q, 7, si, gs (always lowercase)
          </p>
        </div>
      </section>

      {/* MCP Server */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">MCP Server</h2>
        <p className="mt-2 text-sm text-muted">
          For AI agents that support the{" "}
          <a href="https://modelcontextprotocol.io" className="text-foreground">
            Model Context Protocol
          </a>
          , connect directly via Streamable HTTP:
        </p>
        <pre className="mt-3 p-3 text-xs bg-[var(--background)] border border-border rounded overflow-x-auto">
{`POST https://nyc-subway-status.com/api/mcp`}
        </pre>

        <h3 className="mt-5 font-semibold text-sm">Tools</h3>
        <div className="mt-2 space-y-3">
          <Tool
            name="search_subway"
            description="Search stations and routes by name. Start here."
            input='{ "query": "72 st q" }'
          />
          <Tool
            name="get_arrivals"
            description="Realtime arrivals for a route at a station."
            input='{ "station_slug": "72-st-n-q-r", "route_slug": "q" }'
          />
          <Tool
            name="get_station_arrivals"
            description="Realtime arrivals for all routes at a station."
            input='{ "station_slug": "14-st-union-sq" }'
          />
          <Tool
            name="list_stations"
            description="List all stations. Optional route filter."
            input='{ "route_slug": "q" }'
          />
          <Tool
            name="list_routes"
            description="List all 29 subway routes."
            input="{}"
          />
        </div>

        <h3 className="mt-5 font-semibold text-sm">Client Configuration</h3>
        <p className="mt-2 text-sm text-muted">
          Claude Desktop, Cursor, Windsurf, and other MCP-compatible clients:
        </p>
        <pre className="mt-3 p-3 text-xs bg-[var(--background)] border border-border rounded overflow-x-auto">
{`{
  "mcpServers": {
    "nyc-subway": {
      "url": "https://nyc-subway-status.com/api/mcp"
    }
  }
}`}
        </pre>
        <p className="mt-3 text-sm text-muted">
          For stdio-only clients, use the{" "}
          <code className="text-foreground">mcp-remote</code> bridge:
        </p>
        <pre className="mt-3 p-3 text-xs bg-[var(--background)] border border-border rounded overflow-x-auto">
{`{
  "mcpServers": {
    "nyc-subway": {
      "command": "npx",
      "args": ["-y", "mcp-remote",
        "https://nyc-subway-status.com/api/mcp"]
    }
  }
}`}
        </pre>
      </section>

      {/* Tips */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Tips</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted list-disc list-inside">
          <li>
            Always search first — don&apos;t guess station slugs.
          </li>
          <li>
            <code className="text-foreground">minutes_away</code> is
            pre-computed server-side. No client math needed.
          </li>
          <li>
            Directions: <strong className="text-foreground">uptown</strong> =
            northbound, <strong className="text-foreground">downtown</strong> =
            southbound.
          </li>
          <li>
            Arrival times include both a Unix timestamp and an ISO 8601 string.
          </li>
          <li>
            Realtime endpoints fetch fresh data from the MTA on every request —
            nothing is cached.
          </li>
        </ul>
      </section>

      {/* Machine-readable */}
      <section className="mt-10 pb-4">
        <h2 className="text-lg font-semibold">Machine-Readable</h2>
        <div className="mt-3 space-y-1 text-sm">
          <p>
            <a href="/llms.txt" className="text-foreground">
              /llms.txt
            </a>{" "}
            <span className="text-muted">
              — Plain text API guide for LLMs
            </span>
          </p>
          <p>
            <a href="/api" className="text-foreground">
              /api
            </a>{" "}
            <span className="text-muted">
              — JSON discovery endpoint
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}

function Endpoint({
  method,
  path,
  description,
  params,
  example,
  realtime,
}: {
  method: string;
  path: string;
  description: string;
  params?: [string, string][];
  example?: string;
  realtime?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold text-muted">{method}</span>
        <code className="text-sm font-semibold">{path}</code>
        {realtime && (
          <span className="text-[10px] text-muted border border-border rounded px-1">
            realtime
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {params && (
        <div className="mt-1 text-xs text-muted">
          {params.map(([name, desc]) => (
            <p key={name}>
              <code className="text-foreground">{name}</code> — {desc}
            </p>
          ))}
        </div>
      )}
      {example && (
        <p className="mt-1 text-xs text-muted">
          Example:{" "}
          <a href={example} className="text-foreground">
            {example}
          </a>
        </p>
      )}
    </div>
  );
}

function Tool({
  name,
  description,
  input,
}: {
  name: string;
  description: string;
  input: string;
}) {
  return (
    <div>
      <code className="text-sm font-semibold">{name}</code>
      <p className="mt-0.5 text-xs text-muted">{description}</p>
      <p className="mt-0.5 text-xs text-muted">
        Input: <code className="text-foreground">{input}</code>
      </p>
    </div>
  );
}
