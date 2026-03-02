import { execSync, spawn, type ChildProcess } from "child_process";

const PORT = 3007;
const SITE = `http://localhost:${PORT}`;

function log(msg: string) {
  console.log(`\n🔍 ${msg}`);
}

function killServer(server: ChildProcess) {
  server.kill("SIGTERM");
  // Also kill anything on the port in case of orphans
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {
    // Port already free
  }
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(SITE);
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${timeoutMs / 1000}s`);
}

async function main() {
  // Kill anything already on the port
  try {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {
    // Nothing running
  }

  // Build
  log("Building production app...");
  execSync("pnpm run build", { stdio: "inherit" });

  // Start server
  log(`Starting production server on port ${PORT}...`);
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: "pipe",
    detached: false,
  });

  server.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(msg);
  });

  try {
    await waitForServer();
    log(`Server ready at ${SITE}`);

    // Run unlighthouse
    log("Running Unlighthouse SEO audit (this may take a few minutes)...");
    execSync(
      `npx unlighthouse-ci --site ${SITE} --reporter jsonExpanded --build-static`,
      { stdio: "inherit" }
    );

    log("Audit complete! Reports saved to .unlighthouse/");
    log("Open .unlighthouse/index.html in your browser to view the report.");
  } finally {
    log("Shutting down server...");
    killServer(server);
  }
}

main().catch((err) => {
  console.error("SEO audit failed:", err);
  process.exit(1);
});
