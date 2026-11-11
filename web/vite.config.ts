import { defineConfig } from "vite";
export default defineConfig({
  root: "web",
  server: {
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:9281",
      "/health": "http://127.0.0.1:9281",
    },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
