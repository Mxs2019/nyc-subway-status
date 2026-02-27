/**
 * GTFS-RT TripUpdates fetcher and decoder for MTA NYC Subway.
 *
 * Fetches protobuf feeds, decodes them, and extracts arrival predictions
 * for a given station + route combination.
 */

import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

// ---------------------------------------------------------------------------
// MTA feed URLs — one feed per line group
// ---------------------------------------------------------------------------

const DEFAULT_FEEDS: Record<string, string> = {
  // Lines 1,2,3,4,5,6,7,S (numbered lines + 42 St shuttle)
  default:
    "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
  ace: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
  bdfm: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
  g: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
  jz: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
  l: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
  nqrw: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
  si: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",
};

// Route → feed key mapping
const ROUTE_FEED: Record<string, string> = {
  "1": "default",
  "2": "default",
  "3": "default",
  "4": "default",
  "5": "default",
  "6": "default",
  "6X": "default",
  "7": "default",
  "7X": "default",
  GS: "default",
  FS: "default",
  H: "default",
  A: "ace",
  C: "ace",
  E: "ace",
  B: "bdfm",
  D: "bdfm",
  F: "bdfm",
  FX: "bdfm",
  M: "bdfm",
  G: "g",
  J: "jz",
  Z: "jz",
  L: "l",
  N: "nqrw",
  Q: "nqrw",
  R: "nqrw",
  W: "nqrw",
  SI: "si",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Arrival {
  routeId: string;
  tripId: string;
  directionId: number;
  stopId: string;
  arrivalTime: number; // Unix timestamp
}

export interface DirectionArrivals {
  directionId: number;
  arrivals: Arrival[];
}

// ---------------------------------------------------------------------------
// Feed fetching
// ---------------------------------------------------------------------------

function getFeedUrl(routeId: string): string {
  // Check env override first
  const envUrls = process.env.GTFS_RT_TRIPUPDATES_URLS;
  if (envUrls) {
    // If env var is set, use the first URL (simple override)
    return envUrls.split(",")[0].trim();
  }

  const feedKey = ROUTE_FEED[routeId.toUpperCase()] || "default";
  return DEFAULT_FEEDS[feedKey];
}

async function fetchFeed(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GTFS-RT fetch failed: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return FeedMessage.decode(new Uint8Array(buffer));
}

// ---------------------------------------------------------------------------
// Arrival extraction
// ---------------------------------------------------------------------------

/**
 * Fetch realtime arrivals for a specific station and route.
 *
 * @param childStopIds - The platform stop IDs (e.g., ["635N", "635S"])
 * @param routeId - The route ID (e.g., "4")
 * @param maxArrivals - Max arrivals per direction (default 5)
 */
export async function getArrivals(
  childStopIds: string[],
  routeId: string,
  maxArrivals: number = 5
): Promise<DirectionArrivals[]> {
  const stopIdSet = new Set(childStopIds);
  const feedUrl = getFeedUrl(routeId);

  const feed = await fetchFeed(feedUrl);
  const now = Math.floor(Date.now() / 1000);
  const arrivals: Arrival[] = [];

  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) continue;

    // Check route match
    const tripRouteId = tripUpdate.trip?.routeId;
    if (!tripRouteId) continue;

    // Match route ID (handle express variants like "6X" appearing as "6" in some feeds)
    const normalizedTripRoute = tripRouteId.replace(/X$/i, "");
    const normalizedTarget = routeId.replace(/X$/i, "");
    if (
      tripRouteId !== routeId &&
      normalizedTripRoute !== normalizedTarget &&
      normalizedTripRoute !== routeId
    ) {
      continue;
    }

    // Extract direction from NYCT extension or trip_id convention
    // MTA trip IDs often encode direction: e.g., "123456_6..N03R" where N=north, S=south
    let directionId = 0;
    if (tripUpdate.trip && "directionId" in tripUpdate.trip) {
      directionId = tripUpdate.trip.directionId ?? 0;
    }

    const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];
    for (const stu of stopTimeUpdates) {
      const stopId = stu.stopId;
      if (!stopId || !stopIdSet.has(stopId)) continue;

      const arrivalTime = stu.arrival?.time;
      const departureTime = stu.departure?.time;
      const time = arrivalTime || departureTime;

      if (!time) continue;

      // time can be a Long or number
      const timestamp =
        typeof time === "object" && "toNumber" in time
          ? (time as { toNumber(): number }).toNumber()
          : Number(time);

      // Only include future arrivals
      if (timestamp <= now) continue;

      // Infer direction from stop_id suffix if directionId is 0
      let dir = directionId;
      if (dir === 0 && stopId) {
        if (stopId.endsWith("N")) dir = 0;
        else if (stopId.endsWith("S")) dir = 1;
      }

      arrivals.push({
        routeId: tripRouteId,
        tripId: tripUpdate.trip?.tripId || "",
        directionId: dir,
        stopId,
        arrivalTime: timestamp,
      });
    }
  }

  // Group by direction
  const byDirection = new Map<number, Arrival[]>();
  for (const a of arrivals) {
    const existing = byDirection.get(a.directionId) || [];
    existing.push(a);
    byDirection.set(a.directionId, existing);
  }

  // Sort each direction by arrival time and limit
  const result: DirectionArrivals[] = [];
  for (const [directionId, dirArrivals] of byDirection) {
    dirArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);
    result.push({
      directionId,
      arrivals: dirArrivals.slice(0, maxArrivals),
    });
  }

  // Sort directions (0 first, then 1)
  result.sort((a, b) => a.directionId - b.directionId);

  return result;
}

/**
 * Fetch all arrivals for a station (all routes).
 */
export async function getAllArrivalsForStation(
  childStopIds: string[],
  routeIds: string[],
  maxArrivals: number = 5
): Promise<Map<string, DirectionArrivals[]>> {
  // Group routes by feed to minimize fetches
  const feedRoutes = new Map<string, string[]>();
  for (const routeId of routeIds) {
    const feedKey = ROUTE_FEED[routeId.toUpperCase()] || "default";
    const existing = feedRoutes.get(feedKey) || [];
    existing.push(routeId);
    feedRoutes.set(feedKey, existing);
  }

  const stopIdSet = new Set(childStopIds);
  const now = Math.floor(Date.now() / 1000);
  const routeArrivals = new Map<string, Arrival[]>();

  // Fetch each feed in parallel
  const feedEntries = Array.from(feedRoutes.entries());
  const feeds = await Promise.all(
    feedEntries.map(async ([feedKey]) => {
      const url = DEFAULT_FEEDS[feedKey];
      try {
        return await fetchFeed(url);
      } catch (err) {
        console.error(`Failed to fetch feed ${feedKey}:`, err);
        return null;
      }
    })
  );

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    if (!feed) continue;

    const targetRoutes = new Set(feedEntries[i][1]);

    for (const entity of feed.entity) {
      const tripUpdate = entity.tripUpdate;
      if (!tripUpdate) continue;

      const tripRouteId = tripUpdate.trip?.routeId;
      if (!tripRouteId || !targetRoutes.has(tripRouteId)) continue;

      const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];
      for (const stu of stopTimeUpdates) {
        const stopId = stu.stopId;
        if (!stopId || !stopIdSet.has(stopId)) continue;

        const arrivalTime = stu.arrival?.time;
        const departureTime = stu.departure?.time;
        const time = arrivalTime || departureTime;
        if (!time) continue;

        const timestamp =
          typeof time === "object" && "toNumber" in time
            ? (time as { toNumber(): number }).toNumber()
            : Number(time);

        if (timestamp <= now) continue;

        let directionId = 0;
        if (stopId.endsWith("S")) directionId = 1;

        const existing = routeArrivals.get(tripRouteId) || [];
        existing.push({
          routeId: tripRouteId,
          tripId: tripUpdate.trip?.tripId || "",
          directionId,
          stopId,
          arrivalTime: timestamp,
        });
        routeArrivals.set(tripRouteId, existing);
      }
    }
  }

  // Group by route and direction
  const result = new Map<string, DirectionArrivals[]>();
  for (const [routeId, arrivals] of routeArrivals) {
    const byDir = new Map<number, Arrival[]>();
    for (const a of arrivals) {
      const existing = byDir.get(a.directionId) || [];
      existing.push(a);
      byDir.set(a.directionId, existing);
    }

    const dirs: DirectionArrivals[] = [];
    for (const [dir, dirArrivals] of byDir) {
      dirArrivals.sort((a, b) => a.arrivalTime - b.arrivalTime);
      dirs.push({ directionId: dir, arrivals: dirArrivals.slice(0, maxArrivals) });
    }
    dirs.sort((a, b) => a.directionId - b.directionId);
    result.set(routeId, dirs);
  }

  return result;
}
