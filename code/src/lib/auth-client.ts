import { createAuthClient } from "better-auth/react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const authBaseUrl = apiUrl.replace(/\/$/, "") + "/api/auth";

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
});

export const { signIn, signUp, signOut, useSession } = authClient;
