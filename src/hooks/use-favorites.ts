"use client";

import { useState, useEffect, useCallback } from "react";

export interface FavoriteStation {
  stationSlug: string;
  addedAt: number;
}

const STORAGE_KEY = "nyc-subway-favorites";
const MAX_FAVORITES = 10;

function getFavorites(): FavoriteStation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FavoriteStation[];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: FavoriteStation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // localStorage unavailable
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteStation[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  const isFavorite = useCallback(
    (stationSlug: string) => favorites.some((f) => f.stationSlug === stationSlug),
    [favorites],
  );

  const toggleFavorite = useCallback((stationSlug: string) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.stationSlug === stationSlug);
      let next: FavoriteStation[];
      if (exists) {
        next = prev.filter((f) => f.stationSlug !== stationSlug);
      } else {
        next = [{ stationSlug, addedAt: Date.now() }, ...prev].slice(0, MAX_FAVORITES);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
