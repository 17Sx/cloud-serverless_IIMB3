import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { teams, teamMembers, invitations } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const teamsRoutes = new Hono();

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
});

const inviteSchema = z.object({
  email: z.string().email(),
});

// POST /api/teams
teamsRoutes.post("/", requireAuth, zValidator("json", createTeamSchema), async (c) => {
  const user = c.get("user") as any;
  const { name } = c.req.valid("json");

  const [team] = await db
    .insert(teams)
    .values({ name, ownerId: user.id })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: "owner",
  });

  return c.json({ team }, 201);
});

// GET /api/teams
teamsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user") as any;

  const memberships = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, user.id),
    with: { team: true },
  });

  return c.json({ teams: memberships.map((m) => ({ ...m.team, role: m.role })) });
});

// GET /api/teams/:id
teamsRoutes.get("/:id", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const teamId = c.req.param("id");

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)),
  });

  if (!membership) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      members: {
        with: {
          user: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });

  return c.json({ team });
});

// POST /api/teams/:id/invite
teamsRoutes.post("/:id/invite", requireAuth, zValidator("json", inviteSchema), async (c) => {
  const user = c.get("user") as any;
  const teamId = c.req.param("id");
  const { email } = c.req.valid("json");

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id)),
  });

  if (!membership) {
    return c.json({ error: "Not a member of this team" }, 403);
  }

  const existing = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.teamId, teamId),
      eq(invitations.email, email),
      eq(invitations.status, "pending")
    ),
  });

  if (existing) {
    return c.json({ error: "Invitation already pending" }, 409);
  }

  const [invitation] = await db
    .insert(invitations)
    .values({ teamId, email, invitedBy: user.id })
    .returning();

  return c.json({ invitation }, 201);
});
