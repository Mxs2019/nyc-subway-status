"use client";

import { useState } from "react";
import { useFuzzySearch } from "@/hooks/use-fuzzy-search";

interface SearchFilterProps<T extends object> {
  items: T[];
  fields: string[];
  idField?: string;
  children: (filteredItems: T[]) => React.ReactNode;
  placeholder?: string;
}

export function SearchFilter<T extends object>({
  items,
  fields,
  idField = "id",
  children,
  placeholder = "Search...",
}: SearchFilterProps<T>) {
  const [query, setQuery] = useState("");

  const { items: filtered } = useFuzzySearch(items, fields, query, idField);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:border-foreground"
      />
      <div className="mt-4">{children(filtered)}</div>
    </div>
  );
}
