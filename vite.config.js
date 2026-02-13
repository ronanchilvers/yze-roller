import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
  const isAnalyze = mode === "analyze";

  return {
    plugins: [
      react(),
      ...(isAnalyze
        ? [
            visualizer({
              filename: "dist/bundle-stats.html",
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    test: {
      environment: "jsdom",
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            three: ["three", "@react-three/fiber"],
            "cannon-es": ["cannon-es"],
          },
        },
      },
    },
  };
});
