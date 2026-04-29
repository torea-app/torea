import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  dev: { server: { port: 5555 } },
  webExt: { disabled: true },
  manifest: {
    name: "Torea",
    permissions: [
      "activeTab",
      "storage",
      "tabCapture",
      "offscreen",
      "scripting",
      // 録画自動停止の事前通知（残り 2 分 / 30 秒 / 上限到達）と上限到達後の
      // アップグレード案内を表示するため
      "notifications",
    ],
    web_accessible_resources: [
      {
        // Content Script が iframe として注入するために外部ページからアクセス可能にする
        resources: ["mic-permission.html"],
        matches: ["<all_urls>"],
      },
    ],
    host_permissions: [
      // API サーバーへのリクエストに Cookie を自動付与するために必要
      // 開発: https://3000.mydevbox.pp.ua, 本番: https://api.torea.app
      `${process.env.VITE_API_URL ?? "https://3000.mydevbox.pp.ua"}/*`,
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        // globals.css は src/styles/ 配下にあるため先に個別指定する
        {
          find: "@torea/ui/globals.css",
          replacement: path.resolve(
            __dirname,
            "../../packages/ui/src/styles/globals.css",
          ),
        },
        // その他の @torea/ui/* は src/ 配下にマッピング
        {
          find: "@torea/ui",
          replacement: path.resolve(__dirname, "../../packages/ui/src"),
        },
      ],
    },
  }),
});
