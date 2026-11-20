import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/omb": {
        target: "http://127.0.0.1:8799",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/omb/, ""),
      },
    },
  },
});
