import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

/** Loads KEY="value" pairs from .env.test (no secrets there) into the test environment. */
function loadTestEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  let content = "";
  try {
    content = readFileSync(path.resolve(import.meta.dirname, ".env.test"), "utf8");
  } catch {
    return env;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export default defineConfig({
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/integration/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
    ],
    env: loadTestEnv(),
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
