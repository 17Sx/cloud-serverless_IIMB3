import { Hono } from "hono";
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
    origin: rawOrigins === "*" ? (origin) => origin : rawOrigins.split(",").map((o) => o.trim()),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use("*", logger());

// Better Auth handler
app.on(["POST", "GET", "OPTIONS"], "/api/auth/**", (c) =>
  auth.handler(c.req.raw)
);

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

const port = Number(process.env.PORT ?? 3001);

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`API server running on http://localhost:${server.port}`);

export default app;
