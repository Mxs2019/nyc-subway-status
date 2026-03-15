import { describe, it, expect } from "vitest";
import { formatArrival, formatAlert } from "./api-helpers";
import type { Arrival, ServiceAlert } from "./gtfsrt";

describe("formatArrival", () => {
  const baseArrival: Arrival = {
    routeId: "Q",
    tripId: "trip-123",
    directionId: 0,
    stopId: "R20N",
    arrivalTime: 1700000100,
    headsign: "Astoria-Ditmars Blvd",
  };

  it("formats uptown arrival with minutes away", () => {
    const now = 1700000000; // 100 seconds before arrival
    const result = formatArrival(baseArrival, now);

    expect(result.route_id).toBe("Q");
    expect(result.trip_id).toBe("trip-123");
    expect(result.headsign).toBe("Astoria-Ditmars Blvd");
    expect(result.direction).toBe("uptown");
    expect(result.minutes_away).toBe(2); // ceil(100/60)
    expect(result.arrival_time).toBe(1700000100);
    expect(result.arrival_time_iso).toContain("T");
  });

  it("formats downtown arrival", () => {
    const downtown: Arrival = { ...baseArrival, directionId: 1 };
    const result = formatArrival(downtown, 1700000000);
    expect(result.direction).toBe("downtown");
  });

  it("clamps negative minutes to 0", () => {
    // arrival is in the past
    const result = formatArrival(baseArrival, 1700000200);
    expect(result.minutes_away).toBe(0);
  });

  it("returns 0 minutes for same-second arrival", () => {
    const result = formatArrival(baseArrival, baseArrival.arrivalTime);
    expect(result.minutes_away).toBe(0);
  });

  it("converts arrival_time_iso to valid ISO string", () => {
    const result = formatArrival(baseArrival, 1700000000);
    expect(() => new Date(result.arrival_time_iso)).not.toThrow();
    expect(new Date(result.arrival_time_iso).getTime()).toBe(1700000100 * 1000);
  });
});

describe("formatAlert", () => {
  const baseAlert: ServiceAlert = {
    id: "alert-1",
    headerText: "Delays on the Q line",
    descriptionText: "Due to signal problems.",
    cause: "Technical Problem",
    effect: "Significant Delays",
    severity: "warning",
    routeIds: ["Q", "N"],
    stopIds: ["R20N", "R20S"],
    activePeriods: [
      { start: 1700000000, end: 1700003600 },
    ],
  };

  it("formats alert with all fields", () => {
    const result = formatAlert(baseAlert);

    expect(result.id).toBe("alert-1");
    expect(result.header).toBe("Delays on the Q line");
    expect(result.description).toBe("Due to signal problems.");
    expect(result.cause).toBe("Technical Problem");
    expect(result.effect).toBe("Significant Delays");
    expect(result.severity).toBe("warning");
    expect(result.route_ids).toEqual(["Q", "N"]);
    expect(result.stop_ids).toEqual(["R20N", "R20S"]);
  });

  it("converts active periods to ISO strings", () => {
    const result = formatAlert(baseAlert);
    expect(result.active_periods).toHaveLength(1);
    expect(result.active_periods[0].start).toContain("T");
    expect(result.active_periods[0].end).toContain("T");
  });

  it("handles null start/end in active periods", () => {
    const alert: ServiceAlert = {
      ...baseAlert,
      activePeriods: [{ start: null, end: null }],
    };
    const result = formatAlert(alert);
    expect(result.active_periods[0].start).toBeNull();
    expect(result.active_periods[0].end).toBeNull();
  });

  it("handles empty active periods", () => {
    const alert: ServiceAlert = { ...baseAlert, activePeriods: [] };
    const result = formatAlert(alert);
    expect(result.active_periods).toEqual([]);
  });
});
