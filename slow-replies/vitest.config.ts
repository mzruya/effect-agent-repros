import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({
    main: "./src/worker.ts",
    miniflare: {
      compatibilityDate: "2026-09-20",
      compatibilityFlags: ["nodejs_compat"],
      durableObjects: { THREADS: { className: "Thread", useSQLite: true } },
    },
  })],
  test: { testTimeout: 300_000 },
});
