import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["next-app/lib/**/*.test.ts"],
    environment: "node",
  },
});
