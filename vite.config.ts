import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    // Keep it tiny: one JS file, no vendor split needed for a no-dep game.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});

