import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const authBaseUrl = apiUrl.replace(/\/$/, "") + "/api/auth";

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
