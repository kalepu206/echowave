import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // During local development the API runs separately with `npm run dev:api`
    proxy: {
      "/api": "http://localhost:8787",
      "/.well-known": "http://localhost:8787",
    },
  },
});
