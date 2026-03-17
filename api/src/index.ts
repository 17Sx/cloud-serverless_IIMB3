import { config } from "dotenv";
import path from "path";

// Charger .env racine en dev local (credentials AWS, S3_ASSETS_BUCKET, etc.)
config({ path: path.resolve(process.cwd(), "../.env") });

// Validation des variables critiques en dev local
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const required = ["DATABASE_URL", "S3_ASSETS_BUCKET"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`[api] Warning: missing env: ${missing.join(", ")}`);
  }
}

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

app.on(["POST", "GET", "OPTIONS"], "/api/auth/**", async (c) => {
  const hasBody = c.req.method !== "GET" && c.req.method !== "HEAD";
  let body: ArrayBuffer | undefined;
  if (hasBody && c.req.raw.body) {
    body = await c.req.arrayBuffer();
  }
  const req = new Request(c.req.url, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body,
  });
  try {
    return await auth.handler(req);
  } catch (err) {
    console.error("[auth] error:", err);
    throw err;
  }
});

// API routes
app.route("/api/users", usersRoutes);
app.route("/api/teams", teamsRoutes);
app.route("/api/invitations", invitationsRoutes);
app.route("/api/projects", projectsRoutes);
app.route("/api/tasks", tasksRoutes);
app.route("/api/assets", assetsRoutes);
app.route("/api/admin", adminRoutes);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.onError((err, c) => {
  console.error("[app] error:", err);
  const allowOrigin =
    rawOrigins === "*"
      ? c.req.header("Origin") ?? "*"
      : rawOrigins.split(",").map((o) => o.trim())[0] ?? "*";
  return c.json(
    { error: "Internal Server Error" },
    500,
    {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  );
});

// API Gateway ajoute /dev ou /prd au path — on le retire avant que Hono ne route
const STRIP_STAGE = /^\/(dev|prd)\//;
const honoHandler = handle(app);

export const handler: typeof honoHandler = async (event, context) => {
  const ev = event as unknown as {
    path?: string;
    rawPath?: string;
    requestContext?: Record<string, unknown>;
  };
  const pathToCheck = ev.rawPath ?? ev.path;
  if (typeof pathToCheck === "string" && STRIP_STAGE.test(pathToCheck)) {
    const cleaned = pathToCheck.replace(STRIP_STAGE, "/");
    (ev as Record<string, unknown>).path = cleaned;
    (ev as Record<string, unknown>).rawPath = cleaned;
    const ctx = ev.requestContext as Record<string, unknown> | undefined;
    if (ctx) {
      ctx.path = cleaned;
      ctx.resourcePath = cleaned;
      const http = ctx.http as Record<string, unknown> | undefined;
      if (http) http.path = cleaned;
    }
  }
  return honoHandler(event, context);
};

if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const port = Number(process.env.PORT ?? 3001);
  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`API server running on http://localhost:${server.port}`);
}

export default app;
