import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";

try {
  // Load the .env file for local dev/start; on Vercel env vars are already set, so skip if the file is missing.
  process.loadEnvFile();
} catch {
  /* no .env file present, fall back to system environment variables */
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Product images are sent as base64, so the JSON payload can be fairly large.
  app.use(express.json({ limit: "10mb" }));

  if (!isProduction) {
    // Dev: Vite runs on its own port (3000) and proxies /api to this server (default 3001).
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  app.use("/api", apiRouter);

  if (isProduction) {
    // Serve static files from dist/public in production
    const staticPath = path.resolve(__dirname, "public");
    app.use(express.static(staticPath));

    // Handle client-side routing - serve index.html for all non-API routes
    app.get("*", (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }

  const port = process.env.PORT || (isProduction ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
