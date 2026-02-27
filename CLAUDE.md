# NYC Subway Status

Real-time NYC subway arrival times. SEO-first, server-rendered Next.js app.

## Architecture

- **Framework**: Next.js 16 App Router, TypeScript, Tailwind CSS v4
- **Data**: MTA GTFS Static (build-time) + GTFS-RT TripUpdates (request-time)
- **Deployment**: Vercel

## Data Pipeline

### Build-time (GTFS Static)
- `scripts/build-gtfs.ts` downloads and parses MTA GTFS static zip
- Generates JSON files in `src/data/gtfs/` (gitignored, rebuilt each deploy)
- Output: `stations.json`, `routes.json`, `stationRoutes.json`, `routeStations.json`, `meta.json`

### Request-time (GTFS-RT)
- `src/lib/gtfsrt.ts` fetches and decodes protobuf TripUpdates feeds
- No caching initially; direct fetch on each request
- Filters arrivals by station stop_ids + route, groups by direction_id

## Route Structure

```
/                                         Landing page with search
/stops                                    Alphabetical station list
/lines                                    Route list with color bullets
/stops/[stationSlug]                      Station detail + serving routes
/lines/[routeSlug]                        Route detail + stations served
/stops/[stationSlug]/lines/[routeSlug]    Core status page (realtime arrivals)
```

## Key Files

- `scripts/build-gtfs.ts` — GTFS static ingestion script (runs at build)
- `src/data/gtfs/` — Generated JSON data (gitignored)
- `src/lib/gtfsrt.ts` — GTFS-RT protobuf fetch + decode
- `src/lib/gtfs.ts` — Helpers to load generated static JSON data
- `src/lib/slugs.ts` — Station/route slug generation
- `app/sitemap.ts` — Dynamic sitemap from generated data

## Conventions

- Server Components by default; `"use client"` only for interactive parts
- No hardcoded station/route data — everything derived from GTFS feed
- Route colors from GTFS `route_color`/`route_text_color`
- "Plain text sports" styling: monochrome typography, dense layout, color only for route bullets/accents
- Slugs: lowercase, hyphenated (e.g., `union-sq-14-st`, `a`)

## Environment Variables

- `GTFS_STATIC_URL` — URL to GTFS static zip (default: supplemented feed)
- `GTFS_RT_TRIPUPDATES_URLS` — Comma-separated GTFS-RT TripUpdate feed URLs
- `GTFS_RT_ALERTS_URL` — Optional alerts feed URL
