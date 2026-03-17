/// <reference types="bun-types" />
import type { Config } from "drizzle-kit";

export default {
  schema: ["./src/db/schema.ts", "./auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
  