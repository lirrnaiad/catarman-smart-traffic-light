import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    // Lets @testing-library/react register its afterEach(cleanup) and act hooks.
    globals: true,
    passWithNoTests: true,
  },
});
