import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // Migrates stl_test once per run (AD-10, AD-16).
    globalSetup: ["./test/global-setup.ts"],
    // Repository tests share the real stl_test database, so files run serially.
    fileParallelism: false,
    passWithNoTests: true,
  },
});
