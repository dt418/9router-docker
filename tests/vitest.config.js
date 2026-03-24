import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const openSsePath = resolve(__dirname, "../open-sse");
const cloudPath = resolve(__dirname, "../cloud");

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.js"],
    // Suppress noisy console output from handlers under test
    silent: false,
  },
  deps: {
    inline: [
      (id) => id.startsWith("open-sse") || id.startsWith("cloud"),
    ],
  },
  resolve: {
    alias: {
      "open-sse": openSsePath,
      "cloud": cloudPath,
    },
    conditions: ["node"],
  },
});
