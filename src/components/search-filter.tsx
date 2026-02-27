"use client";

import { useState } from "react";

interface SearchFilterProps<T> {
  items: T[];
  filterFn: (item: T, query: string) => boolean;
  children: (filteredItems: T[]) => React.ReactNode;
  placeholder?: string;
}

export function SearchFilter<T>({
  items,
  filterFn,
  children,
  placeholder = "Search...",
}: SearchFilterProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? items.filter((item) => filterFn(item, query.toLowerCase()))
    : items;

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
