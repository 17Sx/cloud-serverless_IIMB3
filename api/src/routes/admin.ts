import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { teams, projects, tasks } from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import { auth } from "../auth";

export const adminRoutes = new Hono();

// GET /api/admin/stats
adminRoutes.get("/stats", requireAdmin, async (c) => {
  const [teamCount] = await db.select({ count: sql<number>`count(*)` }).from(teams);
  const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
  const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks);

  const users = await auth.api.listUsers({
    query: { limit: 1 },
    headers: c.req.raw.headers,
  });

  return c.json({
    stats: {
      users: (users as any)?.total ?? 0,
      teams: Number(teamCount.count),
      projects: Number(projectCount.count),
      tasks: Number(taskCount.count),
    },
  });
});

// GET /api/admin/users
adminRoutes.get("/users", requireAdmin, async (c) => {
  const page = Number(c.req.query("page") ?? "1");
  const limit = Number(c.req.query("limit") ?? "50");

  const users = await auth.api.listUsers({
    query: { limit, offset: (page - 1) * limit },
    headers: c.req.raw.headers,
  });

  return c.json({ users });
});
