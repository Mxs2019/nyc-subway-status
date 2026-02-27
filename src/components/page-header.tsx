import Link from "next/link";

interface PageHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  backHref,
  backLabel,
  children,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        {backHref && (
          <Link href={backHref} className="text-muted text-xs no-underline">
            ← {backLabel || "Back"}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </div>
    </header>
  );
}
