import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import {
  getArrivals,
  getAllArrivalsForStation,
  getTripById,
  getServiceAlerts,
  planTrip,
} from "./gtfsrt";

const { FeedMessage, FeedEntity, FeedHeader, TripUpdate, TripDescriptor, Alert, EntitySelector, TimeRange, TranslatedString } =
  GtfsRealtimeBindings.transit_realtime;

// Mock gtfs module so getStationByChildStopId returns test data
vi.mock("./gtfs", () => ({
  getStationByChildStopId: (stopId: string) => {
    const stations: Record<string, { name: string; slug: string }> = {
      "R20N": { name: "14 St-Union Sq", slug: "14-st-union-sq" },
      "R20S": { name: "14 St-Union Sq", slug: "14-st-union-sq" },
      "R20": { name: "14 St-Union Sq", slug: "14-st-union-sq" },
      "635N": { name: "14 St-Union Sq", slug: "14-st-union-sq" },
      "635S": { name: "14 St-Union Sq", slug: "14-st-union-sq" },
      "R22N": { name: "Canal St", slug: "canal-st" },
      "R22S": { name: "Canal St", slug: "canal-st" },
      "R23N": { name: "City Hall", slug: "city-hall" },
      "R23S": { name: "City Hall", slug: "city-hall" },
    };
    return stations[stopId] ?? stations[stopId.replace(/[NS]$/, "")] ?? undefined;
  },
}));

function encodeFeed(entities: GtfsRealtimeBindings.transit_realtime.IFeedEntity[]) {
  const message = FeedMessage.create({
    header: FeedHeader.create({
      gtfsRealtimeVersion: "2.0",
      timestamp: Math.floor(Date.now() / 1000),
    }),
    entity: entities,
  });
  const buffer = FeedMessage.encode(message).finish();
  return buffer;
}

function mockFetchWithBuffer(buffer: Uint8Array) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
    }),
  );
}

const futureTime = Math.floor(Date.now() / 1000) + 300; // 5 min ahead

describe("getArrivals", () => {
  afterEach(() => vi.restoreAllMocks());

  it("extracts future arrivals for matching station and route", async () => {
    const buffer = encodeFeed([
      {
        id: "trip1",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "t1", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: futureTime } },
            { stopId: "R22N", arrival: { time: futureTime + 120 } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const result = await getArrivals(["R20N", "R20S"], "Q");

    expect(result.length).toBeGreaterThanOrEqual(1);
    const northbound = result.find((d) => d.directionId === 0);
    expect(northbound).toBeDefined();
    expect(northbound!.arrivals.length).toBe(1);
    expect(northbound!.arrivals[0].routeId).toBe("Q");
    expect(northbound!.arrivals[0].arrivalTime).toBe(futureTime);
  });

  it("filters out past arrivals", async () => {
    const pastTime = Math.floor(Date.now() / 1000) - 60;
    const buffer = encodeFeed([
      {
        id: "trip2",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "t2", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: pastTime } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const result = await getArrivals(["R20N", "R20S"], "Q");
    const allArrivals = result.flatMap((d) => d.arrivals);
    expect(allArrivals.length).toBe(0);
  });

  it("filters by route - ignores non-matching routes", async () => {
    const buffer = encodeFeed([
      {
        id: "trip3",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "t3", routeId: "N" }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: futureTime } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const result = await getArrivals(["R20N", "R20S"], "Q");
    const allArrivals = result.flatMap((d) => d.arrivals);
    expect(allArrivals.length).toBe(0);
  });

  it("groups arrivals by direction", async () => {
    const buffer = encodeFeed([
      {
        id: "trip4",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "t4", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: futureTime } },
            { stopId: "R22N", arrival: { time: futureTime + 120 } },
          ],
        }),
      },
      {
        id: "trip5",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "t5", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20S", arrival: { time: futureTime + 60 } },
            { stopId: "R22S", arrival: { time: futureTime + 180 } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const result = await getArrivals(["R20N", "R20S"], "Q");
    expect(result.length).toBe(2);

    const northbound = result.find((d) => d.directionId === 0);
    const southbound = result.find((d) => d.directionId === 1);
    expect(northbound?.arrivals.length).toBe(1);
    expect(southbound?.arrivals.length).toBe(1);
  });

  it("limits arrivals per direction", async () => {
    const entities = Array.from({ length: 10 }, (_, i) => ({
      id: `trip-${i}`,
      tripUpdate: TripUpdate.create({
        trip: TripDescriptor.create({ tripId: `t-${i}`, routeId: "Q" }),
        stopTimeUpdate: [
          { stopId: "R20N", arrival: { time: futureTime + i * 60 } },
        ],
      }),
    }));
    const buffer = encodeFeed(entities);
    mockFetchWithBuffer(buffer);

    const result = await getArrivals(["R20N", "R20S"], "Q", 3);
    const northbound = result.find((d) => d.directionId === 0);
    expect(northbound?.arrivals.length).toBe(3);
  });

  it("resolves headsign from last stop in trip", async () => {
    const buffer = encodeFeed([
      {
        id: "trip6",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "t6", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: futureTime } },
            { stopId: "R22N", arrival: { time: futureTime + 60 } },
            { stopId: "R23N", arrival: { time: futureTime + 120 } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const result = await getArrivals(["R20N"], "Q");
    const arrivals = result.flatMap((d) => d.arrivals);
    expect(arrivals[0].headsign).toBe("City Hall");
  });
});

describe("getTripById", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns trip detail with all stop times", async () => {
    const buffer = encodeFeed([
      {
        id: "trip-detail",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({
            tripId: "target-trip",
            routeId: "Q",
            startDate: "20240101",
          }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: futureTime }, departure: { time: futureTime + 30 } },
            { stopId: "R22N", arrival: { time: futureTime + 120 } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const trip = await getTripById("Q", "target-trip");
    expect(trip).not.toBeNull();
    expect(trip!.tripId).toBe("target-trip");
    expect(trip!.routeId).toBe("Q");
    expect(trip!.stopTimes.length).toBe(2);
    expect(trip!.stopTimes[0].arrivalTime).toBe(futureTime);
    expect(trip!.stopTimes[0].departureTime).toBe(futureTime + 30);
  });

  it("returns null for non-existent trip", async () => {
    const buffer = encodeFeed([
      {
        id: "other",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "other-trip", routeId: "Q" }),
          stopTimeUpdate: [],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const trip = await getTripById("Q", "nonexistent-trip");
    expect(trip).toBeNull();
  });
});

describe("planTrip", () => {
  afterEach(() => vi.restoreAllMocks());

  it("finds trips connecting origin to destination", async () => {
    const buffer = encodeFeed([
      {
        id: "plan1",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "plan-t1", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20N", departure: { time: futureTime }, arrival: { time: futureTime } },
            { stopId: "R22N", arrival: { time: futureTime + 300 } },
            { stopId: "R23N", arrival: { time: futureTime + 600 } },
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const trips = await planTrip(["R20N"], ["R23N"], ["Q"]);
    expect(trips.length).toBe(1);
    expect(trips[0].tripId).toBe("plan-t1");
    expect(trips[0].routeId).toBe("Q");
    expect(trips[0].departOriginTime).toBe(futureTime);
    expect(trips[0].arriveDestinationTime).toBe(futureTime + 600);
    expect(trips[0].numStops).toBe(3);
  });

  it("returns empty array when no connecting trips exist", async () => {
    const buffer = encodeFeed([
      {
        id: "plan2",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({ tripId: "plan-t2", routeId: "Q" }),
          stopTimeUpdate: [
            { stopId: "R20N", arrival: { time: futureTime } },
            // Destination not in this trip
          ],
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const trips = await planTrip(["R20N"], ["R23N"], ["Q"]);
    expect(trips.length).toBe(0);
  });
});

describe("getServiceAlerts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns active alerts", async () => {
    const now = Math.floor(Date.now() / 1000);
    const buffer = encodeFeed([
      {
        id: "alert-1",
        alert: Alert.create({
          informedEntity: [
            EntitySelector.create({ routeId: "Q" }),
          ],
          activePeriod: [
            TimeRange.create({ start: now - 3600, end: now + 3600 }),
          ],
          headerText: TranslatedString.create({
            translation: [{ text: "Q delays", language: "en" }],
          }),
          descriptionText: TranslatedString.create({
            translation: [{ text: "Signal problems", language: "en" }],
          }),
          cause: Alert.Cause.TECHNICAL_PROBLEM,
          effect: Alert.Effect.SIGNIFICANT_DELAYS,
          severityLevel: Alert.SeverityLevel.WARNING,
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const alerts = await getServiceAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].id).toBe("alert-1");
    expect(alerts[0].headerText).toBe("Q delays");
    expect(alerts[0].descriptionText).toBe("Signal problems");
    expect(alerts[0].cause).toBe("Technical Problem");
    expect(alerts[0].effect).toBe("Significant Delays");
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].routeIds).toEqual(["Q"]);
  });

  it("filters by route ID", async () => {
    const now = Math.floor(Date.now() / 1000);
    const buffer = encodeFeed([
      {
        id: "alert-q",
        alert: Alert.create({
          informedEntity: [EntitySelector.create({ routeId: "Q" })],
          activePeriod: [TimeRange.create({ start: now - 3600, end: now + 3600 })],
          headerText: TranslatedString.create({ translation: [{ text: "Q alert" }] }),
        }),
      },
      {
        id: "alert-a",
        alert: Alert.create({
          informedEntity: [EntitySelector.create({ routeId: "A" })],
          activePeriod: [TimeRange.create({ start: now - 3600, end: now + 3600 })],
          headerText: TranslatedString.create({ translation: [{ text: "A alert" }] }),
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const alerts = await getServiceAlerts({ routeIds: ["Q"] });
    expect(alerts.length).toBe(1);
    expect(alerts[0].headerText).toBe("Q alert");
  });

  it("filters out expired alerts", async () => {
    const now = Math.floor(Date.now() / 1000);
    const buffer = encodeFeed([
      {
        id: "alert-expired",
        alert: Alert.create({
          informedEntity: [EntitySelector.create({ routeId: "Q" })],
          activePeriod: [TimeRange.create({ start: now - 7200, end: now - 3600 })],
          headerText: TranslatedString.create({ translation: [{ text: "Old alert" }] }),
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const alerts = await getServiceAlerts();
    expect(alerts.length).toBe(0);
  });

  it("includes alerts with no active periods", async () => {
    const buffer = encodeFeed([
      {
        id: "alert-no-period",
        alert: Alert.create({
          informedEntity: [EntitySelector.create({ routeId: "Q" })],
          headerText: TranslatedString.create({ translation: [{ text: "No period" }] }),
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const alerts = await getServiceAlerts();
    expect(alerts.length).toBe(1);
  });

  it("filters by stop IDs", async () => {
    const now = Math.floor(Date.now() / 1000);
    const buffer = encodeFeed([
      {
        id: "alert-stop",
        alert: Alert.create({
          informedEntity: [EntitySelector.create({ stopId: "R20N" })],
          activePeriod: [TimeRange.create({ start: now - 3600, end: now + 3600 })],
          headerText: TranslatedString.create({ translation: [{ text: "Stop alert" }] }),
        }),
      },
      {
        id: "alert-other-stop",
        alert: Alert.create({
          informedEntity: [EntitySelector.create({ stopId: "999N" })],
          activePeriod: [TimeRange.create({ start: now - 3600, end: now + 3600 })],
          headerText: TranslatedString.create({ translation: [{ text: "Other stop" }] }),
        }),
      },
    ]);
    mockFetchWithBuffer(buffer);

    const alerts = await getServiceAlerts({ stopIds: ["R20N", "R20S"] });
    expect(alerts.length).toBe(1);
    expect(alerts[0].headerText).toBe("Stop alert");
  });
});

describe("fetchFeed timeout handling", () => {
  afterEach(() => vi.restoreAllMocks());

  it("throws on fetch failure (non-200)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      }),
    );

    await expect(getArrivals(["R20N"], "Q")).rejects.toThrow("GTFS-RT fetch failed");
  });
});
