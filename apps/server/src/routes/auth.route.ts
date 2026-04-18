import { auth } from "@torea/auth";
import { Hono } from "hono";
import type { AppEnv } from "../types";

export const authRoute = new Hono<AppEnv>().on(["POST", "GET"], "/*", (c) =>
  auth.handler(c.req.raw),
);
