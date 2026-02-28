/**
 * GTFS Static Ingestion Script
 *
 * Downloads the MTA subway GTFS static feed, parses it, and generates
 * JSON files used by the app at build time.
 *
 * Run: npx tsx scripts/build-gtfs.ts
 */

import { parse } from "csv-parse/sync";
import * as fs from "fs";
import JSZip from "jszip";
import * as path from "path";
import { STATION_COMPLEXES } from "../src/data/station-complexes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GtfsStop {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  location_type: string;
  parent_station: string;
}

interface GtfsRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: string;
  route_color: string;
  route_text_color: string;
  route_url: string;
}

interface GtfsTrip {
  route_id: string;
  trip_id: string;
  service_id: string;
  direction_id: string;
}

interface GtfsStopTime {
  trip_id: string;
  stop_id: string;
  arrival_time: string;
  departure_time: string;
  stop_sequence: string;
}

// Output types
interface Station {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  childStopIds: string[];
}

interface Route {
  id: string;
  shortName: string;
  longName: string;
  color: string;
  textColor: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Slug generation (mirrors src/lib/slugs.ts)
// ---------------------------------------------------------------------------

function stationSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function routeSlug(routeId: string): string {
  return routeId.toLowerCase();
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCsv<T>(content: string): T[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as T[];
}

// ---------------------------------------------------------------------------
// Complex merging helpers
// ---------------------------------------------------------------------------

// Build a reverse map: gtfs_stop_id → canonical station id (first in complex)
function buildComplexMergeMap(): Map<string, string> {
  const mergeMap = new Map<string, string>();
  for (const ids of Object.values(STATION_COMPLEXES)) {
    const canonical = ids[0]; // first ID is the canonical one
    for (const id of ids) {
      mergeMap.set(id, canonical);
    }
  }
  return mergeMap;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const GTFS_URL =
  process.env.GTFS_STATIC_URL ||
  "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_supplemented.zip";

const OUT_DIR = path.join(process.cwd(), "src", "data", "gtfs");

async function main() {
  console.log(`Fetching GTFS static feed from ${GTFS_URL} ...`);
  const response = await fetch(GTFS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch GTFS: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  console.log("Parsing GTFS files...");

  const stopsRaw = await zip.file("stops.txt")!.async("string");
  const routesRaw = await zip.file("routes.txt")!.async("string");
  const tripsRaw = await zip.file("trips.txt")!.async("string");
  const stopTimesRaw = await zip.file("stop_times.txt")!.async("string");

  const stops = parseCsv<GtfsStop>(stopsRaw);
  const routes = parseCsv<GtfsRoute>(routesRaw);
  const trips = parseCsv<GtfsTrip>(tripsRaw);
  const stopTimes = parseCsv<GtfsStopTime>(stopTimesRaw);

  console.log(
    `Parsed: ${stops.length} stops, ${routes.length} routes, ${trips.length} trips, ${stopTimes.length} stop_times`
  );

  // -----------------------------------------------------------------------
  // Build parent stations and child mappings
  // -----------------------------------------------------------------------

  const parentStops = stops.filter((s) => s.location_type === "1");
  const childStops = stops.filter(
    (s) => s.location_type === "0" || s.location_type === ""
  );

  // Map child stop_id → parent_station
  const childToParent = new Map<string, string>();
  for (const child of childStops) {
    if (child.parent_station) {
      childToParent.set(child.stop_id, child.parent_station);
    }
  }

  // Build initial station objects (before merging)
  const rawStationsMap = new Map<string, Station>();
  for (const parent of parentStops) {
    const children = childStops
      .filter((c) => c.parent_station === parent.stop_id)
      .map((c) => c.stop_id);

    rawStationsMap.set(parent.stop_id, {
      id: parent.stop_id,
      name: parent.stop_name,
      slug: stationSlug(parent.stop_name),
      lat: parseFloat(parent.stop_lat),
      lon: parseFloat(parent.stop_lon),
      childStopIds: children,
    });
  }

  // Handle orphan stops (no parent)
  for (const child of childStops) {
    if (!child.parent_station && !rawStationsMap.has(child.stop_id)) {
      rawStationsMap.set(child.stop_id, {
        id: child.stop_id,
        name: child.stop_name,
        slug: stationSlug(child.stop_name),
        lat: parseFloat(child.stop_lat),
        lon: parseFloat(child.stop_lon),
        childStopIds: [child.stop_id],
      });
    }
  }

  // -----------------------------------------------------------------------
  // Merge station complexes
  // -----------------------------------------------------------------------

  const complexMerge = buildComplexMergeMap();

  // Resolve parent station to its canonical complex representative
  // e.g., L03 → R20 (first in complex 602), 635 → R20
  function resolveStation(parentId: string): string {
    return complexMerge.get(parentId) || parentId;
  }

  // Also update childToParent to resolve through complexes
  for (const [childId, parentId] of childToParent) {
    childToParent.set(childId, resolveStation(parentId));
  }

  // Build merged stations map
  const stationsMap = new Map<string, Station>();

  for (const [rawId, rawStation] of rawStationsMap) {
    const canonicalId = resolveStation(rawId);

    if (stationsMap.has(canonicalId)) {
      // Merge into existing
      const existing = stationsMap.get(canonicalId)!;
      existing.childStopIds.push(...rawStation.childStopIds);
    } else {
      // Create new entry with canonical ID
      stationsMap.set(canonicalId, {
        ...rawStation,
        id: canonicalId,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Proximity merge: merge same-name stations within 400m
  // -----------------------------------------------------------------------

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000; // Earth radius in meters
    const p = Math.PI / 180;
    const a =
      0.5 -
      Math.cos((lat2 - lat1) * p) / 2 +
      Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p)) / 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const PROXIMITY_THRESHOLD = 400; // meters

  // Group stations by name
  const byName = new Map<string, string[]>();
  for (const [id, station] of stationsMap) {
    const ids = byName.get(station.name) || [];
    ids.push(id);
    byName.set(station.name, ids);
  }

  let proximityMergeCount = 0;

  for (const [, ids] of byName) {
    if (ids.length < 2) continue;

    // Union-Find to cluster nearby stations
    const parent = new Map<string, string>();
    for (const id of ids) parent.set(id, id);

    function find(x: string): string {
      while (parent.get(x) !== x) {
        parent.set(x, parent.get(parent.get(x)!)!);
        x = parent.get(x)!;
      }
      return x;
    }

    function union(a: string, b: string) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    }

    // Union stations within threshold
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = stationsMap.get(ids[i])!;
        const b = stationsMap.get(ids[j])!;
        if (haversine(a.lat, a.lon, b.lat, b.lon) < PROXIMITY_THRESHOLD) {
          union(ids[i], ids[j]);
        }
      }
    }

    // Group by cluster root
    const clusters = new Map<string, string[]>();
    for (const id of ids) {
      const root = find(id);
      const group = clusters.get(root) || [];
      group.push(id);
      clusters.set(root, group);
    }

    // Merge each cluster
    for (const [canonical, group] of clusters) {
      if (group.length < 2) continue;
      for (const id of group) {
        if (id === canonical) continue;
        // Merge into canonical
        const source = stationsMap.get(id)!;
        const target = stationsMap.get(canonical)!;
        target.childStopIds.push(...source.childStopIds);
        stationsMap.delete(id);
        // Update childToParent references
        for (const [childId, parentId] of childToParent) {
          if (parentId === id) {
            childToParent.set(childId, canonical);
          }
        }
        proximityMergeCount++;
      }
    }
  }

  console.log(`  Proximity-merged ${proximityMergeCount} additional stations`);

  // -----------------------------------------------------------------------
  // Build routes
  // -----------------------------------------------------------------------

  const routesList: Route[] = routes
    .filter((r) => r.route_type === "1" || r.route_type === "2" || r.route_type === "3" || r.route_type === "")
    .map((r) => ({
      id: r.route_id,
      shortName: r.route_short_name || r.route_id,
      longName: r.route_long_name,
      color: r.route_color ? `#${r.route_color}` : "#808080",
      textColor: r.route_text_color ? `#${r.route_text_color}` : "#FFFFFF",
      slug: routeSlug(r.route_id),
    }));

  // -----------------------------------------------------------------------
  // Build station↔route mappings via stop_times → trips → routes
  // -----------------------------------------------------------------------

  const tripRoute = new Map<string, string>();
  for (const trip of trips) {
    tripRoute.set(trip.trip_id, trip.route_id);
  }

  const validRouteIds = new Set(routesList.map((r) => r.id));

  const stationRoutes = new Map<string, Set<string>>();
  const routeStations = new Map<string, Set<string>>();

  for (const st of stopTimes) {
    const routeId = tripRoute.get(st.trip_id);
    if (!routeId || !validRouteIds.has(routeId)) continue;

    // Resolve child stop → parent → complex canonical
    const parentId = childToParent.get(st.stop_id) || st.stop_id;
    const canonicalId = resolveStation(parentId);
    if (!stationsMap.has(canonicalId)) continue;

    if (!stationRoutes.has(canonicalId)) stationRoutes.set(canonicalId, new Set());
    stationRoutes.get(canonicalId)!.add(routeId);

    if (!routeStations.has(routeId)) routeStations.set(routeId, new Set());
    routeStations.get(routeId)!.add(canonicalId);
  }

  // -----------------------------------------------------------------------
  // Serialize outputs
  // -----------------------------------------------------------------------

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const stations = Array.from(stationsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const stationRoutesObj: Record<string, string[]> = {};
  for (const [stationId, routeIds] of stationRoutes) {
    stationRoutesObj[stationId] = Array.from(routeIds).sort();
  }

  const routeStationsObj: Record<string, string[]> = {};
  for (const [routeId, stationIds] of routeStations) {
    routeStationsObj[routeId] = Array.from(stationIds).sort((a, b) => {
      const sa = stationsMap.get(a);
      const sb = stationsMap.get(b);
      return (sa?.name || "").localeCompare(sb?.name || "");
    });
  }

  const meta = {
    buildTime: new Date().toISOString(),
    feedUrl: GTFS_URL,
    stationCount: stations.length,
    routeCount: routesList.length,
    stationRouteLinks: Object.keys(stationRoutesObj).length,
    complexesMerged: Object.keys(STATION_COMPLEXES).length,
  };

  const writes = [
    ["stations.json", stations],
    ["routes.json", routesList],
    ["stationRoutes.json", stationRoutesObj],
    ["routeStations.json", routeStationsObj],
    ["meta.json", meta],
  ] as const;

  for (const [filename, data] of writes) {
    const filepath = path.join(OUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`  ✓ ${filename}`);
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  console.log("\nBuild complete:");
  console.log(`  Stations: ${stations.length} (after merging ${Object.keys(STATION_COMPLEXES).length} complexes)`);
  console.log(`  Routes: ${routesList.length}`);
  console.log(
    `  Station↔Route links: ${Object.values(stationRoutesObj).reduce((s, v) => s + v.length, 0)}`
  );

  // Validation: check Union Square
  const unionSq = stations.find((s) =>
    s.name.toLowerCase().includes("union sq")
  );
  if (unionSq) {
    const uqRoutes = stationRoutesObj[unionSq.id] || [];
    console.log(
      `\n  Validation — ${unionSq.name} (${unionSq.id}): routes [${uqRoutes.join(", ")}]`
    );
    console.log(`    Child stop IDs: [${unionSq.childStopIds.join(", ")}]`);
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
