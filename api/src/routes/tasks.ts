import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { tasks, projects, teamMembers } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const tasksRoutes = new Hono();

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const updateTaskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const statusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

const assignSchema = z.object({
  assigneeId: z.string().nullable(),
});

async function verifyProjectAccess(userId: string, projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return null;

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, project.teamId),
      eq(teamMembers.userId, userId)
    ),
  });
  return member ? project : null;
}

// POST /api/tasks
tasksRoutes.post("/", requireAuth, zValidator("json", createTaskSchema), async (c) => {
  const user = c.get("user") as any;
  const { projectId, name, description } = c.req.valid("json");

  if (!(await verifyProjectAccess(user.id, projectId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [task] = await db
    .insert(tasks)
    .values({ projectId, name, description })
    .returning();

  return c.json({ task }, 201);
});

// GET /api/tasks?projectId=...
tasksRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const projectId = c.req.query("projectId");

  if (!projectId) {
    return c.json({ error: "projectId query parameter required" }, 400);
  }

  if (!(await verifyProjectAccess(user.id, projectId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await db.query.tasks.findMany({
    where: eq(tasks.projectId, projectId),
    with: { assets: true },
  });

  return c.json({ tasks: result });
});

// PATCH /api/tasks/:id
tasksRoutes.patch("/:id", requireAuth, zValidator("json", updateTaskSchema), async (c) => {
  const user = c.get("user") as any;
  const taskId = c.req.param("id");

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (!(await verifyProjectAccess(user.id, task.projectId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = c.req.valid("json");
  const [updated] = await db
    .update(tasks)
    .set(body)
    .where(eq(tasks.id, taskId))
    .returning();

  return c.json({ task: updated });
});

// PATCH /api/tasks/:id/status
tasksRoutes.patch("/:id/status", requireAuth, zValidator("json", statusSchema), async (c) => {
  const user = c.get("user") as any;
  const taskId = c.req.param("id");
  const { status } = c.req.valid("json");

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (!(await verifyProjectAccess(user.id, task.projectId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [updated] = await db
    .update(tasks)
    .set({ status })
    .where(eq(tasks.id, taskId))
    .returning();

  return c.json({ task: updated });
});

// PATCH /api/tasks/:id/assign
tasksRoutes.patch("/:id/assign", requireAuth, zValidator("json", assignSchema), async (c) => {
  const user = c.get("user") as any;
  const taskId = c.req.param("id");
  const { assigneeId } = c.req.valid("json");

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (!(await verifyProjectAccess(user.id, task.projectId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [updated] = await db
    .update(tasks)
    .set({ assigneeId })
    .where(eq(tasks.id, taskId))
    .returning();

  return c.json({ task: updated });
});

// DELETE /api/tasks/:id
tasksRoutes.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const taskId = c.req.param("id");

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return c.json({ error: "Task not found" }, 404);
  if (!(await verifyProjectAccess(user.id, task.projectId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await db.delete(tasks).where(eq(tasks.id, taskId));
  return c.json({ message: "Task deleted" });
});
