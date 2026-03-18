import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), "../.env") });

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import postgres from "postgres";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-3" });

const BACKUP_BUCKET_DEV = process.env.S3_BACKUP_BUCKET_DEV ?? process.env.S3_ASSETS_BUCKET_DEV ?? "";
const BACKUP_BUCKET_PRD = process.env.S3_BACKUP_BUCKET_PRD ?? process.env.S3_ASSETS_BUCKET_PRD ?? "";

const TABLES = [
  "user",
  "teams",
  "team_members",
  "invitations",
  "projects",
  "tasks",
  "task_assets",
];

async function backupDatabase(databaseUrl: string, dbLabel: string, bucketName: string): Promise<void> {
  const sql = postgres(databaseUrl, { ssl: false, max: 2 });

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const datePrefix = now.toISOString().split("T")[0];

  const backup: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    try {
      const rows = await sql`SELECT * FROM ${sql(table)}`;
      backup[table] = rows;
      console.log(`[cron] ${dbLabel}.${table}: ${rows.length} rows`);
    } catch (err) {
      console.error(`[cron] Skipping ${dbLabel}.${table}:`, (err as Error).message);
      backup[table] = [];
    }
  }

  const filename = `backup-${timestamp}-${dbLabel}.json`;
  const s3Key = `backups/${datePrefix}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: JSON.stringify(backup, null, 2),
      ContentType: "application/json",
    }),
  );

  // Enregistre le backup dans la table de tracking
  await sql`
    INSERT INTO backups (id, s3_key, filename)
    VALUES (gen_random_uuid(), ${s3Key}, ${filename})
  `;

  await sql.end();
  console.log(`[cron] Backup ${dbLabel} → s3://${bucketName}/${s3Key}`);
}

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
  console.log("[cron] Starting hourly database backups...");

  const dbDev = process.env.DATABASE_URL_DEV ?? "";
  const dbPrd = process.env.DATABASE_URL_PRD ?? "";

  const jobs: Array<Promise<void>> = [];

  if (dbDev && BACKUP_BUCKET_DEV) jobs.push(backupDatabase(dbDev, "dev", BACKUP_BUCKET_DEV));
  else console.warn("[cron] Skipping dev backup (DATABASE_URL_DEV or S3_BACKUP_BUCKET_DEV not set)");

  if (dbPrd && BACKUP_BUCKET_PRD) jobs.push(backupDatabase(dbPrd, "prd", BACKUP_BUCKET_PRD));
  else console.warn("[cron] Skipping prd backup (DATABASE_URL_PRD or S3_BACKUP_BUCKET_PRD not set)");

  const results = await Promise.allSettled(jobs);

  let failed = 0;
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[cron] Backup error:", result.reason);
      failed++;
    }
  }

  const body = failed === 0 ? "All backups complete" : `${failed} backup(s) failed`;
  console.log(`[cron] Done. ${body}`);
  return { statusCode: failed === 0 ? 200 : 500, body };
};

// Auto-invoke en dehors de Lambda (test local)
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  handler().then((r) => console.log("[cron] Result:", r)).catch(console.error);
}
