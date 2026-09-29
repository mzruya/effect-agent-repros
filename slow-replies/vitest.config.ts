import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// MESSAGES=400 npm test runs a longer conversation.
const messages = process.env.MESSAGES ?? "150";

export default defineConfig({
  test: {
    testTimeout: 1_800_000,
    // One test file at a time, so the setups don't compete for the CPU while they are timed.
    fileParallelism: false,
    projects: [
      { extends: true, test: { name: "node", include: ["test/node.test.ts"], environment: "node", env: { MESSAGES: messages } } },
      {
        extends: true,
        plugins: [cloudflareTest({
          main: "./src/worker.ts",
          miniflare: {
            compatibilityDate: "2026-09-20",
            compatibilityFlags: ["nodejs_compat"],
            durableObjects: { THREADS: { className: "Thread", useSQLite: true } },
            bindings: { MESSAGES: messages },
          },
        })],
        test: { name: "cloudflare", include: ["test/cloudflare.test.ts"] },
      },
    ],
  },
});
