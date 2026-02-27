import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight">NYC Subway Status</h1>
      <p className="mt-2 text-muted text-sm">
        Real-time arrival times for every station and line.
      </p>

      <nav className="mt-8 flex gap-6">
        <Link href="/stops" className="text-sm font-medium">
          All Stops →
        </Link>
        <Link href="/lines" className="text-sm font-medium">
          All Lines →
        </Link>
      </nav>
    </main>
  );
}
