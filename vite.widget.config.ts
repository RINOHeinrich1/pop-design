import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 1048576,
    minify: true,
    emptyOutDir: false,
    outDir: "dist",
    lib: {
      entry: "src/widget.js",
      formats: ["es"],
      fileName: () => "widget.js",
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
