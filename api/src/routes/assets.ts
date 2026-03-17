import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "../db";
import { taskAssets, tasks, projects, teamMembers } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const assetsRoutes = new Hono();

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-3" });
const bucket = process.env.S3_ASSETS_BUCKET ?? "";

async function verifyTaskAccess(userId: string, taskId: string) {
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

// POST /api/assets/upload-url — get a presigned upload URL
assetsRoutes.post("/upload-url", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const { taskId, filename } = await c.req.json();

  if (!taskId || !filename) {
    return c.json({ error: "taskId and filename required" }, 400);
  }

  if (!(await verifyTaskAccess(user.id, taskId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const s3Key = `tasks/${taskId}/${Date.now()}-${filename}`;

  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: s3Key }),
    { expiresIn: 600 }
  );

  const [asset] = await db
    .insert(taskAssets)
    .values({ taskId, s3Key, filename })
    .returning();

  return c.json({ uploadUrl: url, asset }, 201);
});

// GET /api/assets?taskId=...
assetsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const taskId = c.req.query("taskId");

  if (!taskId) {
    return c.json({ error: "taskId query parameter required" }, 400);
  }

  if (!(await verifyTaskAccess(user.id, taskId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const assets = await db.query.taskAssets.findMany({
    where: eq(taskAssets.taskId, taskId),
  });

  const assetsWithUrls = await Promise.all(
    assets.map(async (asset) => {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: asset.s3Key }),
        { expiresIn: 3600 }
      );
      return { ...asset, downloadUrl: url };
    })
  );

  return c.json({ assets: assetsWithUrls });
});

// DELETE /api/assets/:id
assetsRoutes.delete("/:id", requireAuth, async (c) => {
  const user = c.get("user") as any;
  const assetId = c.req.param("id");

  const asset = await db.query.taskAssets.findFirst({
    where: eq(taskAssets.id, assetId),
  });

  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }

  if (!(await verifyTaskAccess(user.id, asset.taskId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await s3.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: asset.s3Key })
  );

  await db.delete(taskAssets).where(eq(taskAssets.id, assetId));
  return c.json({ message: "Asset deleted" });
});
