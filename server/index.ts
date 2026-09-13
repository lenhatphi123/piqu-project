import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Ảnh sản phẩm được gửi dạng base64 nên payload JSON có thể khá lớn.
  app.use(express.json({ limit: "10mb" }));

  if (!isProduction) {
    // Dev: Vite chạy ở cổng riêng (3000) và proxy /api sang server này (mặc định 3001).
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
