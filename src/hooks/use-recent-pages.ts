"use client";

import { useEffect } from "react";

export type RecentPageType = "stop" | "line" | "arrival";

export interface RecentPage {
  type: RecentPageType;
  stationSlug?: string;
  routeSlug?: string;
  timestamp: number;
  visitCount: number;
}

const STORAGE_KEY = "nyc-subway-recents";
const MAX_RECENTS = 20;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function dedupKey(page: Pick<RecentPage, "type" | "stationSlug" | "routeSlug">) {
  return `${page.type}:${page.stationSlug ?? ""}:${page.routeSlug ?? ""}`;
}

export function getRecentPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const pages = JSON.parse(raw) as RecentPage[];
    return pages.map((p) => ({
      ...p,
      visitCount: p.visitCount ?? 1,
    }));
  } catch {
    return [];
  }
}

export function trackRecentPage(page: Omit<RecentPage, "timestamp" | "visitCount">) {
  try {
    const existing = getRecentPages();
    const key = dedupKey(page);
    const prev = existing.find((p) => dedupKey(p) === key);
    const filtered = existing.filter((p) => dedupKey(p) !== key);
    const updated = [
      { ...page, timestamp: Date.now(), visitCount: (prev?.visitCount ?? 0) + 1 },
      ...filtered,
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently skip
  }
}

export function getScoredRecents(): RecentPage[] {
  const pages = getRecentPages();
  const now = Date.now();
  return pages
    .map((p) => {
      const frequencyScore = Math.min(p.visitCount / 5, 1);
      const recencyScore = Math.max(0, 1 - (now - p.timestamp) / SEVEN_DAYS_MS);
      const score = frequencyScore * 0.6 + recencyScore * 0.4;
      return { page: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.page);
}

export function useTrackRecentPage(page: Omit<RecentPage, "timestamp" | "visitCount">) {
  useEffect(() => {
    trackRecentPage(page);
  }, [page.type, page.stationSlug, page.routeSlug]);
}
