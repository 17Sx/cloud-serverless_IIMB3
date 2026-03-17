import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { usersRoutes } from "./routes/users";
import { teamsRoutes } from "./routes/teams";
import { invitationsRoutes } from "./routes/invitations";
import { projectsRoutes } from "./routes/projects";
import { tasksRoutes } from "./routes/tasks";
import { assetsRoutes } from "./routes/assets";
import { adminRoutes } from "./routes/admin";

const app = new Hono();

const rawOrigins = process.env.TRUSTED_ORIGINS ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin:
      rawOrigins === "*"
        ? (origin) => origin
        : rawOrigins.split(",").map((o) => o.trim()),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use("*", logger());

// Retirer /dev, /prd, /staging du path pour better-auth (API Gateway met le stage dans l'URL)
const STRIP_STAGE = /^\/(dev|prd|staging)\//;
app.on(["POST", "GET", "OPTIONS"], "/api/auth/**", async (c) => {
  const url = new URL(c.req.url);
  const originalPath = url.pathname;
  url.pathname = url.pathname.replace(STRIP_STAGE, "/");
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && originalPath !== url.pathname) {
    console.log("[auth] path rewritten:", originalPath, "->", url.pathname);
  }
  const req = new Request(url.toString(), {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
  });
  const res = await auth.handler(req);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && res.status === 404) {
    console.log("[auth] better-auth returned 404 for:", url.pathname);
  }
  return res;
});

// API routes
app.route("/api/users", usersRoutes);
app.route("/api/teams", teamsRoutes);
app.route("/api/invitations", invitationsRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/assets", assetsRoutes);
app.route("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Retirer /dev, /prd, /staging du path (API Gateway met le stage dans l'URL)
const honoHandler = handle(app);

export const handler: typeof honoHandler = async (event, context) => {
  const ev = event as unknown as {
    path?: string;
    rawPath?: string;
    requestContext?: Record<string, unknown>;
  };
  const pathToCheck = ev.rawPath ?? ev.path;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && typeof pathToCheck === "string") {
    console.log("[lambda] incoming path:", pathToCheck);
  }
  if (typeof pathToCheck === "string" && STRIP_STAGE.test(pathToCheck)) {
    const newPath = pathToCheck.replace(STRIP_STAGE, "/");
    (ev as Record<string, unknown>).path = newPath;
    (ev as Record<string, unknown>).rawPath = newPath;
    const ctx = ev.requestContext as Record<string, unknown> | undefined;
    if (ctx) {
      ctx.path = newPath;
      ctx.resourcePath = newPath;
      const http = ctx.http as Record<string, unknown> | undefined;
      if (http) http.path = newPath;
    }
  }
  return honoHandler(event, context);
};

// Démarrer le serveur uniquement en local (pas sur Lambda)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const port = Number(process.env.PORT ?? 3001);
  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`API server running on http://localhost:${server.port}`);
}

export default app;
