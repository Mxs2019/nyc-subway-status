"use client";

import { useFavorites } from "@/hooks/use-favorites";

interface FavoriteButtonProps {
  stationSlug: string;
}

export function FavoriteButton({ stationSlug }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(stationSlug);

  return (
    <button
      onClick={() => toggleFavorite(stationSlug)}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      className="text-lg leading-none hover:opacity-70 transition cursor-pointer"
    >
      {favorited ? "★" : "☆"}
    </button>
  );
}
