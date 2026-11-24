import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { authProvider, supabasePublicConfig } from "./lib/supabase-auth";
import path from "node:path";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
if (authProvider() === 'clerk') app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/auth/config", (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (authProvider() === 'clerk') { res.json({ provider: 'clerk' }); return; }
  try { res.json(supabasePublicConfig()); }
  catch { res.status(503).json({ error: 'Supabase authentication is not configured' }); }
});

if (authProvider() === 'clerk') app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: 'API route not found' }); });

// Railway can serve the frontend and API on the same origin/PORT. The Replit
// artifact router remains unchanged unless this explicit deployment flag is set.
if (process.env.SERVE_WEB === 'true') {
  const webRoot = path.resolve(process.cwd(), 'artifacts/renal-cancer-study/dist/public');
  app.use(express.static(webRoot, { index: false, dotfiles: 'deny' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || path.extname(req.path)) { next(); return; }
    res.sendFile(path.join(webRoot, 'index.html'));
  });
}

export default app;
