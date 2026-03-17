import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { auth } from "../auth";

export const usersRoutes = new Hono();

// GET /api/users/me
usersRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user") as any;
  return c.json({ user });
});

// PATCH /api/users/me
usersRoutes.patch("/me", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const body = await c.req.json();

  const updated = await auth.api.updateUser({
    headers: c.req.raw.headers,
    body: {
      name: body.name ?? user.name,
      image: body.image ?? user.image,
    },
  });

  return c.json({ user: updated });
});
