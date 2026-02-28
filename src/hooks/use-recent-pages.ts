"use client";

import { useEffect } from "react";

export type RecentPageType = "stop" | "line" | "arrival";

export interface RecentPage {
  type: RecentPageType;
  stationSlug?: string;
  routeSlug?: string;
  timestamp: number;
}

const STORAGE_KEY = "nyc-subway-recents";
const MAX_RECENTS = 10;

function dedupKey(page: Pick<RecentPage, "type" | "stationSlug" | "routeSlug">) {
  return `${page.type}:${page.stationSlug ?? ""}:${page.routeSlug ?? ""}`;
}

export function getRecentPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentPage[];
  } catch {
    return [];
  }
}

export function trackRecentPage(page: Omit<RecentPage, "timestamp">) {
  try {
    const existing = getRecentPages();
    const key = dedupKey(page);
    const filtered = existing.filter((p) => dedupKey(p) !== key);
    const updated = [{ ...page, timestamp: Date.now() }, ...filtered].slice(
      0,
      MAX_RECENTS
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function useTrackRecentPage(page: Omit<RecentPage, "timestamp">) {
  useEffect(() => {
    trackRecentPage(page);
  }, [page.type, page.stationSlug, page.routeSlug]);
}
