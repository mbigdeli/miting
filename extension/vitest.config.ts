import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["src/content/capture/**/*.test.ts", "happy-dom"],
      // meet-ui reads and injects into Meet's DOM, so it needs one too.
      ["src/content/meet-ui/**/*.test.ts", "happy-dom"],
    ],
    include: ["src/**/*.test.ts"],
  },
});
