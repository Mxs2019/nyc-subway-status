/**
 * GTFS-RT TripUpdates fetcher and decoder for MTA NYC Subway.
 *
 * Fetches protobuf feeds, decodes them, and extracts arrival predictions
 * for a given station + route combination.
 */

import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { getStationByChildStopId } from "./gtfs";

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;
const AlertProto = GtfsRealtimeBindings.transit_realtime.Alert;

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
  headsign: string;    // Last stop name (terminus) for this trip
}

export interface TripStopTime {
  stopId: string;
  arrivalTime: number | null;
  departureTime: number | null;
}

export interface TripDetail {
  tripId: string;
  routeId: string;
  directionId: number;
  startDate: string | null;
  startTime: string | null;
  stopTimes: TripStopTime[];
}

export interface DirectionArrivals {
  directionId: number;
  directionLabel: string;
  arrivals: Arrival[];
}

function getDirectionIdFromStopId(stopId: string): number | null {
  if (stopId.endsWith("N")) return 0;
  if (stopId.endsWith("S")) return 1;
  return null;
}

function getDirectionLabelFromArrivals(
  arrivals: Arrival[],
  fallbackDirectionId: number
): string {
  let northboundCount = 0;
  let southboundCount = 0;

  for (const arrival of arrivals) {
    const directionId = getDirectionIdFromStopId(arrival.stopId);
    if (directionId === 0) northboundCount++;
    if (directionId === 1) southboundCount++;
  }

  if (northboundCount > southboundCount) return "Northbound";
  if (southboundCount > northboundCount) return "Southbound";
  if (northboundCount > 0) return "Northbound";
  if (southboundCount > 0) return "Southbound";
  return `Direction ${fallbackDirectionId}`;
}

/**
 * Derive headsign from the last stop in a trip's stop_time_update list.
 * Returns the station name if resolvable, otherwise the raw stop ID.
 */
function getHeadsign(stopTimeUpdates: { stopId?: string | null }[]): string {
  for (let i = stopTimeUpdates.length - 1; i >= 0; i--) {
    const stopId = stopTimeUpdates[i].stopId;
    if (!stopId) continue;
    const station = getStationByChildStopId(stopId);
    return station?.name ?? stopId;
  }
  return "";
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
    const headsign = getHeadsign(stopTimeUpdates);

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

      // Prefer stop_id suffix for direction at this station when present.
      // MTA stop IDs are platform-specific and end with N/S.
      let dir = directionId;
      const stopDirection = getDirectionIdFromStopId(stopId);
      if (stopDirection !== null) {
        dir = stopDirection;
      }

      arrivals.push({
        routeId: tripRouteId,
        tripId: tripUpdate.trip?.tripId || "",
        directionId: dir,
        stopId,
        arrivalTime: timestamp,
        headsign,
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
      directionLabel: getDirectionLabelFromArrivals(dirArrivals, directionId),
      arrivals: dirArrivals.slice(0, maxArrivals),
    });
  }

  // Sort directions (0 first, then 1)
  result.sort((a, b) => a.directionId - b.directionId);

  return result;
}

/**
 * Fetch the next arrival per direction for a single route across multiple stations.
 * Fetches the feed once and extracts the soonest uptown/downtown arrival per station.
 */
export async function getNextArrivalsForRoute(
  routeId: string,
  stations: { id: string; childStopIds: string[] }[]
): Promise<Map<string, { uptown: Arrival | null; downtown: Arrival | null }>> {
  const feedUrl = getFeedUrl(routeId);
  const feed = await fetchFeed(feedUrl);
  const now = Math.floor(Date.now() / 1000);

  // Map stopId → stationId for quick lookup
  const stopToStation = new Map<string, string>();
  for (const station of stations) {
    for (const stopId of station.childStopIds) {
      stopToStation.set(stopId, station.id);
    }
  }

  const result = new Map<string, { uptown: Arrival | null; downtown: Arrival | null }>();
  for (const station of stations) {
    result.set(station.id, { uptown: null, downtown: null });
  }

  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) continue;

    const tripRouteId = tripUpdate.trip?.routeId;
    if (!tripRouteId) continue;

    const normalizedTripRoute = tripRouteId.replace(/X$/i, "");
    const normalizedTarget = routeId.replace(/X$/i, "");
    if (
      tripRouteId !== routeId &&
      normalizedTripRoute !== normalizedTarget &&
      normalizedTripRoute !== routeId
    )
      continue;

    const stopTimeUpdates = tripUpdate.stopTimeUpdate || [];
    const headsign = getHeadsign(stopTimeUpdates);

    for (const stu of stopTimeUpdates) {
      const stopId = stu.stopId;
      if (!stopId) continue;

      const stationId = stopToStation.get(stopId);
      if (!stationId) continue;

      const time = stu.arrival?.time || stu.departure?.time;
      if (!time) continue;

      const timestamp =
        typeof time === "object" && "toNumber" in time
          ? (time as { toNumber(): number }).toNumber()
          : Number(time);

      if (timestamp <= now) continue;

      const directionId = stopId.endsWith("S") ? 1 : 0;
      const entry = result.get(stationId)!;

      if (directionId === 0) {
        if (!entry.uptown || timestamp < entry.uptown.arrivalTime) {
          entry.uptown = {
            routeId: tripRouteId,
            tripId: tripUpdate.trip?.tripId || "",
            directionId,
            stopId,
            arrivalTime: timestamp,
            headsign,
          };
        }
      } else {
        if (!entry.downtown || timestamp < entry.downtown.arrivalTime) {
          entry.downtown = {
            routeId: tripRouteId,
            tripId: tripUpdate.trip?.tripId || "",
            directionId,
            stopId,
            arrivalTime: timestamp,
            headsign,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Fetch a specific trip by ID, returning its full stop itinerary.
 */
export async function getTripById(
  routeId: string,
  tripId: string,
): Promise<TripDetail | null> {
  const feedUrl = getFeedUrl(routeId);
  const feed = await fetchFeed(feedUrl);

  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate) continue;
    if (tripUpdate.trip?.tripId !== tripId) continue;

    let directionId = 0;
    if (tripUpdate.trip && "directionId" in tripUpdate.trip) {
      directionId = tripUpdate.trip.directionId ?? 0;
    }

    const stopTimes: TripStopTime[] = [];
    for (const stu of tripUpdate.stopTimeUpdate || []) {
      if (!stu.stopId) continue;

      const arrTime = stu.arrival?.time;
      const depTime = stu.departure?.time;

      const toNum = (t: unknown): number | null => {
        if (t == null) return null;
        if (typeof t === "object" && t !== null && "toNumber" in t) {
          return (t as { toNumber(): number }).toNumber();
        }
        return Number(t);
      };

      stopTimes.push({
        stopId: stu.stopId,
        arrivalTime: toNum(arrTime),
        departureTime: toNum(depTime),
      });
    }

    return {
      tripId,
      routeId: tripUpdate.trip?.routeId || routeId,
      directionId,
      startDate: tripUpdate.trip?.startDate || null,
      startTime: tripUpdate.trip?.startTime || null,
      stopTimes,
    };
  }

  return null;
}

/**
 * Fetch all arrivals for a station (all routes).
 */
export async function getAllArrivalsForStation(
  childStopIds: string[],
  routeIds: string[],
  maxArrivals: number = 5,
  maxMinutesAhead?: number
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
  const maxTimestamp = maxMinutesAhead ? now + maxMinutesAhead * 60 : null;
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
      const headsign = getHeadsign(stopTimeUpdates);

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
        if (maxTimestamp !== null && timestamp > maxTimestamp) continue;

        let directionId = 0;
        if (stopId.endsWith("S")) directionId = 1;

        const existing = routeArrivals.get(tripRouteId) || [];
        existing.push({
          routeId: tripRouteId,
          tripId: tripUpdate.trip?.tripId || "",
          directionId,
          stopId,
          arrivalTime: timestamp,
          headsign,
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
      dirs.push({
        directionId: dir,
        directionLabel: getDirectionLabelFromArrivals(dirArrivals, dir),
        arrivals: dirArrivals.slice(0, maxArrivals),
      });
    }
    dirs.sort((a, b) => a.directionId - b.directionId);
    result.set(routeId, dirs);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Trip planning — find trips connecting two stations
// ---------------------------------------------------------------------------

export interface PlannedTrip {
  tripId: string;
  routeId: string;
  departOriginTime: number;     // Unix timestamp
  arriveDestinationTime: number; // Unix timestamp
  numStops: number;             // stops between origin and destination (inclusive)
}

/**
 * Find real-time trips that connect an origin station to a destination station
 * on one or more routes. Uses GTFS-RT TripUpdate data to match trips that
 * stop at both stations in the correct order.
 */
export async function planTrip(
  originChildStopIds: string[],
  destinationChildStopIds: string[],
  routeIds: string[],
  departAfter?: number,
  limit: number = 5,
): Promise<PlannedTrip[]> {
  const originSet = new Set(originChildStopIds);
  const destSet = new Set(destinationChildStopIds);
  const now = Math.floor(Date.now() / 1000);
  const minDeparture = departAfter ?? now;

  // Group routes by feed to minimize fetches
  const feedRoutes = new Map<string, string[]>();
  for (const routeId of routeIds) {
    const feedKey = ROUTE_FEED[routeId.toUpperCase()] || "default";
    const existing = feedRoutes.get(feedKey) || [];
    existing.push(routeId);
    feedRoutes.set(feedKey, existing);
  }

  const trips: PlannedTrip[] = [];

  const feedEntries = Array.from(feedRoutes.entries());
  const feeds = await Promise.all(
    feedEntries.map(async ([feedKey]) => {
      const url = DEFAULT_FEEDS[feedKey];
      try {
        return await fetchFeed(url);
      } catch {
        return null;
      }
    }),
  );

  const toNum = (t: unknown): number | null => {
    if (t == null) return null;
    if (typeof t === "object" && t !== null && "toNumber" in t) {
      return (t as { toNumber(): number }).toNumber();
    }
    return Number(t);
  };

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

      // Find origin and destination in the stop sequence
      let originTime: number | null = null;
      let originIdx = -1;
      let destTime: number | null = null;
      let destIdx = -1;

      for (let j = 0; j < stopTimeUpdates.length; j++) {
        const stu = stopTimeUpdates[j];
        const stopId = stu.stopId;
        if (!stopId) continue;

        const time = toNum(stu.arrival?.time) ?? toNum(stu.departure?.time);

        if (originIdx === -1 && originSet.has(stopId)) {
          originTime = toNum(stu.departure?.time) ?? time;
          originIdx = j;
        } else if (originIdx !== -1 && destSet.has(stopId)) {
          destTime = time;
          destIdx = j;
          break;
        }
      }

      if (originIdx === -1 || destIdx === -1 || originTime == null || destTime == null) continue;
      if (originTime < minDeparture) continue;
      if (originTime <= now && destTime <= now) continue;

      trips.push({
        tripId: tripUpdate.trip?.tripId || "",
        routeId: tripRouteId,
        departOriginTime: originTime,
        arriveDestinationTime: destTime,
        numStops: destIdx - originIdx + 1,
      });
    }
  }

  trips.sort((a, b) => a.departOriginTime - b.departOriginTime);
  return trips.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Service Alerts
// ---------------------------------------------------------------------------

const DEFAULT_ALERTS_URL =
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fall-alerts";

const CAUSE_LABELS: Record<number, string> = {
  1: "Unknown",
  2: "Other",
  3: "Technical Problem",
  4: "Strike",
  5: "Demonstration",
  6: "Accident",
  7: "Holiday",
  8: "Weather",
  9: "Maintenance",
  10: "Construction",
  11: "Police Activity",
  12: "Medical Emergency",
};

const EFFECT_LABELS: Record<number, string> = {
  1: "No Service",
  2: "Reduced Service",
  3: "Significant Delays",
  4: "Detour",
  5: "Additional Service",
  6: "Modified Service",
  7: "Other",
  8: "Unknown",
  9: "Stop Moved",
  10: "No Effect",
  11: "Accessibility Issue",
};

const SEVERITY_LABELS: Record<number, string> = {
  1: "unknown",
  2: "info",
  3: "warning",
  4: "severe",
};

export interface ServiceAlert {
  id: string;
  headerText: string;
  descriptionText: string;
  cause: string;
  effect: string;
  severity: string;
  routeIds: string[];
  stopIds: string[];
  activePeriods: { start: number | null; end: number | null }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTranslatedText(field: any): string {
  if (!field?.translation?.length) return "";
  const translations = field.translation as { text?: string | null; language?: string | null }[];
  // Prefer English, fall back to first entry
  const en = translations.find((t) => t.language === "en");
  return (en?.text ?? translations[0]?.text) || "";
}

/**
 * Fetch active service alerts, optionally filtered by route and/or stop IDs.
 */
export async function getServiceAlerts(opts?: {
  routeIds?: string[];
  stopIds?: string[];
}): Promise<ServiceAlert[]> {
  const url = process.env.GTFS_RT_ALERTS_URL || DEFAULT_ALERTS_URL;
  const feed = await fetchFeed(url);
  const now = Math.floor(Date.now() / 1000);

  const routeFilter = opts?.routeIds ? new Set(opts.routeIds) : null;
  const stopFilter = opts?.stopIds ? new Set(opts.stopIds) : null;

  const alerts: ServiceAlert[] = [];

  for (const entity of feed.entity) {
    const alert = entity.alert;
    if (!alert) continue;

    // Collect affected route IDs and stop IDs
    const routeIds: string[] = [];
    const stopIds: string[] = [];
    for (const ie of alert.informedEntity || []) {
      if (ie.routeId) routeIds.push(ie.routeId);
      if (ie.stopId) stopIds.push(ie.stopId);
    }

    // Filter by route if requested
    if (routeFilter && !routeIds.some((id) => routeFilter.has(id))) continue;
    // Filter by stop if requested
    if (stopFilter && !stopIds.some((id) => stopFilter.has(id))) continue;

    // Check active periods — include if any period overlaps with now,
    // or if no periods are defined
    const periods = (alert.activePeriod || []).map((p) => {
      const start =
        p.start != null
          ? typeof p.start === "object" && "toNumber" in p.start
            ? (p.start as { toNumber(): number }).toNumber()
            : Number(p.start)
          : null;
      const end =
        p.end != null
          ? typeof p.end === "object" && "toNumber" in p.end
            ? (p.end as { toNumber(): number }).toNumber()
            : Number(p.end)
          : null;
      return { start, end };
    });

    if (periods.length > 0) {
      const isActive = periods.some(
        (p) => (p.start === null || p.start <= now) && (p.end === null || p.end >= now),
      );
      if (!isActive) continue;
    }

    const causeVal = alert.cause ?? AlertProto.Cause.UNKNOWN_CAUSE;
    const effectVal = alert.effect ?? AlertProto.Effect.UNKNOWN_EFFECT;
    const severityVal = alert.severityLevel ?? 1;

    alerts.push({
      id: entity.id || "",
      headerText: extractTranslatedText(alert.headerText),
      descriptionText: extractTranslatedText(alert.descriptionText),
      cause: CAUSE_LABELS[causeVal as number] || "Unknown",
      effect: EFFECT_LABELS[effectVal as number] || "Unknown",
      severity: SEVERITY_LABELS[severityVal as number] || "unknown",
      routeIds,
      stopIds,
      activePeriods: periods,
    });
  }

  return alerts;
}
