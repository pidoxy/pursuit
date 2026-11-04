import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { DATA_DIR: path.join(os.tmpdir(), `pursuit-test-${process.pid}`) },
  },
});
