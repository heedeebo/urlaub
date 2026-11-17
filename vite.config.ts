/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/** Short commit id: from GitHub Actions, else from the local git repository. */
function commitId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

/**
 * Runs the serverless email function (api/send-request.ts) inside the Vite dev
 * server, so email sending can be tested locally with a Resend key in .env.local.
 * On Vercel the same handler runs as a real serverless function.
 */
function localApi(env: Record<string, string>): Plugin {
  return {
    name: "local-api",
    configureServer(server) {
      server.middlewares.use("/api/send-request", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString("utf8");
        const mod = await server.ssrLoadModule("/api/_lib/send.ts");
        const result = await mod.handleSendRequest({
          method: req.method ?? "GET",
          body: raw ? JSON.parse(raw) : null,
          authorization: req.headers.authorization ?? null,
          env,
          trusted: true, // dev server only listens on localhost
        });
        res.statusCode = result.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // GitHub Pages serves the app under /<repo>/, set by the deploy workflow.
    base: env.BASE_PATH || "/",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __BUILD_COMMIT__: JSON.stringify(commitId()),
    },
    plugins: [
      react(),
      tailwindcss(),
      localApi(env),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icon.svg"],
        manifest: {
          name: "My Vacation Manager",
          short_name: "Vacation",
          description: "Personal vacation planning, requests and balances.",
          theme_color: "#0f1f3d",
          background_color: "#f4f6f9",
          display: "standalone",
          start_url: "./",
          scope: "./",
          icons: [
            { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "api/**/*.test.ts"],
    },
  };
});
