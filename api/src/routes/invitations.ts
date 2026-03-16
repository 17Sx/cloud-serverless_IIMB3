import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { invitations, teamMembers } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const invitationsRoutes = new Hono();

// GET /api/invitations
invitationsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user") as any;

  const pending = await db.query.invitations.findMany({
    where: and(
      eq(invitations.email, user.email),
      eq(invitations.status, "pending")
    ),
    with: { team: true },
  });

  return c.json({ invitations: pending });
});

// POST /api/invitations/:id/accept
invitationsRoutes.post("/:id/accept", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const invitationId = c.req.param("id");

  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.id, invitationId),
      eq(invitations.email, user.email),
      eq(invitations.status, "pending")
    ),
  });

  if (!invitation) {
    return c.json({ error: "Invitation not found" }, 404);
  }

  await db
    .update(invitations)
    .set({ status: "accepted" })
    .where(eq(invitations.id, invitationId));

  await db.insert(teamMembers).values({
    teamId: invitation.teamId,
    userId: user.id,
    role: "member",
  });

  return c.json({ message: "Invitation accepted" });
});

// POST /api/invitations/:id/decline
invitationsRoutes.post("/:id/decline", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const invitationId = c.req.param("id");

  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.id, invitationId),
      eq(invitations.email, user.email),
      eq(invitations.status, "pending")
    ),
  });

  if (!invitation) {
    return c.json({ error: "Invitation not found" }, 404);
  }

  await db
    .update(invitations)
    .set({ status: "declined" })
    .where(eq(invitations.id, invitationId));

  return c.json({ message: "Invitation declined" });
});
