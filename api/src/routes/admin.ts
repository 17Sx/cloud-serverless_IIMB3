import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { db } from "../db";
import {
  teams,
  teamMembers,
  projects,
  tasks,
  invitations,
} from "../db/schema";
import { requireAdmin } from "../middleware/auth";
import { auth } from "../auth";

export const adminRoutes = new Hono();

// ── Stats ──

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

// ── Users ──

adminRoutes.get("/users", requireAdmin, async (c) => {
  const page = Number(c.req.query("page") ?? "1");
  const limit = Number(c.req.query("limit") ?? "50");

  const users = await auth.api.listUsers({
    query: { limit, offset: (page - 1) * limit },
    headers: c.req.raw.headers,
  });

  return c.json({ users });
});

// ── Teams ──

adminRoutes.get("/teams", requireAdmin, async (c) => {
  const result = await db.query.teams.findMany({
    with: { members: true, projects: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return c.json({ teams: result });
});

adminRoutes.get("/teams/:id", requireAdmin, async (c) => {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, c.req.param("id")),
    with: { members: true, projects: true, invitations: true },
  });
  if (!team) return c.json({ error: "Team not found" }, 404);
  return c.json({ team });
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

adminRoutes.patch("/teams/:id", requireAdmin, zValidator("json", updateTeamSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!existing) return c.json({ error: "Team not found" }, 404);

  const [updated] = await db.update(teams).set(body).where(eq(teams.id, id)).returning();
  return c.json({ team: updated });
});

adminRoutes.delete("/teams/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!existing) return c.json({ error: "Team not found" }, 404);

  await db.delete(teams).where(eq(teams.id, id));
  return c.json({ message: "Team deleted" });
});

// ── Projects ──

adminRoutes.get("/projects", requireAdmin, async (c) => {
  const teamId = c.req.query("teamId");
  const result = teamId
    ? await db.query.projects.findMany({
        where: eq(projects.teamId, teamId),
        with: { team: true, tasks: true },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      })
    : await db.query.projects.findMany({
        with: { team: true, tasks: true },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      });
  return c.json({ projects: result });
});

adminRoutes.get("/projects/:id", requireAdmin, async (c) => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, c.req.param("id")),
    with: { team: true, tasks: true },
  });
  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json({ project });
});

const adminUpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  teamId: z.string().uuid().optional(),
});

adminRoutes.patch("/projects/:id", requireAdmin, zValidator("json", adminUpdateProjectSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!existing) return c.json({ error: "Project not found" }, 404);

  const [updated] = await db.update(projects).set(body).where(eq(projects.id, id)).returning();
  return c.json({ project: updated });
});

adminRoutes.delete("/projects/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!existing) return c.json({ error: "Project not found" }, 404);

  await db.delete(projects).where(eq(projects.id, id));
  return c.json({ message: "Project deleted" });
});

// ── Tasks ──

adminRoutes.get("/tasks", requireAdmin, async (c) => {
  const projectId = c.req.query("projectId");
  const result = projectId
    ? await db.query.tasks.findMany({
        where: eq(tasks.projectId, projectId),
        with: { project: true, assets: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      })
    : await db.query.tasks.findMany({
        with: { project: true, assets: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
  return c.json({ tasks: result });
});

adminRoutes.get("/tasks/:id", requireAdmin, async (c) => {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, c.req.param("id")),
    with: { project: true, assets: true },
  });
  if (!task) return c.json({ error: "Task not found" }, 404);
  return c.json({ task });
});

const adminUpdateTaskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assigneeId: z.string().nullable().optional(),
  projectId: z.string().uuid().optional(),
});

adminRoutes.patch("/tasks/:id", requireAdmin, zValidator("json", adminUpdateTaskSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!existing) return c.json({ error: "Task not found" }, 404);

  const [updated] = await db.update(tasks).set(body).where(eq(tasks.id, id)).returning();
  return c.json({ task: updated });
});

adminRoutes.delete("/tasks/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!existing) return c.json({ error: "Task not found" }, 404);

  await db.delete(tasks).where(eq(tasks.id, id));
  return c.json({ message: "Task deleted" });
});

// ── Invitations ──

adminRoutes.get("/invitations", requireAdmin, async (c) => {
  const status = c.req.query("status");
  const result = status
    ? await db.query.invitations.findMany({
        where: eq(invitations.status, status as "pending" | "accepted" | "declined"),
        with: { team: true },
        orderBy: (i, { desc }) => [desc(i.createdAt)],
      })
    : await db.query.invitations.findMany({
        with: { team: true },
        orderBy: (i, { desc }) => [desc(i.createdAt)],
      });
  return c.json({ invitations: result });
});

adminRoutes.delete("/invitations/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.invitations.findFirst({ where: eq(invitations.id, id) });
  if (!existing) return c.json({ error: "Invitation not found" }, 404);

  await db.delete(invitations).where(eq(invitations.id, id));
  return c.json({ message: "Invitation deleted" });
});
