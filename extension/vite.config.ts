import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    // Release hygiene: chatter (log/info/debug) is stripped from shipped
    // bundles; warnings and errors stay - they are the field diagnostics.
    pure: ["console.log", "console.info", "console.debug"],
  },

  base: "./",
  root: ".",
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, "src/background/index.ts"),
        popup: path.resolve(__dirname, "popup.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
    target: "esnext",
    minify: "esbuild",
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "public/*", dest: "." },
      ],
    }),
  ],
});
