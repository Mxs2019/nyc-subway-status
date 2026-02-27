# NYC Subway Status

Real-time NYC subway arrival times. SEO-first, server-rendered Next.js app.

## Architecture

- **Framework**: Next.js 16 App Router, TypeScript, Tailwind CSS v4
- **Data**: MTA GTFS Static (build-time) + GTFS-RT TripUpdates (request-time)
- **Deployment**: Vercel
- **Font**: Geist Mono (monospace throughout for "plain text sports" aesthetic)

## Data Pipeline

### Build-time (GTFS Static)
- `scripts/build-gtfs.ts` downloads and parses MTA supplemented GTFS zip
- Generates JSON files in `src/data/gtfs/` (gitignored, rebuilt each deploy via `prebuild` script)
- Output: `stations.json` (496 stations), `routes.json` (29 routes), `stationRoutes.json`, `routeStations.json`, `meta.json`
- Stations grouped by `parent_station` from GTFS; duplicate slugs get station ID suffix

### Request-time (GTFS-RT)
- `src/lib/gtfsrt.ts` fetches and decodes protobuf TripUpdates feeds
- 8 separate MTA feed endpoints (one per line group: default/ace/bdfm/g/jz/l/nqrw/si)
- No API key required; no caching initially
- Filters arrivals by station child stop_ids + route, groups by direction_id (N/S suffix)

## Route Structure

```
/                                         Landing (search + nav) — static
/stops                                    Station list — static
/lines                                    Route list — static
/stops/[stationSlug]                      Station detail — SSG
/lines/[routeSlug]                        Route detail — SSG
/stops/[stationSlug]/lines/[routeSlug]    Realtime arrivals — dynamic (force-dynamic)
/sitemap.xml                              Auto-generated sitemap
```

## Key Files

- `scripts/build-gtfs.ts` — GTFS static ingestion (runs via `npm run prebuild`)
- `src/data/gtfs/` — Generated JSON data (gitignored)
- `src/lib/gtfsrt.ts` — GTFS-RT protobuf fetch + decode (8 MTA feed endpoints)
- `src/lib/gtfs.ts` — Typed helpers to load generated static JSON data (cached in memory)
- `src/lib/slugs.ts` — Station/route slug generation
- `src/app/sitemap.ts` — Dynamic sitemap from generated data

## Components

- `RouteBullet` — Colored circle with route letter, sizes sm/md/lg
- `ArrivalTime` — Client component, auto-updates relative time every 10s
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
