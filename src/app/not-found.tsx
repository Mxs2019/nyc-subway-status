import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <PageHeader title="Page Not Found" backHref="/" backLabel="Home" />

      <p className="text-muted text-sm">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>

      <nav className="mt-6 flex flex-col gap-3">
        <a href="/" className="text-sm no-underline hover:opacity-70">
          Search stations and lines →
        </a>
        <a href="/stops" className="text-sm no-underline hover:opacity-70">
          All Stops →
        </a>
        <a href="/lines" className="text-sm no-underline hover:opacity-70">
          All Lines →
        </a>
      </nav>
    </main>
  );
}
