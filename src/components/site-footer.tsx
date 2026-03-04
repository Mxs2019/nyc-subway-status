export function SiteFooter() {
  return (
    <footer className="max-w-2xl mx-auto px-4 mt-12 pb-8 pt-4 border-t border-border flex flex-wrap gap-4">
      <a href="/" className="text-xs text-muted hover:text-foreground transition-colors">
        Home
      </a>
      <a href="/faq" className="text-xs text-muted hover:text-foreground transition-colors">
        FAQ
      </a>
      <a href="/docs" className="text-xs text-muted hover:text-foreground transition-colors">
        API Docs
      </a>
      <a href="/llms.txt" className="text-xs text-muted hover:text-foreground transition-colors">
        llms.txt
      </a>
      <a href="/about" className="text-xs text-muted hover:text-foreground transition-colors">
        About
      </a>
      <a href="/docs#mcp-server" className="text-xs text-muted hover:text-foreground transition-colors">
        MCP
      </a>
    </footer>
  );
}
