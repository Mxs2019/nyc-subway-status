# NYC Subway Status

Real-time NYC subway arrival times. SEO-first, server-rendered Next.js app.

## Framework & Versions

- **Next.js 16.1.6** (App Router) — uses React 19, Turbopack
- **TypeScript 5**
- **Tailwind CSS v4** (with `@tailwindcss/postcss`)
- **Node.js** — no specific version pinned; works with 18+

### Next.js 15/16 Caching Context

Next.js 15 changed fetch caching defaults from 14: fetches are **no longer cached by default**
(previously defaulted to `force-cache`). However, multiple caching layers still exist:

| Layer | What it does | How we disable it |
|-------|-------------|-------------------|
| **Data Cache** (server, persistent) | Caches fetch results across requests | `cache: 'no-store'` on every fetch + `fetchCache = 'force-no-store'` on page |
| **Full Route Cache** (server) | Caches rendered HTML for static routes | `dynamic = 'force-dynamic'` + `revalidate = 0` on realtime pages |
| **Router Cache** (client, in-memory) | Caches RSC payload during client navigation | **Eliminated entirely** — we use `<a>` tags, not `next/link` |
| **HMR Cache** (dev only) | Caches server component data between hot reloads | Cleared by deleting `.next` dir; config option removed in Next.js 16 |

**Our policy: zero caching on realtime data.** Every click is a full page load. We do NOT use `next/link` anywhere — all navigation is plain `<a>` tags, which completely bypasses the client Router Cache.

## Data Pipeline

### Build-time (GTFS Static)
- `scripts/build-gtfs.ts` downloads and parses MTA supplemented GTFS zip
- Generates JSON files in `src/data/gtfs/` (gitignored, rebuilt each deploy via `prebuild` script)
- Output: `stations.json` (445 stations), `routes.json` (29 routes), `stationRoutes.json`, `routeStations.json`, `meta.json`
- Stations grouped by `parent_station` from GTFS, then **merged by MTA complex ID**
- Complex groupings hardcoded in `src/data/station-complexes.ts` (35 complexes, sourced from data.ny.gov)
- Example: Union Square merges 635 (4/5/6), L03 (L), R20 (N/Q/R/W) into one station with all child stop IDs

### Request-time (GTFS-RT)
- `src/lib/gtfsrt.ts` fetches and decodes protobuf TripUpdates feeds
- 8 separate MTA feed endpoints (one per line group: default/ace/bdfm/g/jz/l/nqrw/si)
- No API key required
- All fetches use `cache: 'no-store'` — no data is ever cached
- Filters arrivals by station child stop_ids + route, groups by direction_id (N/S suffix)

### Rendering Model
- Realtime pages (`/stops/[slug]/lines/[slug]`): **server-rendered on every request** (force-dynamic). Server fetches fresh GTFS-RT data, renders complete HTML, sends to client. No client-side data fetching.
- Station/route index pages: **statically generated at build** (SSG via generateStaticParams)
- Landing, /stops, /lines: **static** (no dynamic data)

## Route Structure

```
/                                         Landing (search + nav) — static
/stops                                    Station list — static
/lines                                    Route list — static
/stops/[stationSlug]                      Station detail — SSG
/lines/[routeSlug]                        Route detail — SSG
/stops/[stationSlug]/lines/[routeSlug]    Realtime arrivals — force-dynamic, no cache
/sitemap.xml                              Auto-generated sitemap
```

## API & MCP Architecture

The REST API (`/api/*`) is the **source of truth** for all data shaping and business logic. The MCP server (`src/app/[transport]/route.ts`) must be a **thin wrapper** that calls the same underlying functions and returns data matching the API response schemas exactly. When adding features or fixing bugs:

1. Implement the change in the API layer first (route handlers + shared helpers like `api-helpers.ts`, `gtfsrt.ts`)
2. Update the MCP to pass through the same data — the MCP's `formatArrivalForMcp` should mirror `formatArrival` from `api-helpers.ts`
3. Never add logic to the MCP that doesn't exist in the API

## Key Files

- `scripts/build-gtfs.ts` — GTFS static ingestion (runs via `pnpm run prebuild`)
- `src/data/gtfs/` — Generated JSON data (gitignored)
- `src/data/station-complexes.ts` — Hardcoded MTA complex groupings (35 multi-station complexes)
- `src/lib/gtfsrt.ts` — GTFS-RT protobuf fetch + decode (8 MTA feed endpoints)
- `src/lib/gtfs.ts` — Typed helpers to load generated static JSON data (cached in memory)
- `src/lib/slugs.ts` — Station/route slug generation
- `src/hooks/use-now.ts` — Shared 10-second timer hook for relative time display
- `src/app/sitemap.ts` — Dynamic sitemap from generated data

## Components

- `RouteBullet` — Colored circle with route letter, sizes sm/md/lg
- `ArrivalTime` — Client component, ticks relative time display every 10s (data itself is server-fetched)
- `SearchFilter` — Generic client-side list filter
- `HomeSearch` — Combined station + route search for landing page
- `PageHeader` — Consistent page header with back navigation
- `StationList` / `RouteList` — Filterable lists with route bullets

## Workflow

- **Run `pnpm run build` after completing a feature** to verify the build passes before committing/pushing. Fix any type errors or build failures before proceeding.
- Do not run builds or type-checks mid-development unless you need to verify something specific.

## Conventions

- Server Components by default; `"use client"` only for search/time display
- No hardcoded station/route data — everything derived from GTFS feed (except complex groupings)
- Route colors from GTFS `route_color`/`route_text_color` (prefixed with #)
- Monochrome typography; color only for route bullets and accent borders
- Slugs: lowercase, hyphenated (e.g., `14-st-union-sq`, `a`)
- **No `next/link`** — all navigation uses plain `<a>` tags to avoid Router Cache
- Home page uses tabbed view (Stops | Lines) with shared search filter

## Environment Variables

- `GTFS_STATIC_URL` — URL to GTFS static zip (default: `gtfs_supplemented.zip`)
- `GTFS_RT_TRIPUPDATES_URLS` — Comma-separated GTFS-RT TripUpdate feed URLs (optional override)
- `GTFS_RT_ALERTS_URL` — Optional alerts feed URL
- `NEXT_PUBLIC_SITE_URL` — Site URL for metadata/sitemap (default: `https://nyc-subway-status.com`)

## MTA GTFS-RT Feed URLs (no auth)

```
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs          (1,2,3,4,5,6,7,S)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace      (A,C,E)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm     (B,D,F,M)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g        (G)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz       (J,Z)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l        (L)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw     (N,Q,R,W)
https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si       (SI)
```


<!-- issues-md: Task Tracking System -->
## Task Tracking System

Queue-based issue tracking: plan work with `/plan-issues`, execute with `/complete-next-issue`.

### Default Workflow

**IMPORTANT:** ALWAYS use the skills-based workflow by default:
1. When the user asks you to build, change, or fix something: use `/plan-issues` to create an issue first.
2. When the user asks you to implement or work through the queue: use `/complete-next-issue`.

Only skip issue creation and work directly if the user **explicitly** tells you to (e.g., "just do this directly", "don't create an issue", "skip the issue").

### Skills (Primary Interface)

#### `/plan-issues` - Plan new issues
Describe what you want to build and the agent will research, ask questions, write plan files, and update the queue. Supports dependencies between issues.

#### `/complete-next-issue` - Execute the next issue
Implements the next unblocked issue: reads the plan, writes code, runs tests, commits, and updates the queue.

### Structure
```
tasks/
├── issues/                    # Plan files (001-feature-name.md)
├── issues-to-complete.json    # Pending issues queue
└── completed-issues.json      # Completed issues log
```

### CLI Commands (Manual Use)
```bash
issues list [--status <status>] [--json]   # List issues
issues new --name <slug> [--blocked-by <id>]  # Create issue
issues <id> started|complete|reset         # Change status
issues monitor                             # Launch TUI
```

### JSON Format
```json
{
  "next_id": 3,
  "issues": [
    { "id": "001", "name": "feature-name", "blocked_by": null, "status": "pending", "created_at": "2025-01-01T00:00:00.000Z" },
    { "id": "002", "name": "another-feature", "blocked_by": "001", "status": "pending", "created_at": "2025-01-01T00:00:00.000Z" }
  ]
}
```
<!-- /issues-md -->
