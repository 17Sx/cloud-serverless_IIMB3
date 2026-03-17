import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as authSchema from "../auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  basePath: "/api/auth",
  baseURL: (process.env.BETTER_AUTH_URL ?? "http://localhost:3001").replace(
    /\/(dev|prd)\/?$/,
    "",
  ),
  plugins: [admin()],
  advanced: {
    disableOriginCheck: process.env.TRUSTED_ORIGINS === "*",
    disableCSRFCheck: process.env.TRUSTED_ORIGINS === "*",
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
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
