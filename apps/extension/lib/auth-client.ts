import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "https://api.torea.app",
  fetchOptions: {
    credentials: "include",
  },
});
