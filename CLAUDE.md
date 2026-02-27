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
| **Router Cache** (client, in-memory) | Caches RSC payload during client navigation | `staleTimes: { dynamic: 0, static: 0 }` in next.config.ts |
| **HMR Cache** (dev only) | Caches server component data between hot reloads | `serverComponentsHmrCache: false` in next.config.ts |

**Our policy: zero caching on realtime data.** Every page load hits the MTA feed fresh.

## Data Pipeline

### Build-time (GTFS Static)
- `scripts/build-gtfs.ts` downloads and parses MTA supplemented GTFS zip
- Generates JSON files in `src/data/gtfs/` (gitignored, rebuilt each deploy via `prebuild` script)
- Output: `stations.json` (496 stations), `routes.json` (29 routes), `stationRoutes.json`, `routeStations.json`, `meta.json`
- Stations grouped by `parent_station` from GTFS; duplicate slugs get station ID suffix

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

## Key Files

- `scripts/build-gtfs.ts` — GTFS static ingestion (runs via `npm run prebuild`)
- `src/data/gtfs/` — Generated JSON data (gitignored)
- `src/lib/gtfsrt.ts` — GTFS-RT protobuf fetch + decode (8 MTA feed endpoints)
- `src/lib/gtfs.ts` — Typed helpers to load generated static JSON data (cached in memory)
- `src/lib/slugs.ts` — Station/route slug generation
- `src/app/sitemap.ts` — Dynamic sitemap from generated data
- `next.config.ts` — Caching disabled: serverComponentsHmrCache, staleTimes

## Components

- `RouteBullet` — Colored circle with route letter, sizes sm/md/lg
- `ArrivalTime` — Client component, ticks relative time display every 10s (data itself is server-fetched)
- `SearchFilter` — Generic client-side list filter
- `HomeSearch` — Combined station + route search for landing page
- `PageHeader` — Consistent page header with back navigation
- `StationList` / `RouteList` — Filterable lists with route bullets

## Conventions

- Server Components by default; `"use client"` only for search/time display
- No hardcoded station/route data — everything derived from GTFS feed
- Route colors from GTFS `route_color`/`route_text_color` (prefixed with #)
- Monochrome typography; color only for route bullets and accent borders
- Slugs: lowercase, hyphenated (e.g., `14-st-union-sq-635`, `a`)
- Station complexes with same name get ID suffix in slug (e.g., `-635`, `-l03`, `-r20`)

## Environment Variables

- `GTFS_STATIC_URL` — URL to GTFS static zip (default: `gtfs_supplemented.zip`)
- `GTFS_RT_TRIPUPDATES_URLS` — Comma-separated GTFS-RT TripUpdate feed URLs (optional override)
- `GTFS_RT_ALERTS_URL` — Optional alerts feed URL
- `NEXT_PUBLIC_SITE_URL` — Site URL for metadata/sitemap (default: `https://nycsubwaystatus.com`)

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
