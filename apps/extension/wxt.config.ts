import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  dev: { server: { port: 5555 } },
  manifest: {
    name: "ScreenBase",
    permissions: ["activeTab", "storage"],
  },
});
