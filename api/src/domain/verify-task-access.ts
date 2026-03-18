import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { tasks, projects, teamMembers } from "../db/schema";

/**
 * Verify that a user has access to a task (via team membership).
 * Returns the task if access is granted, null otherwise.
 */
export async function verifyTaskAccess(userId: string, taskId: string) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
  if (!task) return null;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, task.projectId),
  });
  if (!project) return null;

  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.teamId, project.teamId),
      eq(teamMembers.userId, userId)
    ),
  });
  return member ? task : null;
}
