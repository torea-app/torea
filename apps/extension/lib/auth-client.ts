import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "https://3000.mydevbox.pp.ua",
  fetchOptions: {
    credentials: "include",
  },
});
