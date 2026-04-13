import "@screenbase/env/web";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  serverExternalPackages: ["@screenbase/server"],
  allowedDevOrigins: ["3001.mydevbox.pp.ua"],
};

export default nextConfig;

initOpenNextCloudflareForDev();
