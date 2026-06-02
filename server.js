// Custom server entry point for Hostinger managed Node.js hosting.
// Hostinger (Passenger) sets PORT automatically.
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev });
const handle = app.getRequestHandler();

// Prevent unhandled promise rejections (e.g. MongoDB connect timeout) from
// crashing the Passenger worker — log and continue serving with defaults.
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection (non-fatal):", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[server] Uncaught exception (non-fatal):", err);
});

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, "0.0.0.0", () => {
      console.log(`> FTPR Lions ready on port ${port} [${dev ? "dev" : "production"}]`);
    });
  })
  .catch((err) => {
    console.error("[server] Failed to start Next.js:", err);
    process.exit(1);
  });
