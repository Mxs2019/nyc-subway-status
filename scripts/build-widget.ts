/**
 * Build the MCP App widget — bundles src/widget/app.ts into a single
 * self-contained HTML file with inlined JS and CSS at src/widget/dist/widget.html.
 */

import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";

const ROOT = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), "..");
const WIDGET_DIR = path.join(ROOT, "src", "widget");
const DIST_DIR = path.join(WIDGET_DIR, "dist");
const TEMPLATE = path.join(WIDGET_DIR, "template.html");
const ENTRY = path.join(WIDGET_DIR, "app.ts");

export function injectWidgetJs(template: string, js: string): string {
  return template.replace("/* __WIDGET_JS__ */", () => js);
}

async function build() {
  // Bundle TS → JS (single file, no external deps)
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    minify: true,
    sourcemap: false,
  });

  const js = result.outputFiles[0].text;
  const template = fs.readFileSync(TEMPLATE, "utf-8");

  // Inject JS into the HTML template
  const html = injectWidgetJs(template, js);

  fs.mkdirSync(DIST_DIR, { recursive: true });
  const outPath = path.join(DIST_DIR, "widget.html");
  fs.writeFileSync(outPath, html, "utf-8");

  const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`✓ Widget built: ${outPath} (${sizeKB} KB)`);
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntrypoint) {
  build().catch((err) => {
    console.error("Widget build failed:", err);
    process.exit(1);
  });
}
