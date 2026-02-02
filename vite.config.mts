import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: process.env.GITHUB_PAGES ? "/MMoMon/" : "/",
  build: {
    outDir: "dist"
  }
});

