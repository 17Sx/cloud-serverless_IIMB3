import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { projects, teamMembers } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const projectsRoutes = new Hono();

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

async function isTeamMember(userId: string, teamId: string): Promise<boolean> {
  const m = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
  });
  return !!m;
}

// POST /api/projects (body: { teamId, name, description })
projectsRoutes.post("/", requireAuth, zValidator("json", createProjectSchema.extend({ teamId: z.string().uuid() })), async (c) => {
  const user = c.get("user") as any;
  const { teamId, name, description } = c.req.valid("json");

  if (!(await isTeamMember(user.id, teamId))) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  const [project] = await db
    .insert(projects)
    .values({ teamId, name, description })
    .returning();

  return c.json({ project }, 201);
});

// GET /api/projects?teamId=...
projectsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const teamId = c.req.query("teamId");

  if (!teamId) {
    return c.json({ error: "teamId query parameter required" }, 400);
  }

  if (!(await isTeamMember(user.id, teamId))) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  const result = await db.query.projects.findMany({
    where: eq(projects.teamId, teamId),
  });

  return c.json({ projects: result });
});

// GET /api/projects/:id
projectsRoutes.get("/:id", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const projectId = c.req.param("id");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { tasks: true },
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  if (!(await isTeamMember(user.id, project.teamId))) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  return c.json({ project });
});

// PATCH /api/projects/:id
projectsRoutes.patch("/:id", requireAuth, zValidator("json", updateProjectSchema), async (c) => {
  const user = c.get("user") as any;
  const projectId = c.req.param("id");
  const body = c.req.valid("json");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  if (!(await isTeamMember(user.id, project.teamId))) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  const [updated] = await db
    .update(projects)
    .set(body)
    .where(eq(projects.id, projectId))
    .returning();

  return c.json({ project: updated });
});

// DELETE /api/projects/:id
projectsRoutes.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const projectId = c.req.param("id");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  if (!(await isTeamMember(user.id, project.teamId))) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  await db.delete(projects).where(eq(projects.id, projectId));
  return c.json({ message: "Project deleted" });
});
