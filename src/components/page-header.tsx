interface PageHeaderProps {
  title: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function PageHeader({
  title,
  backHref,
  backLabel,
  children,
  trailing,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        {backHref && (
          <a href={backHref} className="text-muted text-xs no-underline">
            ← {backLabel || "Back"}
          </a>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {trailing}
      </div>
    </header>
  );
}
