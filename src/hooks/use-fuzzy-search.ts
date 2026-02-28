"use client";

import { useMemo } from "react";
import MiniSearch from "minisearch";

const ABBREVIATIONS: Record<string, string> = {
  street: "st",
  avenue: "av",
  ave: "av",
  square: "sq",
  boulevard: "blvd",
  parkway: "pkwy",
};

function processTerm(term: string): string | false {
  const lower = term.toLowerCase();
  if (!lower) return false;

  // Strip ordinal suffixes from numbers: "72nd" → "72", "1st" → "1"
  const stripped = lower.replace(/^(\d+)(st|nd|rd|th)$/i, "$1");
  if (stripped !== lower) return stripped;

  return ABBREVIATIONS[lower] || lower;
}

export interface FuzzySearchResult<T> {
  items: T[];
  topScore: number;
}

export function useFuzzySearch<T extends object>(
  items: T[],
  fields: string[],
  query: string,
  idField: string = "id",
): FuzzySearchResult<T> {
  const fieldsKey = fields.join(",");

  const index = useMemo(() => {
    const ms = new MiniSearch<T>({
      fields,
      idField,
      processTerm,
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        combineWith: "AND",
      },
    });
    ms.addAll(items);
    return ms;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, fieldsKey, idField]);

  return useMemo(() => {
    if (!query.trim()) return { items, topScore: 0 };

    const results = index.search(query);
    const itemMap = new Map(
      items.map((item) => [(item as Record<string, unknown>)[idField], item]),
    );

    const filtered = results
      .map((r) => itemMap.get(r.id))
      .filter((item): item is T => item != null);

    return { items: filtered, topScore: results[0]?.score ?? 0 };
  }, [query, index, items, idField]);
}
