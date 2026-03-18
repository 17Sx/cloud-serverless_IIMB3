import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as authSchema from "../auth-schema";

const rawAuthUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:3001").replace(/\/$/, "");
const betterAuthUrl = rawAuthUrl + "/api/auth";
const oauthCallbackBase = process.env.OAUTH_CALLBACK_BASE_URL ?? rawAuthUrl;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  basePath: "/api/auth",
  baseURL: betterAuthUrl,
  plugins: [admin()],
  advanced: {
    disableOriginCheck: process.env.TRUSTED_ORIGINS === "*",
    disableCSRFCheck: process.env.TRUSTED_ORIGINS === "*",
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  socialProviders: {
    ...((process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_GOOGLE_CLIENT_ID) &&
      (process.env.GOOGLE_CLIENT_SECRET ||
        process.env.OAUTH_GOOGLE_CLIENT_SECRET) && {
        google: {
          clientId:
            process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_GOOGLE_CLIENT_ID!,
          clientSecret:
            process.env.GOOGLE_CLIENT_SECRET ||
            process.env.OAUTH_GOOGLE_CLIENT_SECRET!,
          redirectURI: `${oauthCallbackBase}/api/auth/callback/google`,
        },
      }),
    ...((process.env.GITHUB_CLIENT_ID || process.env.OAUTH_GITHUB_CLIENT_ID) &&
      (process.env.GITHUB_CLIENT_SECRET ||
        process.env.OAUTH_GITHUB_CLIENT_SECRET) && {
        github: {
          clientId:
            process.env.GITHUB_CLIENT_ID || process.env.OAUTH_GITHUB_CLIENT_ID!,
          clientSecret:
            process.env.GITHUB_CLIENT_SECRET ||
            process.env.OAUTH_GITHUB_CLIENT_SECRET!,
          redirectURI: `${oauthCallbackBase}/api/auth/callback/github`,
        },
      }),
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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const path = ctx.path ?? "";
      if (path.includes("sign-in/social")) {
        const provider =
          (ctx.body as { provider?: string })?.provider ??
          ctx.query?.provider ??
          "?";
        console.log(`[auth] Social sign-in init: provider=${provider}`);
      }
      if (path.includes("callback/google")) {
        console.log("[auth] Google OAuth callback received");
      }
      if (path.includes("callback/github")) {
        console.log("[auth] GitHub OAuth callback received");
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const path = ctx.path ?? "";
      const newSession = ctx.context?.newSession;
      if (
        (path.includes("callback/google") ||
          path.includes("callback/github")) &&
        newSession
      ) {
        const provider = path.includes("google") ? "Google" : "GitHub";
        console.log(
          `[auth] Social sign-in success: provider=${provider}, userId=${newSession.user.id}, email=${newSession.user.email}`,
        );
      }
    }),
  },
});
