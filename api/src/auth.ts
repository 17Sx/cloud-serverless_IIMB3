import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as authSchema from "../auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  advanced: {
    disableOriginCheck: process.env.TRUSTED_ORIGINS === "*",
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
  trustedOrigins:
    process.env.TRUSTED_ORIGINS === "*"
      ? ["*"]
      : (process.env.TRUSTED_ORIGINS ?? "http://localhost:3000")
          .split(",")
          .map((o) => o.trim()),
});
